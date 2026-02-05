-- ============================================
-- PHASE 1: WORKFLOW REFACTORING DATABASE FOUNDATION
-- ============================================

-- 1. Create financial_queue table for centralized fee management
CREATE TABLE public.financial_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('APPLICATION', 'REGISTRATION', 'HOSTEL')),
  entity_id UUID NOT NULL,
  fee_type_id UUID REFERENCES public.fee_types(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC GENERATED ALWAYS AS (amount - amount_paid) STORED,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'cleared')),
  description TEXT,
  payment_method TEXT,
  requested_by UUID REFERENCES auth.users(id),
  cleared_by UUID REFERENCES auth.users(id),
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create registrations table for final registration tracking
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.trainee_applications(id),
  qualification_id UUID REFERENCES public.qualifications(id),
  academic_year TEXT NOT NULL,
  hostel_required BOOLEAN DEFAULT false,
  registration_status TEXT NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending', 'fee_pending', 'registered')),
  registered_at TIMESTAMPTZ,
  registered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add hostel_application_status to trainee_applications
ALTER TABLE public.trainee_applications 
ADD COLUMN IF NOT EXISTS hostel_application_status TEXT DEFAULT 'not_applied' 
CHECK (hostel_application_status IN ('not_applied', 'applied', 'provisionally_allocated', 'allocated'));

-- 4. Create indexes for performance
CREATE INDEX idx_financial_queue_org ON public.financial_queue(organization_id);
CREATE INDEX idx_financial_queue_entity ON public.financial_queue(entity_type, entity_id);
CREATE INDEX idx_financial_queue_status ON public.financial_queue(status);
CREATE INDEX idx_registrations_org ON public.registrations(organization_id);
CREATE INDEX idx_registrations_trainee ON public.registrations(trainee_id);
CREATE INDEX idx_registrations_status ON public.registrations(registration_status);

-- 5. Enable RLS on new tables
ALTER TABLE public.financial_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for financial_queue

-- Policy: Staff with appropriate roles can manage their organization's financial queue
CREATE POLICY "Staff manage financial queue"
ON public.financial_queue
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT ur.organization_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('debtor_officer', 'admin', 'organization_admin', 'super_admin', 'registration_officer')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT ur.organization_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('debtor_officer', 'admin', 'organization_admin', 'super_admin', 'registration_officer')
  )
);

-- Policy: Trainees can view their own queue entries
CREATE POLICY "Trainees view own financial queue"
ON public.financial_queue
FOR SELECT
TO authenticated
USING (
  entity_id IN (
    SELECT ta.id FROM public.trainee_applications ta WHERE ta.user_id = auth.uid()
    UNION ALL
    SELECT t.id FROM public.trainees t WHERE t.user_id = auth.uid()
  )
);

-- 7. RLS Policies for registrations

-- Policy: Staff can manage registrations in their organization
CREATE POLICY "Staff manage registrations"
ON public.registrations
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT ur.organization_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('registration_officer', 'admin', 'organization_admin', 'super_admin', 'head_of_training')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT ur.organization_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('registration_officer', 'admin', 'organization_admin', 'super_admin', 'head_of_training')
  )
);

-- Policy: Trainees can view their own registrations
CREATE POLICY "Trainees view own registrations"
ON public.registrations
FOR SELECT
TO authenticated
USING (
  trainee_id IN (
    SELECT t.id FROM public.trainees t WHERE t.user_id = auth.uid()
  )
);

-- 8. Create trigger for updated_at on financial_queue
CREATE OR REPLACE FUNCTION public.update_financial_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_financial_queue_updated_at
  BEFORE UPDATE ON public.financial_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_financial_queue_updated_at();

-- 9. Create trigger for updated_at on registrations
CREATE TRIGGER trigger_registrations_updated_at
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_financial_queue_updated_at();

-- 10. Initialize hostel_application_status for existing applications
UPDATE public.trainee_applications
SET hostel_application_status = CASE 
  WHEN needs_hostel_accommodation = true THEN 'applied'
  ELSE 'not_applied'
END
WHERE hostel_application_status IS NULL;