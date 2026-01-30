-- Drop the conflicting UPDATE policy with exact name and recreate
DROP POLICY IF EXISTS "Org admins can update unit standards" ON public.qualification_unit_standards;

-- Create UPDATE policy with a unique name
CREATE POLICY "Org admins can update qualification unit standards"
ON public.qualification_unit_standards
FOR UPDATE
TO authenticated
USING (
  public.can_manage_qualifications(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.qualifications q
    WHERE q.id = qualification_id
    AND q.organization_id = public.get_user_organization(auth.uid())
  )
)
WITH CHECK (
  public.can_manage_qualifications(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.qualifications q
    WHERE q.id = qualification_id
    AND q.organization_id = public.get_user_organization(auth.uid())
  )
);