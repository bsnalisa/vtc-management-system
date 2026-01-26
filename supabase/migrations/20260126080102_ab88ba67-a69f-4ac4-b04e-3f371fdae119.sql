-- Create enum types for qualification management
CREATE TYPE public.qualification_type AS ENUM ('nvc', 'diploma');
CREATE TYPE public.qualification_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected');
CREATE TYPE public.approval_action AS ENUM ('submitted', 'approved', 'rejected', 'returned');
CREATE TYPE public.duration_unit AS ENUM ('months', 'years');

-- Create qualifications table
CREATE TABLE public.qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  qualification_title TEXT NOT NULL,
  qualification_code TEXT NOT NULL,
  qualification_type public.qualification_type NOT NULL,
  nqf_level INTEGER NOT NULL CHECK (nqf_level >= 1 AND nqf_level <= 10),
  duration_value INTEGER NOT NULL CHECK (duration_value > 0),
  duration_unit public.duration_unit NOT NULL DEFAULT 'months',
  status public.qualification_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approval_date TIMESTAMPTZ,
  version_number INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  rejection_comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, qualification_code, version_number)
);

-- Create qualification unit standards table
CREATE TABLE public.qualification_unit_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  unit_standard_id TEXT NOT NULL,
  unit_standard_title TEXT NOT NULL,
  credit_value INTEGER,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 10),
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(qualification_id, unit_standard_id)
);

-- Create qualification approvals audit table
CREATE TABLE public.qualification_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  action public.approval_action NOT NULL,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create proof of registration table
CREATE TABLE public.proof_of_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id),
  reference_number TEXT NOT NULL UNIQUE,
  academic_year TEXT NOT NULL,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  file_path TEXT,
  generated_by UUID NOT NULL REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add qualification_id to trainees table for registration linking
ALTER TABLE public.trainees ADD COLUMN IF NOT EXISTS qualification_id UUID REFERENCES public.qualifications(id);

-- Create indexes for performance
CREATE INDEX idx_qualifications_org ON public.qualifications(organization_id);
CREATE INDEX idx_qualifications_status ON public.qualifications(status);
CREATE INDEX idx_qualifications_code ON public.qualifications(qualification_code);
CREATE INDEX idx_qualification_unit_standards_qual ON public.qualification_unit_standards(qualification_id);
CREATE INDEX idx_qualification_approvals_qual ON public.qualification_approvals(qualification_id);
CREATE INDEX idx_proof_of_registrations_trainee ON public.proof_of_registrations(trainee_id);

-- Enable RLS
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_unit_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_of_registrations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can manage qualifications (org admin)
CREATE OR REPLACE FUNCTION public.can_manage_qualifications(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('organization_admin', 'super_admin')
  )
$$;

-- Helper function to check if user can approve qualifications (head of training)
CREATE OR REPLACE FUNCTION public.can_approve_qualifications(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('head_of_training', 'super_admin')
  )
$$;

-- RLS Policies for qualifications
CREATE POLICY "Users can view qualifications"
ON public.qualifications FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    status = 'approved'
    OR created_by = auth.uid()
    OR can_approve_qualifications(auth.uid())
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "Org admins can create qualifications"
ON public.qualifications FOR INSERT
TO authenticated
WITH CHECK (
  can_manage_qualifications(auth.uid())
  AND organization_id = get_user_organization(auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update qualifications"
ON public.qualifications FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    (can_manage_qualifications(auth.uid()) AND status IN ('draft', 'rejected'))
    OR (can_approve_qualifications(auth.uid()) AND status = 'pending_approval')
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "Super admins can delete unused qualifications"
ON public.qualifications FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM public.trainees WHERE qualification_id = qualifications.id
  )
);

-- RLS Policies for qualification_unit_standards
CREATE POLICY "Users can view qualification unit standards"
ON public.qualification_unit_standards FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.qualifications q
    WHERE q.id = qualification_unit_standards.qualification_id
    AND q.organization_id = get_user_organization(auth.uid())
    AND (
      q.status = 'approved'
      OR q.created_by = auth.uid()
      OR can_approve_qualifications(auth.uid())
      OR is_super_admin(auth.uid())
    )
  )
);

CREATE POLICY "Org admins can manage unit standards"
ON public.qualification_unit_standards FOR INSERT
TO authenticated
WITH CHECK (
  can_manage_qualifications(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.qualifications q
    WHERE q.id = qualification_unit_standards.qualification_id
    AND q.organization_id = get_user_organization(auth.uid())
    AND q.status IN ('draft', 'rejected')
  )
);

CREATE POLICY "Org admins can update unit standards"
ON public.qualification_unit_standards FOR UPDATE
TO authenticated
USING (
  can_manage_qualifications(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.qualifications q
    WHERE q.id = qualification_unit_standards.qualification_id
    AND q.organization_id = get_user_organization(auth.uid())
    AND q.status IN ('draft', 'rejected')
  )
);

CREATE POLICY "Org admins can delete unit standards"
ON public.qualification_unit_standards FOR DELETE
TO authenticated
USING (
  can_manage_qualifications(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.qualifications q
    WHERE q.id = qualification_unit_standards.qualification_id
    AND q.organization_id = get_user_organization(auth.uid())
    AND q.status IN ('draft', 'rejected')
  )
);

-- RLS Policies for qualification_approvals
CREATE POLICY "Users can view approval history"
ON public.qualification_approvals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.qualifications q
    WHERE q.id = qualification_approvals.qualification_id
    AND q.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Authorized users can create approval records"
ON public.qualification_approvals FOR INSERT
TO authenticated
WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.qualifications q
    WHERE q.id = qualification_approvals.qualification_id
    AND q.organization_id = get_user_organization(auth.uid())
    AND (
      (can_manage_qualifications(auth.uid()) AND qualification_approvals.action = 'submitted')
      OR (can_approve_qualifications(auth.uid()) AND qualification_approvals.action IN ('approved', 'rejected', 'returned'))
    )
  )
);

-- RLS Policies for proof_of_registrations
CREATE POLICY "Users can view proof of registrations"
ON public.proof_of_registrations FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Staff can create proof of registrations"
ON public.proof_of_registrations FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND generated_by = auth.uid()
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'registration_officer')
    OR has_role(auth.uid(), 'organization_admin')
  )
);

-- Function to generate proof of registration reference number
CREATE OR REPLACE FUNCTION public.generate_por_reference(_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ref TEXT;
  year_suffix TEXT;
  counter INTEGER;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM 8) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.proof_of_registrations
  WHERE organization_id = _org_id 
  AND reference_number LIKE 'POR' || year_suffix || '%';
  
  new_ref := 'POR' || year_suffix || LPAD(counter::TEXT, 5, '0');
  
  RETURN new_ref;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_qualifications_updated_at
  BEFORE UPDATE ON public.qualifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_qualification_unit_standards_updated_at
  BEFORE UPDATE ON public.qualification_unit_standards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();