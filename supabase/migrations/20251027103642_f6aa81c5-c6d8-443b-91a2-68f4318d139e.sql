-- Update RLS policies on user_roles to allow super_admins
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Super admins and admins can manage user roles"
ON public.user_roles
FOR ALL
USING (is_super_admin(auth.uid()) OR is_admin(auth.uid()));