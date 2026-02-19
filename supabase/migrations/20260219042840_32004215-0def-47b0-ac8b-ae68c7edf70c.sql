
-- Allow staff roles (head_of_training, hod, trainer, etc.) to view profiles
-- of users within the same organization. This is needed for pages like
-- Trainer Management where HoT needs to see trainer profiles.

CREATE POLICY "Staff can view org member profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.organization_id = public.get_user_organization(auth.uid())
    )
  );
