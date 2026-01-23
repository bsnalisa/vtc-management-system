-- Add organization_id to custom_roles to track which VTC created custom roles
ALTER TABLE public.custom_roles 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add comment to clarify that organization_id is NULL for system roles (created by super_admin)
COMMENT ON COLUMN public.custom_roles.organization_id IS 'NULL for system roles created by super_admin. Set to VTC ID for custom roles created by organizational admins.';

-- Update user_roles to ensure organization_id is always set (except for super_admin and VMS users)
COMMENT ON COLUMN public.user_roles.organization_id IS 'VTC/Organization the user belongs to. NULL only for super_admin and VMS system users.';

-- Create function to validate role assignment based on organization
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to validate role assignments
DROP TRIGGER IF EXISTS validate_role_assignment_trigger ON public.user_roles;
CREATE TRIGGER validate_role_assignment_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION validate_role_assignment();

-- Create function to prevent cross-VTC custom role usage
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for custom role validation
DROP TRIGGER IF EXISTS prevent_cross_vtc_custom_roles_trigger ON public.custom_roles;
CREATE TRIGGER prevent_cross_vtc_custom_roles_trigger
  BEFORE INSERT OR UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cross_vtc_custom_roles();

-- Update RLS policies for custom_roles to respect organization boundaries
DROP POLICY IF EXISTS "Users can view roles" ON public.custom_roles;
CREATE POLICY "Users can view roles"
  ON public.custom_roles
  FOR SELECT
  TO authenticated
  USING (
    -- System roles visible to all
    is_system_role = true 
    OR 
    -- Custom roles visible only to users in the same organization
    organization_id = get_user_organization(auth.uid())
    OR
    -- Super admins see everything
    is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can manage system roles" ON public.custom_roles;
CREATE POLICY "Super admins can manage system roles"
  ON public.custom_roles
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()) AND is_system_role = true)
  WITH CHECK (is_super_admin(auth.uid()) AND is_system_role = true);

DROP POLICY IF EXISTS "Org admins can manage custom roles" ON public.custom_roles;
CREATE POLICY "Org admins can manage custom roles"
  ON public.custom_roles
  FOR ALL
  TO authenticated
  USING (
    is_admin(auth.uid()) 
    AND is_system_role = false 
    AND organization_id = get_user_organization(auth.uid())
  )
  WITH CHECK (
    is_admin(auth.uid()) 
    AND is_system_role = false 
    AND organization_id = get_user_organization(auth.uid())
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_roles_organization ON public.custom_roles(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_roles_system ON public.custom_roles(is_system_role) WHERE is_system_role = true;