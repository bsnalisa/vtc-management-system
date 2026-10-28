-- Closing two gaps in the role factory:
--  1. A brand-new position no longer needs an existing job: a "Staff Member" base role (app_role value staff_member) gives a person
--     a login and a place at the centre and NOTHING else. No policy, function or route names it, so it grants no access by itself;
--     everything a person can do comes from the roles made in the role factory that they are then assigned.
--  2. Widgets for the capabilities that had none (attendance, stock, own leave, own tickets, named trainees, outstanding fees).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff_member';

INSERT INTO public.custom_roles (role_code, role_name, description, is_system_role, active) VALUES
  ('staff_member', 'Staff Member', 'A staff login with no access of its own. Everything this person can do comes from the roles the Super Admin has defined in the role factory and the Organisation Admin has assigned.', true, true)
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO public.dashboard_widget_catalogue (code, title, description, capability, kind, sort_order) VALUES
  ('attendance.rate', 'Attendance', 'Attendance over the last 30 days. No names.', 'attendance.summary', 'stats', 45),
  ('stock.levels', 'Stock levels', 'Active stock items and the ones at or below their reorder level.', 'inventory.summary', 'stats', 85),
  ('leave.mine', 'My leave', 'Your own leave requests.', 'hr.own', 'stats', 95),
  ('tickets.mine', 'My support tickets', 'Support tickets you raised, by status.', 'tickets.own', 'stats', 96),
  ('trainees.recent', 'Recently registered trainees', 'The 15 most recent trainees of the centre, with names.', 'trainees.records', 'table', 25),
  ('fees.outstanding', 'Largest outstanding fees', 'The 10 largest unpaid balances for the latest academic year, with names.', 'fees.records', 'table', 55);

DO $$
DECLARE _def text; _old text; _new text;
BEGIN
  _def := pg_get_functiondef('public.dashboard_widget_data(uuid, text)'::regprocedure);
  _old := 'ELSE RAISE EXCEPTION ''Unknown widget'';';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'dashboard_widget_data: anchor not found'; END IF;
  _new := $w$
    WHEN 'attendance.rate' THEN
      RETURN jsonb_build_object('stats', (SELECT CASE WHEN x.total = 0 THEN '[]'::jsonb ELSE jsonb_build_array(
          jsonb_build_object('label', 'Records (last 30 days)', 'value', x.total), jsonb_build_object('label', 'Present', 'value', x.present),
          jsonb_build_object('label', 'Attendance rate', 'value', round(100.0 * x.present / x.total, 1), 'unit', '%')) END
        FROM (SELECT count(*) AS total, count(*) FILTER (WHERE a.present) AS present FROM public.attendance_records a JOIN public.trainees t ON t.id = a.trainee_id
               WHERE t.organization_id = _org AND a.attendance_date >= current_date - 30) x));
    WHEN 'stock.levels' THEN
      RETURN jsonb_build_object('stats', jsonb_build_array(
        jsonb_build_object('label', 'Active items', 'value', (SELECT count(*) FROM public.stock_items WHERE organization_id = _org AND active)),
        jsonb_build_object('label', 'At or below reorder level', 'value', (SELECT count(*) FROM public.stock_items WHERE organization_id = _org AND active AND reorder_level > 0 AND current_quantity <= reorder_level))));
    WHEN 'leave.mine' THEN
      RETURN jsonb_build_object('stats', jsonb_build_array(
        jsonb_build_object('label', 'Waiting for a decision', 'value', (SELECT count(*) FROM public.leave_requests WHERE organization_id = _org AND user_id = auth.uid() AND status = 'pending')),
        jsonb_build_object('label', 'Approved days this year', 'value', (SELECT coalesce(sum(days), 0) FROM public.leave_requests WHERE organization_id = _org AND user_id = auth.uid() AND status = 'approved' AND extract(year FROM start_date) = extract(year FROM current_date)))));
    WHEN 'tickets.mine' THEN
      RETURN jsonb_build_object('stats', jsonb_build_array(
        jsonb_build_object('label', 'Open', 'value', (SELECT count(*) FROM public.support_tickets WHERE organization_id = _org AND user_id = auth.uid() AND status = 'open')),
        jsonb_build_object('label', 'In progress', 'value', (SELECT count(*) FROM public.support_tickets WHERE organization_id = _org AND user_id = auth.uid() AND status = 'in_progress')),
        jsonb_build_object('label', 'Resolved', 'value', (SELECT count(*) FROM public.support_tickets WHERE organization_id = _org AND user_id = auth.uid() AND status IN ('resolved', 'closed')))));
    WHEN 'trainees.recent' THEN
      RETURN jsonb_build_object('columns', jsonb_build_array('Trainee no.', 'Name', 'Trade', 'Status'), 'rows', coalesce((SELECT jsonb_agg(jsonb_build_array(x.trainee_id, x.first_name || ' ' || x.last_name, x.trade, x.status) ORDER BY x.created_at DESC)
        FROM (SELECT t.trainee_id, t.first_name, t.last_name, tr.name AS trade, t.status::text AS status, t.created_at FROM public.trainees t LEFT JOIN public.trades tr ON tr.id = t.trade_id
               WHERE t.organization_id = _org ORDER BY t.created_at DESC LIMIT 15) x), '[]'::jsonb));
    WHEN 'fees.outstanding' THEN
      SELECT max(academic_year) INTO _year FROM public.fee_records WHERE organization_id = _org;
      RETURN jsonb_build_object('columns', jsonb_build_array('Trainee no.', 'Name', 'Balance (N$)'), 'rows', coalesce((SELECT jsonb_agg(jsonb_build_array(x.trainee_id, x.first_name || ' ' || x.last_name, x.balance) ORDER BY x.balance DESC)
        FROM (SELECT t.trainee_id, t.first_name, t.last_name, (f.total_fee - f.amount_paid) AS balance FROM public.fee_records f JOIN public.trainees t ON t.id = f.trainee_id
               WHERE f.organization_id = _org AND f.academic_year = _year AND f.total_fee > f.amount_paid ORDER BY (f.total_fee - f.amount_paid) DESC LIMIT 10) x), '[]'::jsonb));
    ELSE RAISE EXCEPTION 'Unknown widget';
  $w$;
  _def := replace(_def, _old, trim(both E'\n ' from replace(_new, E'    ELSE RAISE EXCEPTION ''Unknown widget'';' || E'\n  ', '')) || E'\n    ELSE RAISE EXCEPTION ''Unknown widget'';');
  EXECUTE _def;
