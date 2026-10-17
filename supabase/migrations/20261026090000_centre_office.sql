-- Phase 5: the Centre Manager's office and executive view.
--  * PA to the Centre Manager keeps the office registers (correspondence, meetings, tasks). The PA has no approval
--    authority of their own: they can only decide requests the Centre Manager has explicitly delegated through
--    workflow_delegations, and they cannot read finance, personnel or trainee records (none of those policies include the role).
--  * The Centre Manager reads the registers (read-only) and gets an executive summary of escalated approvals and each
--    department's workload and performance.
-- Registers are read-only for clients; every change goes through the functions below.

-- ---------------------------------------------------------------------------
-- 1. Registers
-- ---------------------------------------------------------------------------
CREATE TABLE public.office_correspondence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  subject text NOT NULL,
  party text NOT NULL,
  channel text NOT NULL DEFAULT 'letter' CHECK (channel IN ('letter','email','phone','visit','other')),
  item_date date NOT NULL DEFAULT current_date,
  due_on date,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_progress','replied','filed','closed')),
  handling_note text,
  document_path text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);
CREATE INDEX idx_office_correspondence_org ON public.office_correspondence (organization_id, status, due_on);

CREATE TABLE public.office_meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_date date NOT NULL,
  start_time time, end_time time,
  location text, attendees text, agenda text, minutes text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','held','cancelled')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
);
CREATE INDEX idx_office_meetings_org ON public.office_meetings (organization_id, meeting_date);

CREATE TABLE public.office_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text,
  due_on date,
  source text NOT NULL DEFAULT 'centre_manager' CHECK (source IN ('centre_manager','self','meeting','correspondence')),
  correspondence_id uuid REFERENCES public.office_correspondence(id),
  meeting_id uuid REFERENCES public.office_meetings(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  completed_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_office_tasks_org ON public.office_tasks (organization_id, status, due_on);

DO $$
DECLARE t text; expr text := 'NOT (SELECT public.is_centre_scoped_user()) OR (%1$I.organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['office_correspondence','office_meetings','office_tasks'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Centre office read" ON public.%I FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, ARRAY[''pa_to_centre_manager'',''centre_manager'']))', t);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (' || expr || ') WITH CHECK (' || expr || ')', t, t, t);
  END LOOP;
END $$;

