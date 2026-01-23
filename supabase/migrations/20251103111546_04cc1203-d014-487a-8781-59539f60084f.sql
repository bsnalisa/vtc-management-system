-- Drop existing policy and create new ones for proper organization-based access
DROP POLICY IF EXISTS "Super admins and admins can manage user roles" ON public.user_roles;

-- Organization admins can only manage roles for users in their organization
CREATE POLICY "Organization admins can manage user roles in their org"
ON public.user_roles
FOR ALL
USING (
  is_super_admin(auth.uid()) 
  OR (
    is_organization_admin(auth.uid(), (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1))
    AND organization_id = (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
  )
);

-- Update profiles RLS to allow organization admins to view users in their org
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view profiles in their scope"
ON public.profiles
FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR is_admin(auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM public.user_roles ur1
      WHERE ur1.user_id = auth.uid() 
      AND ur1.role = 'organization_admin'
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = profiles.user_id
        AND ur2.organization_id = ur1.organization_id
      )
    )
  )
  OR auth.uid() = user_id
);