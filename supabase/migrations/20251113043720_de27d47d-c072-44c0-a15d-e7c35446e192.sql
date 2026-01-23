-- Create trainee applications table
CREATE TABLE IF NOT EXISTS public.trainee_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  application_number TEXT NOT NULL UNIQUE,
  trainee_number TEXT UNIQUE,
  
  -- Personal Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE NOT NULL,
  national_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  
  -- Application Details
  trade_id UUID NOT NULL REFERENCES public.trades(id),
  preferred_training_mode TEXT NOT NULL CHECK (preferred_training_mode IN ('fulltime', 'bdl', 'shortcourse')),
  preferred_level INTEGER NOT NULL DEFAULT 1,
  intake TEXT NOT NULL CHECK (intake IN ('january', 'july')),
  academic_year TEXT NOT NULL,
  
  -- Qualification Status
  qualification_status TEXT NOT NULL DEFAULT 'pending' CHECK (qualification_status IN ('pending', 'provisionally_qualified', 'does_not_qualify')),
  qualification_remarks TEXT,
  screened_by UUID REFERENCES auth.users(id),
  screened_at TIMESTAMP WITH TIME ZONE,
  
  -- Registration Status
  registration_status TEXT NOT NULL DEFAULT 'applied' CHECK (registration_status IN ('applied', 'provisionally_admitted', 'pending_payment', 'fully_registered', 'rejected')),
  payment_verified_by UUID REFERENCES auth.users(id),
  payment_verified_at TIMESTAMP WITH TIME ZONE,
  registered_at TIMESTAMP WITH TIME ZONE,
  
  -- Documents
  provisional_letter_path TEXT,
  admission_letter_path TEXT,
  proof_of_registration_path TEXT,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trainee_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Registration officers can manage applications"
  ON public.trainee_applications
  FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

CREATE POLICY "Finance officers can view and update payment status"
  ON public.trainee_applications
  FOR SELECT
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'debtor_officer'::app_role) OR has_role(auth.uid(), 'registration_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Function to generate application number
CREATE OR REPLACE FUNCTION public.generate_application_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  year_suffix TEXT;
  counter INTEGER;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(application_number FROM 9) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.trainee_applications
  WHERE application_number LIKE 'APP' || year_suffix || '%';
  
  new_number := 'APP' || year_suffix || LPAD(counter::TEXT, 5, '0');
  
  RETURN new_number;
END;
$$;

-- Function to generate trainee number (continuous yearly)
CREATE OR REPLACE FUNCTION public.generate_continuous_trainee_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  year_suffix TEXT;
  counter INTEGER;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Check both trainee_applications and trainees tables for continuous numbering
  SELECT COALESCE(
    GREATEST(
      (SELECT MAX(CAST(SUBSTRING(trainee_number FROM 9) AS INTEGER))
       FROM public.trainee_applications
       WHERE trainee_number LIKE 'NVTC' || year_suffix || '%'),
      (SELECT MAX(CAST(SUBSTRING(trainee_id FROM 9) AS INTEGER))
       FROM public.trainees
       WHERE trainee_id LIKE 'NVTC' || year_suffix || '%')
    ), 0
  ) + 1
  INTO counter;
  
  new_number := 'NVTC' || year_suffix || LPAD(counter::TEXT, 5, '0');
  
  RETURN new_number;
END;
$$;

-- Trigger to auto-generate application number
CREATE OR REPLACE FUNCTION public.set_application_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.application_number IS NULL OR NEW.application_number = '' THEN
    NEW.application_number := public.generate_application_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_application_number_trigger
  BEFORE INSERT ON public.trainee_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_application_number();

-- Trigger to auto-generate trainee number when provisionally qualified
CREATE OR REPLACE FUNCTION public.set_trainee_number_on_qualification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.qualification_status = 'provisionally_qualified' AND (OLD.qualification_status IS NULL OR OLD.qualification_status != 'provisionally_qualified') THEN
    IF NEW.trainee_number IS NULL OR NEW.trainee_number = '' THEN
      NEW.trainee_number := public.generate_continuous_trainee_number();
    END IF;
    
    IF NEW.registration_status = 'applied' THEN
      NEW.registration_status := 'provisionally_admitted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_trainee_number_on_qualification_trigger
  BEFORE UPDATE ON public.trainee_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trainee_number_on_qualification();

-- Trigger to update updated_at
CREATE TRIGGER update_trainee_applications_updated_at
  BEFORE UPDATE ON public.trainee_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_trainee_applications_org ON public.trainee_applications(organization_id);
CREATE INDEX idx_trainee_applications_status ON public.trainee_applications(registration_status);
CREATE INDEX idx_trainee_applications_qualification ON public.trainee_applications(qualification_status);
CREATE INDEX idx_trainee_applications_trade ON public.trainee_applications(trade_id);
CREATE INDEX idx_trainee_applications_intake ON public.trainee_applications(intake, academic_year);
CREATE INDEX idx_trainee_applications_number ON public.trainee_applications(application_number);
CREATE INDEX idx_trainee_applications_trainee_number ON public.trainee_applications(trainee_number);