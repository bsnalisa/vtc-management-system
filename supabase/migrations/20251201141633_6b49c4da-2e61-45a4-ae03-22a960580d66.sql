-- Fix validate_role_assignment function to properly cast enum to text
CREATE OR REPLACE FUNCTION public.validate_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Super admins and VMS users (no organization) can have any role
  IF NEW.organization_id IS NULL AND NEW.role::text IN ('super_admin', 'vms_developer', 'vms_support') THEN
    RETURN NEW;
  END IF;
  
  -- For organization users, check if role is system role or belongs to their organization
  IF NEW.organization_id IS NOT NULL THEN
    -- Check if role exists and is either:
    -- 1. A system role (organization_id IS NULL in custom_roles)
    -- 2. A custom role belonging to the same organization
    IF EXISTS (
      SELECT 1 FROM public.custom_roles 
      WHERE role_code = NEW.role::text 
      AND (organization_id IS NULL OR organization_id = NEW.organization_id)
      AND active = true
    ) THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Invalid role assignment: Role % does not exist or is not available for this organization', NEW.role;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;