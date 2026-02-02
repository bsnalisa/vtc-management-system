-- First, add user_id to trainee_applications if missing
ALTER TABLE public.trainee_applications
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add system email column
ALTER TABLE public.trainee_applications
ADD COLUMN IF NOT EXISTS system_email TEXT,
ADD COLUMN IF NOT EXISTS user_account_created BOOLEAN DEFAULT false;

-- Add domain column to organizations for email generation
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS email_domain TEXT;

-- Create the fee_types table for configurable fee management
CREATE TABLE IF NOT EXISTS public.fee_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    default_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL CHECK (category IN ('tuition', 'registration', 'training_grant', 'hostel', 'materials', 'examination', 'other')),
    is_mandatory BOOLEAN NOT NULL DEFAULT false,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    recurring_frequency TEXT CHECK (recurring_frequency IN ('monthly', 'quarterly', 'annually', NULL)),
    applicable_to TEXT[] DEFAULT ARRAY['all']::TEXT[],
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(organization_id, code)
);

-- Create trainee_financial_accounts for tracking individual trainee finances
CREATE TABLE IF NOT EXISTS public.trainee_financial_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    trainee_id UUID REFERENCES public.trainees(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.trainee_applications(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL,
    total_fees NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance NUMERIC(12,2) GENERATED ALWAYS AS (total_fees - total_paid) STORED,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(organization_id, account_number)
);

-- Create financial_transactions table for detailed transaction history
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.trainee_financial_accounts(id) ON DELETE CASCADE,
    fee_type_id UUID REFERENCES public.fee_types(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('charge', 'payment', 'credit', 'adjustment', 'refund', 'waiver')),
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    payment_method TEXT,
    reference_number TEXT,
    description TEXT,
    notes TEXT,
    academic_year TEXT,
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainee_financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fee_types
CREATE POLICY "fee_types_org_read" ON public.fee_types
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "fee_types_org_write" ON public.fee_types
FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('organization_admin', 'debtor_officer', 'head_of_training')
    )
);

-- RLS Policies for trainee_financial_accounts
CREATE POLICY "tfa_org_read" ON public.trainee_financial_accounts
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    OR trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
);

CREATE POLICY "tfa_org_write" ON public.trainee_financial_accounts
FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('organization_admin', 'debtor_officer', 'registration_officer')
    )
);

-- RLS Policies for financial_transactions
CREATE POLICY "ft_org_read" ON public.financial_transactions
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    OR account_id IN (
        SELECT id FROM public.trainee_financial_accounts 
        WHERE trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
    )
);

CREATE POLICY "ft_org_write" ON public.financial_transactions
FOR ALL USING (
    organization_id IN (
        SELECT organization_id FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('organization_admin', 'debtor_officer')
    )
);

-- Fix the notification trigger to use the correct column name
CREATE OR REPLACE FUNCTION public.notify_payment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert notification for trainee when payment is cleared
    IF NEW.status = 'cleared' AND (OLD.status IS NULL OR OLD.status != 'cleared') THEN
        -- Try to notify via trainee first
        IF NEW.trainee_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                organization_id
            )
            SELECT 
                t.user_id,
                'Payment Cleared! 🎉',
                'Your registration payment has been verified. You can now proceed with registration.',
                'success',
                NEW.organization_id
            FROM public.trainees t
            WHERE t.id = NEW.trainee_id
            AND t.user_id IS NOT NULL;
        END IF;
        
        -- Try to notify via application if no trainee
        IF NEW.application_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                organization_id
            )
            SELECT 
                ta.user_id,
                'Payment Cleared! 🎉',
                'Your registration payment has been verified. You can now proceed with registration.',
                'success',
                NEW.organization_id
            FROM public.trainee_applications ta
            WHERE ta.id = NEW.application_id
            AND ta.user_id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM public.notifications n 
                WHERE n.user_id = ta.user_id 
                AND n.title = 'Payment Cleared! 🎉'
                AND n.created_at > NOW() - INTERVAL '1 minute'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Function to auto-create financial account on registration
