-- Fix: Postgres does not support CREATE POLICY IF NOT EXISTS
-- Recreate policies explicitly.

DROP POLICY IF EXISTS "Staff can submit applications" ON public.trainee_applications;
DROP POLICY IF EXISTS "Registration officers can create applications" ON public.trainee_applications;

CREATE POLICY "Staff can submit applications"
ON public.trainee_applications
FOR INSERT
TO authenticated
WITH CHECK (
  (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'registration_officer'::app_role)
    OR has_role(auth.uid(), 'head_of_training'::app_role)
    OR has_role(auth.uid(), 'head_of_trainee_support'::app_role)
  )
  AND organization_id = get_user_organization(auth.uid())
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Head of training can view applications" ON public.trainee_applications;
CREATE POLICY "Head of training can view applications"
ON public.trainee_applications
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'head_of_training'::app_role)
  AND organization_id = get_user_organization(auth.uid())
);

DROP POLICY IF EXISTS "Head of trainee support can view applications" ON public.trainee_applications;
CREATE POLICY "Head of trainee support can view applications"
ON public.trainee_applications
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'head_of_trainee_support'::app_role)
  AND organization_id = get_user_organization(auth.uid())
);