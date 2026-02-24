
-- Drop the restrictive policy
DROP POLICY IF EXISTS "Admins can manage symbol points" ON public.symbol_points;

-- Create separate policies for INSERT, UPDATE, DELETE that include registration_officer
CREATE POLICY "Staff can insert symbol points"
ON public.symbol_points FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'registration_officer')
    OR has_role(auth.uid(), 'head_of_training')
  )
);

CREATE POLICY "Staff can update symbol points"
ON public.symbol_points FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'registration_officer')
    OR has_role(auth.uid(), 'head_of_training')
  )
);

CREATE POLICY "Staff can delete symbol points"
ON public.symbol_points FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'registration_officer')
    OR has_role(auth.uid(), 'head_of_training')
  )
);
