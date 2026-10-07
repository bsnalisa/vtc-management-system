CREATE OR REPLACE FUNCTION public.can_read_centre_assessment(_course_id uuid, _academic_year text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT auth.uid() IS NOT NULL AND (
  public.is_super_admin(auth.uid()) OR EXISTS (
   SELECT 1 FROM public.courses c JOIN public.trades tr ON tr.id = c.trade_id
   WHERE c.id = _course_id AND (
    public.has_centre_role(tr.organization_id, ARRAY['admin','organization_admin','head_of_training','hod','assessment_coordinator','registration_officer','trainer'])
    OR EXISTS (
     SELECT 1 FROM public.trainee_enrollments e JOIN public.trainees t ON t.id = e.trainee_id
     WHERE e.course_id = c.id AND e.academic_year = _academic_year
      AND t.user_id = auth.uid() AND t.organization_id = tr.organization_id
    )
   )
  )
 );
$$;
CREATE OR REPLACE FUNCTION public.can_read_centre_trainer_assignment(_trainer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT auth.uid() IS NOT NULL AND (
  public.is_super_admin(auth.uid()) OR EXISTS (
   SELECT 1 FROM public.trainers t WHERE t.id = _trainer_id AND (
    t.user_id = auth.uid() OR public.has_centre_role(t.organization_id,
      ARRAY['admin','organization_admin','head_of_training','hod','assessment_coordinator','registration_officer'])
   )
  )
 );
$$;
REVOKE ALL ON FUNCTION public.can_read_centre_assessment(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_centre_trainer_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_centre_assessment(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_centre_trainer_assignment(uuid) TO authenticated, service_role;
DROP POLICY "Authenticated users can view assessments" ON public.assessments;
CREATE POLICY "Centre staff and enrolled trainees can view assessments" ON public.assessments FOR SELECT TO authenticated USING (public.can_read_centre_assessment(course_id, academic_year));
DROP POLICY "Authenticated users can view trainer trades" ON public.trainer_trades;
DROP POLICY "Admins and HoT can manage trainer trades" ON public.trainer_trades;
CREATE POLICY "Centre staff and assigned trainers can view trainer trades" ON public.trainer_trades FOR SELECT TO authenticated USING (public.can_read_centre_trainer_assignment(trainer_id));
CREATE POLICY "Admins and HoT can insert trainer trades" ON public.trainer_trades FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'head_of_training'::public.app_role));
CREATE POLICY "Admins and HoT can update trainer trades" ON public.trainer_trades FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'head_of_training'::public.app_role)) WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'head_of_training'::public.app_role));
CREATE POLICY "Admins and HoT can delete trainer trades" ON public.trainer_trades FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'head_of_training'::public.app_role));
REVOKE SELECT ON public.assessments, public.trainer_trades FROM anon;
GRANT SELECT ON public.assessments, public.trainer_trades TO authenticated;
GRANT ALL ON public.assessments, public.trainer_trades TO service_role;