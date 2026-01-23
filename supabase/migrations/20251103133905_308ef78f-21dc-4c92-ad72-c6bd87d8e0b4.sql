-- Allow organization admins to create profiles for users in their organization
CREATE POLICY "Organization admins can create profiles for their org"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  is_organization_admin(auth.uid(), get_user_organization(auth.uid()))
);

-- Allow organization admins to update profiles in their organization
CREATE POLICY "Organization admins can update profiles in their org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_organization_admin(auth.uid(), get_user_organization(auth.uid())) 
  AND user_id IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  is_organization_admin(auth.uid(), get_user_organization(auth.uid())) 
  AND user_id IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.organization_id = get_user_organization(auth.uid())
  )
);