END $$;

-- ---------------------------------------------------------------------------
-- 3. A Staff Member alone must really have no access
-- ---------------------------------------------------------------------------
-- Many older tables are readable by ANY person who holds a role at the centre ("Users can view ... in their organization": trainees,
-- fee and billing records, classes, stock, library, suppliers and more). A login whose only role is Staff Member would inherit that,
-- so every such table gets a RESTRICTIVE policy that closes it to a person holding nothing but Staff Member. The few tables a signed-in
-- person needs to open the app (own roles and profile, the centre's name, settings and modules, announcements, reporting lines) are left out.
-- New tables with an organisation-wide read policy need the same policy; supabase/tests/45_role_factory_gaps.sql fails when one is missing.
CREATE OR REPLACE FUNCTION private.is_base_staff_only(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user AND ur.role::text = 'staff_member')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user AND ur.role::text <> 'staff_member');
$$;
REVOKE ALL ON FUNCTION private.is_base_staff_only(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_base_staff_only(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.org_wide_read_tables() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.tablename::text FROM pg_policies p
   WHERE p.schemaname = 'public' AND p.permissive = 'PERMISSIVE' AND p.cmd IN ('SELECT', 'ALL')
     AND p.qual ~* 'get_user_organization|my_centre_ids'
     AND regexp_replace(p.qual, 'private\.is_super_admin\(auth\.uid\(\)\)', '', 'g') !~* 'has_role|has_org_role|is_admin|_staff|can_[a-z_]+\(|is_org_member|is_[a-z_]+\(auth'
     AND p.tablename NOT IN ('organization_modules', 'organization_packages', 'organization_settings', 'organizations', 'profiles', 'user_roles', 'custom_roles',
                             'system_configuration', 'password_policies', 'announcements', 'reporting_lines', 'user_supervisors');
$$;
REVOKE ALL ON FUNCTION private.org_wide_read_tables() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT private.org_wide_read_tables() LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff Member alone has no access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Staff Member alone has no access" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT (SELECT private.is_base_staff_only(auth.uid()))) WITH CHECK (NOT (SELECT private.is_base_staff_only(auth.uid())))', t);
  END LOOP;
END $$;
