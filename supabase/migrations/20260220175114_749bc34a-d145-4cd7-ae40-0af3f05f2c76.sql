-- Allow authenticated staff to view user_roles within their own organization
CREATE POLICY "Staff can view roles in their organization"
ON public.user_roles
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
);
