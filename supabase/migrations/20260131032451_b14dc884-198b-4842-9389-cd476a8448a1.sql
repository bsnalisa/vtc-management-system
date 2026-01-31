-- Drop existing policy that doesn't properly handle INSERT
DROP POLICY IF EXISTS "Registration officers can manage applications" ON public.trainee_applications;

-- Create SELECT policy for registration officers
CREATE POLICY "Registration officers can view applications"
ON public.trainee_applications
FOR SELECT
TO authenticated
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

-- Create INSERT policy for registration officers
CREATE POLICY "Registration officers can create applications"
ON public.trainee_applications
FOR INSERT
TO authenticated
WITH CHECK (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

-- Create UPDATE policy for registration officers
CREATE POLICY "Registration officers can update applications"
ON public.trainee_applications
FOR UPDATE
TO authenticated
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
)
WITH CHECK (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

-- Create DELETE policy for registration officers
CREATE POLICY "Registration officers can delete applications"
ON public.trainee_applications
FOR DELETE
TO authenticated
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);