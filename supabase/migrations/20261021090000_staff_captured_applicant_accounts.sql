-- Applications captured by staff at the centre get an applicant account so the trainee can follow their status.
-- created_by stays the staff member who captured it; applicant_user_id is the person the application belongs to.
ALTER TABLE public.trainee_applications
  ADD COLUMN IF NOT EXISTS applicant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trainee_applications_applicant_user ON public.trainee_applications(applicant_user_id);

DROP POLICY IF EXISTS "Applicants can view applications captured for them" ON public.trainee_applications;
CREATE POLICY "Applicants can view applications captured for them"
ON public.trainee_applications FOR SELECT TO authenticated
USING (applicant_user_id = auth.uid());
