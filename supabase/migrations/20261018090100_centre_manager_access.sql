-- Centre Manager access: read across their own centre, approve through workflows, change nothing directly.

-- ---------------------------------------------------------------------------
-- 1. The role must be assignable, and only a super admin may grant it (like the other top-level roles)
-- ---------------------------------------------------------------------------
INSERT INTO public.custom_roles (role_code, role_name, description, is_system_role, active) VALUES
  ('centre_manager', 'Centre Manager', 'Overall head of the centre: oversees results, finance, people and risks, and gives final approvals', true, true)
ON CONFLICT (role_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_privileged_roles()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid(); v_priv text[] := ARRAY['organization_admin', 'admin', 'centre_manager', 'super_admin', 'vms_developer', 'vms_support'];
BEGIN
  IF v_actor IS NULL OR public.is_super_admin(v_actor) THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.role::text = ANY (v_priv) THEN
    RAISE EXCEPTION 'Only a super admin can grant the % role', NEW.role;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role::text = ANY (v_priv) THEN
    RAISE EXCEPTION 'Only a super admin can change or remove the % role', OLD.role;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

-- ---------------------------------------------------------------------------
-- 2. Read access: one SELECT policy per table, only for the manager's own centre.
--    (The "Centre isolation" restrictive policy also applies, and nothing here grants writes.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'trainees', 'trainers', 'classes', 'qualifications', 'fee_records', 'invoices', 'payment_clearances',
    'hostel_fees', 'hostel_allocations', 'attendance_registers', 'qualification_results', 'gradebooks',
    'trainee_applications', 'support_tickets', 'deferral_requests', 'leave_requests', 'staff_records',
    'maintenance_tasks', 'assets', 'stock_items', 'graduation_ceremonies', 'registrations', 'announcements',
    'assessment_cycles', 'transcripts', 'bank_statement_lines', 'workflow_instances', 'assessment_sittings'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id') THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Centre managers read their centre" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Centre managers read their centre" ON public.%I FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, ARRAY[''centre_manager'']))', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. One call returns every dashboard figure for the caller's centre
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.centre_manager_overview(_org uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid := COALESCE(_org, public.get_user_organization(auth.uid()));
  v_today date := CURRENT_DATE;
  v_month date := date_trunc('month', CURRENT_DATE)::date;
  r jsonb := '{}'::jsonb;
  v_billed numeric; v_paid numeric; v_balance numeric; v_debtors integer;
  v_att_now numeric; v_att_prev numeric;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  -- Centre managers; Organization Admins may preview it; platform staff may open any centre
  IF NOT (public.is_platform_user() OR public.has_org_role(auth.uid(), v_org, ARRAY['centre_manager', 'organization_admin', 'admin'])) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;

  -- People in training
  r := r || jsonb_build_object('trainees', jsonb_build_object(
    'total', (SELECT count(*) FROM trainees WHERE organization_id = v_org),
    'active', (SELECT count(*) FROM trainees WHERE organization_id = v_org AND status = 'active'),
    'by_status', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'count', n) ORDER BY n DESC) FROM (SELECT status, count(*) n FROM trainees WHERE organization_id = v_org GROUP BY status) s), '[]'::jsonb),
    'by_trade', COALESCE((SELECT jsonb_agg(jsonb_build_object('trade', name, 'count', n) ORDER BY n DESC) FROM (
        SELECT COALESCE(tr.name, 'No trade') AS name, count(*) n FROM trainees t LEFT JOIN trades tr ON tr.id = t.trade_id
        WHERE t.organization_id = v_org AND t.status = 'active' GROUP BY 1 ORDER BY 2 DESC LIMIT 8) s), '[]'::jsonb)));

  -- Applications: this month, last month, and a six-month trend
  r := r || jsonb_build_object('applications', jsonb_build_object(
    'this_month', (SELECT count(*) FROM trainee_applications WHERE organization_id = v_org AND created_at >= v_month),
    'last_month', (SELECT count(*) FROM trainee_applications WHERE organization_id = v_org AND created_at >= v_month - interval '1 month' AND created_at < v_month),
    'trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'), 'count', n) ORDER BY m) FROM (
        SELECT gs AS m, (SELECT count(*) FROM trainee_applications a WHERE a.organization_id = v_org AND a.created_at >= gs AND a.created_at < gs + interval '1 month') AS n
        FROM generate_series(v_month - interval '5 months', v_month, interval '1 month') gs) s), '[]'::jsonb)));

  -- Teaching
  r := r || jsonb_build_object('teaching', jsonb_build_object(
    'classes', (SELECT count(*) FROM classes WHERE organization_id = v_org AND active),
    'trainers', (SELECT count(*) FROM trainers WHERE organization_id = v_org AND active)));

  -- Attendance: last 30 days against the 30 before
  SELECT round(100.0 * count(*) FILTER (WHERE ar.present) / NULLIF(count(*), 0), 1) INTO v_att_now
    FROM attendance_records ar JOIN attendance_registers rg ON rg.id = ar.register_id
    WHERE rg.organization_id = v_org AND ar.attendance_date > v_today - 30 AND ar.attendance_date <= v_today;
  SELECT round(100.0 * count(*) FILTER (WHERE ar.present) / NULLIF(count(*), 0), 1) INTO v_att_prev
    FROM attendance_records ar JOIN attendance_registers rg ON rg.id = ar.register_id
    WHERE rg.organization_id = v_org AND ar.attendance_date > v_today - 60 AND ar.attendance_date <= v_today - 30;
  r := r || jsonb_build_object('attendance', jsonb_build_object('rate', v_att_now, 'previous', v_att_prev));

  -- Results
  r := r || jsonb_build_object('results', jsonb_build_object(
    'by_status', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', result_status, 'count', n) ORDER BY n DESC) FROM (SELECT COALESCE(result_status, 'pending') AS result_status, count(*) n FROM qualification_results WHERE organization_id = v_org GROUP BY 1) s), '[]'::jsonb),
    'awaiting_approval', (SELECT count(*) FROM qualification_results WHERE organization_id = v_org AND approved_by IS NULL),
    'open_cycles', (SELECT count(*) FROM assessment_cycles WHERE organization_id = v_org AND status <> 'locked')));

  -- Money
  SELECT COALESCE(sum(total_fee), 0), COALESCE(sum(amount_paid), 0), COALESCE(sum(balance), 0), count(*) FILTER (WHERE balance > 0)
    INTO v_billed, v_paid, v_balance, v_debtors FROM fee_records WHERE organization_id = v_org;
  r := r || jsonb_build_object('finance', jsonb_build_object(
    'billed', v_billed, 'collected', v_paid, 'outstanding', v_balance, 'debtors', v_debtors,
    'collection_rate', CASE WHEN v_billed > 0 THEN round(100.0 * v_paid / v_billed, 1) END,
    'hostel_overdue_count', (SELECT count(*) FROM hostel_fees WHERE organization_id = v_org AND balance > 0 AND due_date < v_today),
    'hostel_overdue_amount', (SELECT COALESCE(sum(balance), 0) FROM hostel_fees WHERE organization_id = v_org AND balance > 0 AND due_date < v_today),
    'unreconciled_bank_lines', (SELECT count(*) FROM bank_statement_lines WHERE organization_id = v_org AND status NOT IN ('applied', 'ignored'))));

  -- People who work at the centre
  r := r || jsonb_build_object('people', jsonb_build_object(
    'staff', (SELECT count(DISTINCT user_id) FROM user_roles WHERE organization_id = v_org AND role::text <> 'trainee'),
    'on_leave_today', (SELECT count(*) FROM leave_requests WHERE organization_id = v_org AND status = 'approved' AND v_today BETWEEN start_date AND end_date),
    'leave_pending', (SELECT count(*) FROM leave_requests WHERE organization_id = v_org AND status = 'pending')));

  -- Things that need attention
  r := r || jsonb_build_object('attention', jsonb_build_object(
    'open_tickets', (SELECT count(*) FROM support_tickets WHERE organization_id = v_org AND status IN ('open', 'in_progress')),
    'deferrals_pending', (SELECT count(*) FROM deferral_requests WHERE organization_id = v_org AND status = 'submitted'),
    'maintenance_open', (SELECT count(*) FROM maintenance_tasks WHERE organization_id = v_org AND status NOT IN ('completed', 'cancelled')),
    'workflows_running', (SELECT count(*) FROM workflow_instances WHERE organization_id = v_org AND status IN ('in_progress', 'awaiting_info')),
    'oldest_workflow_days', (SELECT floor(extract(epoch FROM now() - min(started_at)) / 86400)::int FROM workflow_instances WHERE organization_id = v_org AND status IN ('in_progress', 'awaiting_info'))));

  RETURN r || jsonb_build_object('generated_at', now(), 'organization_id', v_org);
END $$;
REVOKE ALL ON FUNCTION public.centre_manager_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.centre_manager_overview(uuid) TO authenticated, service_role;
