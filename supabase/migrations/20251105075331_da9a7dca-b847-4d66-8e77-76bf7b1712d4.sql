-- Create custom roles table for dynamic role management
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create role permissions table to map roles to module access
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code TEXT NOT NULL,
  module_code TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_code, module_code)
);

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_roles
CREATE POLICY "Super admins can manage custom roles"
  ON public.custom_roles
  FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "All authenticated users can view active roles"
  ON public.custom_roles
  FOR SELECT
  USING (active = true);

-- RLS policies for role_permissions
CREATE POLICY "Super admins can manage role permissions"
  ON public.role_permissions
  FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "All authenticated users can view role permissions"
  ON public.role_permissions
  FOR SELECT
  USING (true);

-- Create function to check custom role permission
CREATE OR REPLACE FUNCTION public.has_custom_permission(
  _user_id UUID,
  _module_code TEXT,
  _permission_type TEXT DEFAULT 'view'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_code TEXT;
  has_permission BOOLEAN;
BEGIN
  -- Get user's role code from user_roles table
  SELECT role::TEXT INTO user_role_code
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
  
  IF user_role_code IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check permission based on type
  SELECT 
    CASE _permission_type
      WHEN 'view' THEN can_view
      WHEN 'create' THEN can_create
      WHEN 'edit' THEN can_edit
      WHEN 'delete' THEN can_delete
      ELSE false
    END INTO has_permission
  FROM public.role_permissions
  WHERE role_code = user_role_code
    AND module_code = _module_code
  LIMIT 1;
  
  RETURN COALESCE(has_permission, false);
END;
$$;

-- Insert system roles as custom roles for reference
INSERT INTO public.custom_roles (role_code, role_name, description, is_system_role) VALUES
  ('super_admin', 'Super Admin', 'Platform administrator with full access', true),
  ('organization_admin', 'Organization Admin', 'Organization-level administrator', true),
  ('admin', 'Admin', 'Administrative user', true),
  ('trainer', 'Trainer', 'Training instructor', true),
  ('registration_officer', 'Registration Officer', 'Handles trainee registration', true),
  ('debtor_officer', 'Debtor Officer', 'Manages fee collection', true),
  ('hod', 'Head of Department', 'Department head', true),
  ('assessment_coordinator', 'Assessment Coordinator', 'Manages assessments', true),
  ('stock_control_officer', 'Stock Control Officer', 'Manages inventory', true),
  ('asset_maintenance_coordinator', 'Asset Maintenance Coordinator', 'Manages assets', true),
  ('procurement_officer', 'Procurement Officer', 'Handles procurement', true),
  ('trainee', 'Trainee', 'Student/trainee user', true)
ON CONFLICT (role_code) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();