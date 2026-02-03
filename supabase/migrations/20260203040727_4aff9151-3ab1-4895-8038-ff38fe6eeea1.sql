-- ============================================================
-- TRAINEE AUTHENTICATION PROVISIONING SYSTEM
-- Adds email auto-generation, password reset tracking, and backfill
-- ============================================================

-- 1. Add new columns to trainees table for auth tracking
ALTER TABLE public.trainees 
ADD COLUMN IF NOT EXISTS system_email TEXT,
ADD COLUMN IF NOT EXISTS is_email_system_generated BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT true;

-- 2. Create unique constraint on system_email (after backfill, before trigger)
-- We'll add this after backfill to avoid conflicts

-- 3. Function to generate trainee system email
CREATE OR REPLACE FUNCTION public.generate_trainee_system_email(
  p_trainee_number TEXT,
  p_org_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email_domain TEXT;
  v_system_email TEXT;
BEGIN
  -- Get the organization's email domain
  SELECT email_domain INTO v_email_domain
  FROM public.organizations
  WHERE id = p_org_id;
  
  -- Return null if no domain configured
  IF v_email_domain IS NULL OR v_email_domain = '' THEN
    RETURN NULL;
  END IF;
  
  -- Generate email: trainee_number@email_domain
  v_system_email := LOWER(p_trainee_number) || '@' || LOWER(v_email_domain);
  
  RETURN v_system_email;
END;
$function$;

-- 4. Function to auto-set system email when trainee_id is assigned
CREATE OR REPLACE FUNCTION public.set_trainee_system_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only generate if trainee_id is set and system_email is not already set
  IF NEW.trainee_id IS NOT NULL AND NEW.trainee_id != '' AND 
     (NEW.system_email IS NULL OR NEW.system_email = '') THEN
    NEW.system_email := public.generate_trainee_system_email(NEW.trainee_id, NEW.organization_id);
    NEW.is_email_system_generated := true;
    NEW.password_reset_required := true;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 5. Create trigger to auto-generate system email
DROP TRIGGER IF EXISTS trigger_set_trainee_system_email ON public.trainees;
CREATE TRIGGER trigger_set_trainee_system_email
  BEFORE INSERT OR UPDATE ON public.trainees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trainee_system_email();

-- 6. Backfill existing trainees with system emails
-- Only for trainees that have a trainee_id and organization with email_domain
UPDATE public.trainees t
SET 
  system_email = public.generate_trainee_system_email(t.trainee_id, t.organization_id),
  is_email_system_generated = true,
  password_reset_required = true
WHERE t.trainee_id IS NOT NULL 
  AND t.trainee_id != ''
  AND (t.system_email IS NULL OR t.system_email = '')
  AND t.organization_id IS NOT NULL;

-- 7. Add unique constraint on system_email (allows nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trainees_system_email_unique 
ON public.trainees (system_email) 
WHERE system_email IS NOT NULL;

-- 8. Also add system_email to trainee_applications for consistency
ALTER TABLE public.trainee_applications 
ADD COLUMN IF NOT EXISTS system_email TEXT,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 9. Function to auto-set system email on trainee_applications when trainee_number is assigned
CREATE OR REPLACE FUNCTION public.set_application_system_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only generate if trainee_number is being set and system_email is not already set
  IF NEW.trainee_number IS NOT NULL AND NEW.trainee_number != '' AND 
     (NEW.system_email IS NULL OR NEW.system_email = '') THEN
    NEW.system_email := public.generate_trainee_system_email(NEW.trainee_number, NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 10. Create trigger for applications
DROP TRIGGER IF EXISTS trigger_set_application_system_email ON public.trainee_applications;
CREATE TRIGGER trigger_set_application_system_email
  BEFORE INSERT OR UPDATE ON public.trainee_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_application_system_email();

-- 11. Backfill existing applications with system emails
UPDATE public.trainee_applications ta
SET system_email = public.generate_trainee_system_email(ta.trainee_number, ta.organization_id)
WHERE ta.trainee_number IS NOT NULL 
  AND ta.trainee_number != ''
  AND (ta.system_email IS NULL OR ta.system_email = '')
  AND ta.organization_id IS NOT NULL;

-- 12. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trainees_system_email ON public.trainees (system_email);
CREATE INDEX IF NOT EXISTS idx_trainee_applications_system_email ON public.trainee_applications (system_email);

-- 13. Create a view for trainee login lookup (useful for auth)
CREATE OR REPLACE VIEW public.trainee_login_info AS
SELECT 
  t.id,
  t.trainee_id,
  t.first_name,
  t.last_name,
  t.system_email,
  t.user_id,
  t.organization_id,
  t.password_reset_required,
  o.name as organization_name,
  o.email_domain
FROM public.trainees t
JOIN public.organizations o ON t.organization_id = o.id
WHERE t.system_email IS NOT NULL;