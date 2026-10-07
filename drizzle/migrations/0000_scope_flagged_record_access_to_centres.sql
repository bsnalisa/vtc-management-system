CREATE OR REPLACE FUNCTION public.has_centre_role(_organization_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.organization_id = _organization_id
        AND ur.role::text = ANY(_roles)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.has_centre_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_centre_role(uuid, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_attendance_record(_register_id uuid, _trainee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.trainees t WHERE t.id = _trainee_id AND t.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.attendance_registers ar
      WHERE ar.id = _register_id AND public.has_centre_role(ar.organization_id,
        ARRAY['admin','organization_admin','trainer','hod','head_of_training','assessment_coordinator'])
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_attendance_record(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_attendance_record(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_manage_attendance_record(_register_id uuid, _trainee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.attendance_registers ar JOIN public.trainees t ON t.id = _trainee_id
      WHERE ar.id = _register_id AND t.organization_id = ar.organization_id
        AND public.has_centre_role(ar.organization_id, ARRAY['admin','organization_admin','trainer'])
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_attendance_record(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_attendance_record(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can view attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Trainers and admins can manage attendance records" ON public.attendance_records;
CREATE POLICY "Scoped attendance reads" ON public.attendance_records FOR SELECT TO authenticated
USING (public.can_read_attendance_record(register_id, trainee_id));
CREATE POLICY "Scoped attendance management" ON public.attendance_records FOR ALL TO authenticated
USING (public.can_manage_attendance_record(register_id, trainee_id))
WITH CHECK (public.can_manage_attendance_record(register_id, trainee_id));

DROP POLICY IF EXISTS "Authenticated users can view generation runs" ON public.timetable_generation_runs;
DROP POLICY IF EXISTS "HoT and admin can manage generation runs" ON public.timetable_generation_runs;
CREATE POLICY "Scoped generation history reads" ON public.timetable_generation_runs FOR SELECT TO authenticated
USING (public.has_centre_role(organization_id, ARRAY['admin','organization_admin','head_of_training','hod','trainer','assessment_coordinator']));
CREATE POLICY "Scoped generation management" ON public.timetable_generation_runs FOR ALL TO authenticated
USING (public.has_centre_role(organization_id, ARRAY['admin','organization_admin','head_of_training']))
WITH CHECK (public.has_centre_role(organization_id, ARRAY['admin','organization_admin','head_of_training']));

DROP POLICY IF EXISTS "All authenticated users can view role permissions" ON public.role_permissions;
CREATE POLICY "Relevant role permissions reads" ON public.role_permissions FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = role_permissions.role_code) OR
  EXISTS (
    SELECT 1 FROM public.custom_roles cr WHERE cr.role_code = role_permissions.role_code AND (
      (cr.is_system_role AND public.has_centre_role(public.get_user_organization(auth.uid()), ARRAY['admin','organization_admin'])) OR
      (NOT cr.is_system_role AND public.has_centre_role(cr.organization_id, ARRAY['admin','organization_admin']))
    )
  )
);
REVOKE ALL ON public.role_permissions, public.attendance_records, public.timetable_generation_runs FROM anon;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records, public.timetable_generation_runs TO authenticated;
GRANT ALL ON public.role_permissions, public.attendance_records, public.timetable_generation_runs TO service_role;