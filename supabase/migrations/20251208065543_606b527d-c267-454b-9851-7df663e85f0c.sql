-- Allow organization admins to update their own organization
CREATE POLICY "Organization admins can update their organization"
ON public.organizations
FOR UPDATE
USING (is_organization_admin(auth.uid(), id))
WITH CHECK (is_organization_admin(auth.uid(), id));