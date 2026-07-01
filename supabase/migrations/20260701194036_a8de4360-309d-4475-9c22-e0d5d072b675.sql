
-- ============ PROFILES ============
REVOKE ALL ON public.profiles FROM anon;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ TRAINEES ============
REVOKE ALL ON public.trainees FROM anon;

DROP POLICY IF EXISTS "Users can view trainees in their organization" ON public.trainees;
CREATE POLICY "Users can view trainees in their organization"
  ON public.trainees
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (organization_id = get_user_organization(auth.uid()))
  );

DROP POLICY IF EXISTS "Authorized users can manage trainees in their organization" ON public.trainees;
CREATE POLICY "Authorized users can manage trainees in their organization"
  ON public.trainees
  FOR ALL
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (
      organization_id = get_user_organization(auth.uid())
      AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role))
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      organization_id = get_user_organization(auth.uid())
      AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role))
    )
  );

-- Trainees can view their own record
DROP POLICY IF EXISTS "Trainees can view their own record" ON public.trainees;
CREATE POLICY "Trainees can view their own record"
  ON public.trainees
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============ MARKS ============
REVOKE ALL ON public.marks FROM anon;

DROP POLICY IF EXISTS "Trainees can view their own marks" ON public.marks;
CREATE POLICY "Trainees can view their own marks"
  ON public.marks
  FOR SELECT
  TO authenticated
  USING (
    (trainee_id IN (SELECT trainees.id FROM trainees WHERE trainees.user_id = auth.uid()))
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'trainer'::app_role)
    OR has_role(auth.uid(), 'assessment_coordinator'::app_role)
    OR has_role(auth.uid(), 'hod'::app_role)
  );

DROP POLICY IF EXISTS "Trainers can insert marks" ON public.marks;
CREATE POLICY "Trainers can insert marks"
  ON public.marks
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'trainer'::app_role) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Trainers can update unlocked marks" ON public.marks;
CREATE POLICY "Trainers can update unlocked marks"
  ON public.marks
  FOR UPDATE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'trainer'::app_role) AND is_locked = false)
    OR has_role(auth.uid(), 'assessment_coordinator'::app_role)
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    (has_role(auth.uid(), 'trainer'::app_role) AND is_locked = false)
    OR has_role(auth.uid(), 'assessment_coordinator'::app_role)
    OR is_admin(auth.uid())
  );

-- Deny-all fallback so any query without a matching policy returns nothing
DROP POLICY IF EXISTS "Deny anonymous access to marks" ON public.marks;
CREATE POLICY "Deny anonymous access to marks"
  ON public.marks
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny anonymous access to trainees" ON public.trainees;
CREATE POLICY "Deny anonymous access to trainees"
  ON public.trainees
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
CREATE POLICY "Deny anonymous access to profiles"
  ON public.profiles
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
