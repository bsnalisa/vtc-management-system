-- Fix SELECT policy to allow org admins to view unit standards on qualifications they can manage
DROP POLICY IF EXISTS "Users can view qualification unit standards" ON public.qualification_unit_standards;

CREATE POLICY "Users can view qualification unit standards"
ON public.qualification_unit_standards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM qualifications q
    WHERE q.id = qualification_unit_standards.qualification_id
    AND q.organization_id = public.get_user_organization(auth.uid())
    AND (
      -- Approved qualifications are visible to all org users
      q.status = 'approved'::qualification_status
      -- Draft/Rejected visible to creator and org admins
      OR q.created_by = auth.uid()
      OR public.can_manage_qualifications(auth.uid())
      -- Head of Training and Super Admin can view any
      OR public.can_approve_qualifications(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  )
);