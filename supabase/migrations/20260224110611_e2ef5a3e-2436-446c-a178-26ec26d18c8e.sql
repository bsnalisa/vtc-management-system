-- Allow trainees to SELECT gradebooks they are enrolled in
CREATE POLICY "Trainees see own gradebooks"
ON public.gradebooks FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT gt.gradebook_id
    FROM public.gradebook_trainees gt
    JOIN public.trainees t ON gt.trainee_id = t.id
    WHERE t.user_id = auth.uid()
  )
  AND status IN ('submitted', 'hot_approved', 'ac_approved', 'finalised')
);