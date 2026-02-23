-- Allow trainers to delete their own draft gradebooks
CREATE POLICY "Trainers delete own draft gradebooks"
ON public.gradebooks
FOR DELETE
USING (
  status = 'draft'
  AND is_locked = false
  AND trainer_id IN (
    SELECT trainers.id FROM trainers WHERE trainers.user_id = auth.uid()
  )
);