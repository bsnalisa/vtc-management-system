-- ============================================
-- TRAINEE REGISTRATION WORKFLOW STABILIZATION
-- ============================================

-- 1. Create account provisioning status enum
DO $$ BEGIN
  CREATE TYPE public.account_provisioning_status AS ENUM (
    'not_started',
    'auto_provisioned',
    'manually_provisioned',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add account_provisioning_status column to trainee_applications
ALTER TABLE public.trainee_applications
ADD COLUMN IF NOT EXISTS account_provisioning_status public.account_provisioning_status DEFAULT 'not_started';

-- 3. Add account_provisioning_status column to trainees
ALTER TABLE public.trainees
ADD COLUMN IF NOT EXISTS account_provisioning_status public.account_provisioning_status DEFAULT 'not_started';

-- 4. Create provisioning_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id UUID REFERENCES public.trainees(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.trainee_applications(id) ON DELETE SET NULL,
  user_id UUID,
  email TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto', 'manual', 'bulk')),
  result TEXT NOT NULL CHECK (result IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on provisioning_logs
ALTER TABLE public.provisioning_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for provisioning_logs
CREATE POLICY "Users can view provisioning logs for their organization"
ON public.provisioning_logs
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert provisioning logs"
ON public.provisioning_logs
FOR INSERT
WITH CHECK (true);

-- 5. Update existing applications with legacy statuses to new canonical statuses
-- Map old qualification_status values
UPDATE public.trainee_applications
SET registration_status = 'pending_payment'
WHERE qualification_status = 'pending' 
  AND registration_status = 'applied';

-- Update applications where user_id exists to mark as provisioned
UPDATE public.trainee_applications
SET account_provisioning_status = 'auto_provisioned'
WHERE user_id IS NOT NULL 
  AND account_provisioning_status = 'not_started';

-- Same for trainees
UPDATE public.trainees
SET account_provisioning_status = 'auto_provisioned'
WHERE user_id IS NOT NULL 
  AND account_provisioning_status = 'not_started';

-- 6. Create index for faster provisioning status lookups
CREATE INDEX IF NOT EXISTS idx_trainee_applications_provisioning_status 
ON public.trainee_applications(account_provisioning_status);

CREATE INDEX IF NOT EXISTS idx_trainees_provisioning_status 
ON public.trainees(account_provisioning_status);

CREATE INDEX IF NOT EXISTS idx_provisioning_logs_org_created 
ON public.provisioning_logs(organization_id, created_at DESC);

-- 7. Create a function to get applications ready for provisioning
CREATE OR REPLACE FUNCTION public.get_applications_needing_provisioning(_org_id uuid)
RETURNS TABLE(
  application_id uuid,
  trainee_number text,
  system_email text,
  first_name text,
  last_name text,
  qualification_status text,
  registration_status text,
  account_provisioning_status public.account_provisioning_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    trainee_number,
    system_email,
    first_name,
    last_name,
    qualification_status,
    registration_status,
    account_provisioning_status
  FROM public.trainee_applications
  WHERE organization_id = _org_id
    AND qualification_status = 'provisionally_qualified'
    AND account_provisioning_status IN ('not_started', 'failed')
    AND trainee_number IS NOT NULL
    AND system_email IS NOT NULL
  ORDER BY created_at ASC;
$$;

-- 8. Create a function to log provisioning attempts
CREATE OR REPLACE FUNCTION public.log_provisioning_attempt(
  _org_id uuid,
  _trainee_id uuid,
  _application_id uuid,
  _user_id uuid,
  _email text,
  _trigger_type text,
  _result text,
  _error_message text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id uuid;
BEGIN
  INSERT INTO public.provisioning_logs (
    organization_id,
    trainee_id,
    application_id,
    user_id,
    email,
    trigger_type,
    result,
    error_message,
    metadata
  ) VALUES (
    _org_id,
    _trainee_id,
    _application_id,
    _user_id,
    _email,
    _trigger_type,
    _result,
    _error_message,
    _metadata
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;

-- 9. Add needs_hostel_accommodation column if it doesn't exist
ALTER TABLE public.trainee_applications
ADD COLUMN IF NOT EXISTS hostel_allocated BOOLEAN DEFAULT false;

-- 10. Update registration_status check constraint to include all valid statuses
ALTER TABLE public.trainee_applications DROP CONSTRAINT IF EXISTS "trainee applications registration status check";
ALTER TABLE public.trainee_applications DROP CONSTRAINT IF EXISTS trainee_applications_registration_status_check;

ALTER TABLE public.trainee_applications
ADD CONSTRAINT trainee_applications_registration_status_check
CHECK (registration_status IN (
  'applied',
  'pending_payment',
  'provisionally_admitted',
  'payment_verified',
  'payment_cleared',
  'fully_registered',
  'registered'
));