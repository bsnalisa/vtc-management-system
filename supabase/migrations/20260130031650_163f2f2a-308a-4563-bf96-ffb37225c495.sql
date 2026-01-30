-- Fix INSERT RLS policy: currently restricted to draft/rejected only
-- Existing policy name (from pg_policies): "Org admins can manage unit standards"
DROP POLICY IF EXISTS "Org admins can manage unit standards" ON public.qualification_unit_standards;

-- Allow org admins (and super admins) to add unit standards to qualifications in their organization
-- regardless of qualification status (draft/pending/approved/rejected)
CREATE POLICY "Org admins can insert qualification unit standards"
ON public.qualification_unit_standards
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_qualifications(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.qualifications q
    WHERE q.id = qualification_unit_standards.qualification_id
      AND q.organization_id = public.get_user_organization(auth.uid())
  )
);