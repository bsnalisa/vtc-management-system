
-- Create security definer function to check if user is a trainee enrolled in a gradebook
CREATE OR REPLACE FUNCTION public.is_trainee_in_gradebook(_user_id uuid, _gradebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gradebook_trainees gt
    JOIN public.trainees t ON gt.trainee_id = t.id
    WHERE t.user_id = _user_id
      AND gt.gradebook_id = _gradebook_id
  )
$$;

-- Create security definer function to get trainee gradebook IDs for a user
CREATE OR REPLACE FUNCTION public.get_trainee_gradebook_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gt.gradebook_id
  FROM public.gradebook_trainees gt
  JOIN public.trainees t ON gt.trainee_id = t.id
  WHERE t.user_id = _user_id
$$;

-- Drop the problematic policy on gradebooks that causes recursion
DROP POLICY IF EXISTS "Trainees see own gradebooks" ON public.gradebooks;

-- Recreate using security definer function (no recursion)
CREATE POLICY "Trainees see own gradebooks"
ON public.gradebooks FOR SELECT
TO authenticated
USING (
  public.is_trainee_in_gradebook(auth.uid(), id)
  AND status IN ('submitted', 'hot_approved', 'ac_approved', 'finalised')
);

-- Drop and recreate the broad "View gradebook trainees" policy that causes recursion from the other side
DROP POLICY IF EXISTS "View gradebook trainees" ON public.gradebook_trainees;

-- Replace with a non-recursive policy: staff see via org, trainees see own
CREATE POLICY "Staff view gradebook trainees"
ON public.gradebook_trainees FOR SELECT
TO authenticated
USING (
  gradebook_id IN (
    SELECT g.id FROM public.gradebooks g
    WHERE g.organization_id IN (
      SELECT ur.organization_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  )
);

-- Similarly fix the broad "View components" policy which also references gradebooks
DROP POLICY IF EXISTS "View components" ON public.gradebook_components;
CREATE POLICY "View components"
ON public.gradebook_components FOR SELECT
TO authenticated
USING (
  gradebook_id IN (
    SELECT g.id FROM public.gradebooks g
    WHERE g.organization_id IN (
      SELECT ur.organization_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  )
  OR gradebook_id IN (SELECT public.get_trainee_gradebook_ids(auth.uid()))
);

-- Fix "View component groups" 
DROP POLICY IF EXISTS "View component groups" ON public.gradebook_component_groups;
CREATE POLICY "View component groups"
ON public.gradebook_component_groups FOR SELECT
TO authenticated
USING (
  gradebook_id IN (
    SELECT g.id FROM public.gradebooks g
    WHERE g.organization_id IN (
      SELECT ur.organization_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  )
  OR gradebook_id IN (SELECT public.get_trainee_gradebook_ids(auth.uid()))
);

-- Fix "Staff view marks" 
DROP POLICY IF EXISTS "Staff view marks" ON public.gradebook_marks;
CREATE POLICY "Staff view marks"
ON public.gradebook_marks FOR SELECT
TO authenticated
USING (
  gradebook_id IN (
    SELECT g.id FROM public.gradebooks g
    WHERE g.organization_id IN (
      SELECT ur.organization_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  )
);

-- Fix "Staff view ca scores"
DROP POLICY IF EXISTS "Staff view ca scores" ON public.gradebook_ca_scores;
CREATE POLICY "Staff view ca scores"
ON public.gradebook_ca_scores FOR SELECT
TO authenticated
USING (
  gradebook_id IN (
    SELECT g.id FROM public.gradebooks g
    WHERE g.organization_id IN (
      SELECT ur.organization_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  )
);

-- Fix "Staff view feedback"
DROP POLICY IF EXISTS "Staff view feedback" ON public.gradebook_feedback;
CREATE POLICY "Staff view feedback"
ON public.gradebook_feedback FOR SELECT
TO authenticated
USING (
  gradebook_id IN (
    SELECT g.id FROM public.gradebooks g
    WHERE g.organization_id IN (
      SELECT ur.organization_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  )
);