-- items are never deleted; a finished task or closed letter stays on the register
CREATE OR REPLACE FUNCTION public.office_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Office records cannot be deleted'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['office_correspondence','office_meetings','office_tasks'] LOOP
    EXECUTE format('CREATE TRIGGER trg_office_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.office_guard()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Writes (PA to the Centre Manager only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.office_assert(_org uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['pa_to_centre_manager']) THEN RAISE EXCEPTION 'Not authorised'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.office_assert(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.office_log_correspondence(_direction text, _subject text, _party text, _channel text DEFAULT 'letter',
  _item_date date DEFAULT current_date, _due date DEFAULT NULL, _document text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _id uuid; _n integer; _ref text;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM public.office_assert(_org);
  IF nullif(trim(coalesce(_subject, '')), '') IS NULL OR nullif(trim(coalesce(_party, '')), '') IS NULL THEN RAISE EXCEPTION 'Enter the subject and who it is from or to'; END IF;
  IF _due IS NOT NULL AND _due < _item_date THEN RAISE EXCEPTION 'The due date is before the date of the item'; END IF;
  IF _document IS NOT NULL AND _document NOT LIKE _org::text || '/%' THEN RAISE EXCEPTION 'Document must be stored under the centre''s folder'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('office_cor_' || _org::text));
  SELECT count(*) + 1 INTO _n FROM public.office_correspondence WHERE organization_id = _org AND reference LIKE 'COR-' || to_char(_item_date, 'YYYY') || '-%';
  _ref := 'COR-' || to_char(_item_date, 'YYYY') || '-' || lpad(_n::text, 4, '0');
  INSERT INTO public.office_correspondence (organization_id, reference, direction, subject, party, channel, item_date, due_on, status, document_path)
    VALUES (_org, _ref, _direction, trim(_subject), trim(_party), _channel, _item_date, _due, CASE WHEN _direction = 'outgoing' THEN 'replied' ELSE 'received' END, _document)
    RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.office_log_correspondence(text, text, text, text, date, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_set_correspondence_status(_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM public.office_correspondence WHERE id = _id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;
  PERFORM public.office_assert(_org);
  IF _status NOT IN ('received','in_progress','replied','filed','closed') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  UPDATE public.office_correspondence SET status = _status, handling_note = coalesce(nullif(trim(coalesce(_note, '')), ''), handling_note) WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.office_set_correspondence_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_add_meeting(_title text, _date date, _start time DEFAULT NULL, _end time DEFAULT NULL,
  _location text DEFAULT NULL, _attendees text DEFAULT NULL, _agenda text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _id uuid;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM public.office_assert(_org);
  IF nullif(trim(coalesce(_title, '')), '') IS NULL OR _date IS NULL THEN RAISE EXCEPTION 'Enter a title and a date'; END IF;
  INSERT INTO public.office_meetings (organization_id, title, meeting_date, start_time, end_time, location, attendees, agenda)
    VALUES (_org, trim(_title), _date, _start, _end, nullif(trim(coalesce(_location, '')), ''), nullif(trim(coalesce(_attendees, '')), ''), nullif(trim(coalesce(_agenda, '')), ''))
    RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.office_add_meeting(text, date, time, time, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_update_meeting(_id uuid, _status text, _minutes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM public.office_meetings WHERE id = _id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Meeting not found'; END IF;
  PERFORM public.office_assert(_org);
  IF _status NOT IN ('scheduled','held','cancelled') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  UPDATE public.office_meetings SET status = _status, minutes = coalesce(nullif(trim(coalesce(_minutes, '')), ''), minutes) WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.office_update_meeting(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_add_task(_title text, _due date DEFAULT NULL, _detail text DEFAULT NULL, _source text DEFAULT 'centre_manager',
  _correspondence uuid DEFAULT NULL, _meeting uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _id uuid;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM public.office_assert(_org);
  IF nullif(trim(coalesce(_title, '')), '') IS NULL THEN RAISE EXCEPTION 'Describe the task'; END IF;
  IF _correspondence IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.office_correspondence WHERE id = _correspondence AND organization_id = _org) THEN RAISE EXCEPTION 'Correspondence not found'; END IF;
  IF _meeting IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.office_meetings WHERE id = _meeting AND organization_id = _org) THEN RAISE EXCEPTION 'Meeting not found'; END IF;
  INSERT INTO public.office_tasks (organization_id, title, detail, due_on, source, correspondence_id, meeting_id)
    VALUES (_org, trim(_title), nullif(trim(coalesce(_detail, '')), ''), _due, _source, _correspondence, _meeting) RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.office_add_task(text, date, text, text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_set_task_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM public.office_tasks WHERE id = _id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  PERFORM public.office_assert(_org);
  IF _status NOT IN ('open','done','cancelled') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  UPDATE public.office_tasks SET status = _status, completed_at = CASE WHEN _status = 'done' THEN now() END WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.office_set_task_status(uuid, text) TO authenticated;

-- Delegations the PA works under, and the decisions taken under them (the Centre Manager sees the same list)
CREATE OR REPLACE FUNCTION public.office_delegation_log()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid());
BEGIN
  IF _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['pa_to_centre_manager','centre_manager']) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN jsonb_build_object(
    'delegations', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'from', pf.full_name, 'to', pt.full_name, 'process_type', d.process_type,
        'starts_at', d.starts_at, 'ends_at', d.ends_at, 'active', d.active AND now() BETWEEN d.starts_at AND d.ends_at) ORDER BY d.starts_at DESC)
      FROM public.workflow_delegations d
      LEFT JOIN public.profiles pf ON pf.user_id = d.from_user LEFT JOIN public.profiles pt ON pt.user_id = d.to_user
      WHERE d.organization_id = _org AND public.has_org_role(d.to_user, _org, ARRAY['pa_to_centre_manager'])), '[]'::jsonb),
    'decisions', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'acted_at') DESC) FROM (
        SELECT jsonb_build_object('reference', i.reference, 'title', i.title, 'step', t.step_name, 'outcome', t.status, 'acted_at', t.acted_at, 'by', pa.full_name) AS x
        FROM public.workflow_tasks t
        JOIN public.workflow_instances i ON i.id = t.instance_id
        LEFT JOIN public.profiles pa ON pa.user_id = t.acted_by
        WHERE i.organization_id = _org AND t.acted_at > now() - interval '90 days'
          AND public.has_org_role(t.acted_by, _org, ARRAY['pa_to_centre_manager'])
        ORDER BY t.acted_at DESC LIMIT 50) s), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.office_delegation_log() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Executive view for the Centre Manager
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.centre_manager_executive(_org uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid := COALESCE(_org, public.get_user_organization(auth.uid()));
  v_today date := CURRENT_DATE;
  v_month date := date_trunc('month', CURRENT_DATE)::date;
  d record; r jsonb := '[]'::jsonb; roles text[]; k jsonb; v_billed numeric; v_paid numeric;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT (public.is_platform_user() OR public.has_org_role(auth.uid(), v_org, ARRAY['centre_manager','organization_admin','admin'])) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;

  FOR d IN SELECT * FROM (VALUES
    ('finance', 'Finance and Administration', ARRAY['head_of_finance_admin','accountant','creditors_officer','debtor_officer','loan_officer','asset_maintenance_coordinator','maintenance_coordinator','procurement_officer','stock_control_officer','hr_officer']),
    ('training', 'Training', ARRAY['head_of_training','hod','trainer','assessment_coordinator','rpl_coordinator','subject_matter_expert']),
    ('trainee_support', 'Trainee Support', ARRAY['head_of_trainee_support','liaison_officer','placement_officer','registration_officer','resource_center_coordinator','librarian','hostel_coordinator']),
    ('projects', 'Projects and Business Development', ARRAY['projects_coordinator','bdl_coordinator'])
  ) AS t(code, name, member_roles) LOOP
    roles := d.member_roles;
    k := '{}'::jsonb;
    IF d.code = 'finance' THEN
      SELECT COALESCE(sum(total_fee), 0), COALESCE(sum(amount_paid), 0) INTO v_billed, v_paid FROM fee_records WHERE organization_id = v_org;
      k := jsonb_build_object('collection_rate', CASE WHEN v_billed > 0 THEN round(100.0 * v_paid / v_billed, 1) END,
        'unreconciled_bank_lines', (SELECT count(*) FROM bank_statement_lines WHERE organization_id = v_org AND status NOT IN ('applied','ignored')),
        'nsfaf_payments_awaiting_reconciliation', (SELECT count(*) FROM funding_payments WHERE organization_id = v_org AND reconciliation_status IN ('pending_finance','discrepancy','follow_up')));
    ELSIF d.code = 'training' THEN
      k := jsonb_build_object(
        'attendance_rate', (SELECT round(100.0 * count(*) FILTER (WHERE ar.present) / NULLIF(count(*), 0), 1) FROM attendance_records ar JOIN attendance_registers rg ON rg.id = ar.register_id
            WHERE rg.organization_id = v_org AND ar.attendance_date > v_today - 30 AND ar.attendance_date <= v_today),
        'results_awaiting_approval', (SELECT count(*) FROM qualification_results WHERE organization_id = v_org AND approved_by IS NULL),
        'open_assessment_cycles', (SELECT count(*) FROM assessment_cycles WHERE organization_id = v_org AND status <> 'locked'));
    ELSIF d.code = 'trainee_support' THEN
      k := jsonb_build_object(
        'applications_this_month', (SELECT count(*) FROM trainee_applications WHERE organization_id = v_org AND created_at >= v_month),
        'open_tickets', (SELECT count(*) FROM support_tickets WHERE organization_id = v_org AND status IN ('open','in_progress')),
        'deferrals_pending', (SELECT count(*) FROM deferral_requests WHERE organization_id = v_org AND status = 'submitted'));
    END IF;
    r := r || jsonb_build_array(jsonb_build_object(
      'code', d.code, 'name', d.name,
      'staff', (SELECT count(DISTINCT user_id) FROM user_roles WHERE organization_id = v_org AND role::text = ANY (roles)),
      'pending', (SELECT count(*) FROM workflow_instances WHERE organization_id = v_org AND status IN ('in_progress','awaiting_info') AND submitter_role = ANY (roles)),
      'overdue', (SELECT count(DISTINCT i.id) FROM workflow_instances i JOIN workflow_tasks t ON t.instance_id = i.id
                  WHERE i.organization_id = v_org AND i.status IN ('in_progress','awaiting_info') AND i.submitter_role = ANY (roles) AND t.status = 'pending' AND t.due_at < now()),
      'escalated', (SELECT count(*) FROM workflow_instances WHERE organization_id = v_org AND status IN ('in_progress','awaiting_info') AND escalated AND submitter_role = ANY (roles)),
      'approved_30d', (SELECT count(*) FROM workflow_instances WHERE organization_id = v_org AND status = 'approved' AND completed_at > now() - interval '30 days' AND submitter_role = ANY (roles)),
      'rejected_30d', (SELECT count(*) FROM workflow_instances WHERE organization_id = v_org AND status = 'rejected' AND completed_at > now() - interval '30 days' AND submitter_role = ANY (roles)),
      'avg_days_to_decide', (SELECT round((avg(extract(epoch FROM completed_at - started_at)) / 86400)::numeric, 1) FROM workflow_instances
                             WHERE organization_id = v_org AND status IN ('approved','rejected') AND completed_at > now() - interval '30 days' AND submitter_role = ANY (roles)),
      'kpis', k));
  END LOOP;

  RETURN jsonb_build_object(
    'escalated', COALESCE((SELECT jsonb_agg(x ORDER BY (x->>'started_at')) FROM (
        SELECT jsonb_build_object('id', i.id, 'reference', i.reference, 'title', i.title, 'process_type', i.process_type, 'submitter_role', i.submitter_role,
               'next_action', i.next_action, 'started_at', i.started_at, 'days_open', floor(extract(epoch FROM now() - i.started_at) / 86400)::int) AS x
        FROM workflow_instances i
        WHERE i.organization_id = v_org AND i.status IN ('in_progress','awaiting_info')
          AND (i.escalated OR EXISTS (SELECT 1 FROM workflow_tasks t WHERE t.instance_id = i.id AND t.status = 'pending' AND t.due_at < now() - interval '2 days'))
        ORDER BY i.started_at LIMIT 25) s), '[]'::jsonb),
    'departments', r,
    'office', jsonb_build_object(
      'correspondence_open', (SELECT count(*) FROM office_correspondence WHERE organization_id = v_org AND status IN ('received','in_progress')),
      'correspondence_overdue', (SELECT count(*) FROM office_correspondence WHERE organization_id = v_org AND status IN ('received','in_progress') AND due_on < v_today),
      'meetings_next_7_days', (SELECT count(*) FROM office_meetings WHERE organization_id = v_org AND status = 'scheduled' AND meeting_date BETWEEN v_today AND v_today + 7),
      'tasks_open', (SELECT count(*) FROM office_tasks WHERE organization_id = v_org AND status = 'open'),
      'tasks_overdue', (SELECT count(*) FROM office_tasks WHERE organization_id = v_org AND status = 'open' AND due_on < v_today)),
    'generated_at', now(), 'organization_id', v_org);
END $$;
REVOKE ALL ON FUNCTION public.centre_manager_executive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.centre_manager_executive(uuid) TO authenticated, service_role;