CREATE OR REPLACE FUNCTION public.create_trainee_financial_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account_num TEXT;
    v_year_suffix TEXT;
    v_counter INTEGER;
BEGIN
    -- Only create if transitioning to registered status
    IF NEW.registration_status = 'registered' AND 
       (OLD.registration_status IS NULL OR OLD.registration_status != 'registered') THEN
        
        -- Check if account already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.trainee_financial_accounts 
            WHERE organization_id = NEW.organization_id 
            AND application_id = NEW.id
        ) THEN
            -- Generate account number
            v_year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
            SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM 7) AS INTEGER)), 0) + 1
            INTO v_counter
            FROM public.trainee_financial_accounts
            WHERE organization_id = NEW.organization_id
            AND account_number LIKE 'FA' || v_year_suffix || '%';
            
            v_account_num := 'FA' || v_year_suffix || LPAD(v_counter::TEXT, 5, '0');
            
            -- Create the financial account
            INSERT INTO public.trainee_financial_accounts (
                organization_id,
                application_id,
                account_number,
                total_fees,
                total_paid,
                status
            ) VALUES (
                NEW.organization_id,
                NEW.id,
                v_account_num,
                0,
                0,
                'active'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for auto-creating financial accounts
DROP TRIGGER IF EXISTS create_financial_account_on_registration ON public.trainee_applications;
CREATE TRIGGER create_financial_account_on_registration
    AFTER UPDATE ON public.trainee_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.create_trainee_financial_account();

-- Function to generate trainee system email
CREATE OR REPLACE FUNCTION public.generate_trainee_system_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_domain TEXT;
BEGIN
    -- Only generate if trainee_number is set and system_email is not yet set
    IF NEW.trainee_number IS NOT NULL AND NEW.system_email IS NULL THEN
        -- Get organization email domain
        SELECT COALESCE(email_domain, subdomain || '.vtc.na') INTO v_org_domain
        FROM public.organizations
        WHERE id = NEW.organization_id;
        
        IF v_org_domain IS NOT NULL THEN
            NEW.system_email := LOWER(NEW.trainee_number) || '@' || v_org_domain;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for auto-generating system email
DROP TRIGGER IF EXISTS generate_system_email_on_trainee_number ON public.trainee_applications;
CREATE TRIGGER generate_system_email_on_trainee_number
    BEFORE UPDATE ON public.trainee_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_trainee_system_email();

-- Function to update financial account totals
CREATE OR REPLACE FUNCTION public.update_financial_account_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.transaction_type IN ('charge') THEN
            UPDATE public.trainee_financial_accounts
            SET total_fees = total_fees + NEW.amount,
                updated_at = now()
            WHERE id = NEW.account_id;
        ELSIF NEW.transaction_type IN ('payment', 'credit', 'waiver') THEN
            UPDATE public.trainee_financial_accounts
            SET total_paid = total_paid + NEW.amount,
                updated_at = now()
            WHERE id = NEW.account_id;
        ELSIF NEW.transaction_type = 'refund' THEN
            UPDATE public.trainee_financial_accounts
            SET total_paid = total_paid - NEW.amount,
                updated_at = now()
            WHERE id = NEW.account_id;
        ELSIF NEW.transaction_type = 'adjustment' THEN
            UPDATE public.trainee_financial_accounts
            SET total_fees = total_fees + NEW.amount,
                updated_at = now()
            WHERE id = NEW.account_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for updating account totals
DROP TRIGGER IF EXISTS update_account_on_transaction ON public.financial_transactions;
CREATE TRIGGER update_account_on_transaction
    AFTER INSERT ON public.financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_financial_account_totals();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fee_types_org ON public.fee_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_tfa_org ON public.trainee_financial_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_tfa_trainee ON public.trainee_financial_accounts(trainee_id);
CREATE INDEX IF NOT EXISTS idx_tfa_application ON public.trainee_financial_accounts(application_id);
CREATE INDEX IF NOT EXISTS idx_ft_account ON public.financial_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_ft_org ON public.financial_transactions(organization_id);

-- Enable realtime for financial tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.trainee_financial_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_transactions;