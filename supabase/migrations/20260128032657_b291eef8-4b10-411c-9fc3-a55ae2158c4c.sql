-- Fix qualification submission/approval RLS: allow status transitions via UPDATE

-- Replace the overly strict UPDATE policy (its implicit WITH CHECK was blocking status changes)
DROP POLICY IF EXISTS "Users can update qualifications" ON public.qualifications;

-- Organization Admins: can update only draft/rejected rows, but may transition to pending_approval
CREATE POLICY "Org admins can update draft/rejected qualifications"
ON public.qualifications
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.can_manage_qualifications(auth.uid())
  AND status IN ('draft'::qualification_status, 'rejected'::qualification_status)
)
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND public.can_manage_qualifications(auth.uid())
  AND status IN (
    'draft'::qualification_status,
    'rejected'::qualification_status,
    'pending_approval'::qualification_status
  )
);

-- Head of Training: can update only pending_approval rows, transitioning to approved/rejected
CREATE POLICY "Approvers can finalize pending qualifications"
ON public.qualifications
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.can_approve_qualifications(auth.uid())
  AND status = 'pending_approval'::qualification_status
)
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND public.can_approve_qualifications(auth.uid())
  AND status IN ('approved'::qualification_status, 'rejected'::qualification_status)
);

-- Super Admin: keep ability to update any qualification
CREATE POLICY "Super admins can update qualifications"
ON public.qualifications
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
