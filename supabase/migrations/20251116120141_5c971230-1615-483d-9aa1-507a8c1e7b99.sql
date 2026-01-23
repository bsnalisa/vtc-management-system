-- Fix security warnings by setting search_path on the new functions

-- Recreate validate_role_assignment function with search_path
CREATE OR REPLACE FUNCTION validate_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Super admins and VMS users (no organization) can have any role
  IF NEW.organization_id IS NULL AND NEW.role IN ('super_admin', 'vms_developer', 'vms_support') THEN
    RETURN NEW;
  END IF;
  
  -- For organization users, check if role is system role or belongs to their organization
  IF NEW.organization_id IS NOT NULL THEN
    -- Check if role exists and is either:
    -- 1. A system role (organization_id IS NULL in custom_roles)
    -- 2. A custom role belonging to the same organization
    IF EXISTS (
      SELECT 1 FROM public.custom_roles 
      WHERE role_code = NEW.role 
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate prevent_cross_vtc_custom_roles function with search_path
CREATE OR REPLACE FUNCTION prevent_cross_vtc_custom_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Only organizational admins can create custom roles, and they must belong to an organization
  IF NEW.is_system_role = false AND NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Custom roles must be assigned to a specific VTC/Organization';
  END IF;
  
  -- System roles must not have an organization_id
  IF NEW.is_system_role = true AND NEW.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'System roles cannot be assigned to a specific organization';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;