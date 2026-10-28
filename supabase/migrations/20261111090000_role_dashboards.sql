-- Role dashboards (phase 6 of docs/requisition-and-org-structure-plan.md).
-- A role made in the role factory gets a dashboard built from a fixed catalogue of widgets. The widget list is part
-- of the role's version (chosen while it is a draft, frozen when submitted, applied only when a Super Admin approves),
-- and every widget reads through `dashboard_widget_data`, which checks that the caller holds the widget on an active
-- assignment at that centre AND still holds the capability the widget needs, and filters every figure to that centre.
-- A new role therefore gets a dashboard but no access to anything it was not granted.

-- ---------------------------------------------------------------------------
-- 1. Catalogue and role configuration
-- ---------------------------------------------------------------------------
CREATE TABLE public.dashboard_widget_catalogue (
  code text PRIMARY KEY CHECK (code ~ '^[a-z]+(_[a-z]+)*\.[a-z_]+$'),
  title text NOT NULL, description text NOT NULL,
  capability text NOT NULL REFERENCES public.role_capability_catalogue(code),
  kind text NOT NULL CHECK (kind IN ('stats', 'bars', 'table')),
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO public.dashboard_widget_catalogue (code, title, description, capability, kind, sort_order) VALUES
  ('centre.headcounts', 'Centre at a glance', 'Active trainees, approved classes and active trainers.', 'centre.overview', 'stats', 10),
  ('trainees.by_trade', 'Trainees by trade', 'Active trainees in each trade. No names.', 'trainees.summary', 'bars', 20),
  ('classes.overview', 'Classes', 'Approved classes with their capacity and enrolment.', 'classes.view', 'table', 30),
  ('assessment.pass_rate', 'Assessment results', 'Decided results, passes and results still waiting for approval. No names.', 'assessment.summary', 'stats', 40),
  ('fees.collection', 'Fee collection', 'Billed and collected for the latest academic year. No names.', 'fees.summary', 'stats', 50),
  ('requisitions.mine', 'My requisitions', 'Requisitions you made, by status.', 'requisitions.own', 'bars', 60),
  ('requisitions.centre', 'All requisitions', 'Every requisition of the centre, by status.', 'requisitions.centre', 'bars', 70),
  ('procurement.pipeline', 'Procurement pipeline', 'Approved requisitions waiting for an order, orders placed and deliveries.', 'procurement.summary', 'stats', 80),
  ('approvals.waiting', 'Approvals waiting for me', 'Approvals assigned to you and how many are overdue.', 'approvals.inbox', 'stats', 90),
  ('hr.staffing', 'Staff at the centre', 'Staff and trainers in post.', 'hr.centre_summary', 'stats', 100);
ALTER TABLE public.dashboard_widget_catalogue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff read the widget catalogue" ON public.dashboard_widget_catalogue FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dashboard_widget_catalogue FROM anon, authenticated;

ALTER TABLE public.factory_role_versions
  ADD COLUMN IF NOT EXISTS dashboard_widgets text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS approved_widgets text[];

-- a submitted version also keeps its widget list
CREATE OR REPLACE FUNCTION public.factory_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'A submitted version is kept for the record' USING ERRCODE = '42501'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (NEW.job_description IS DISTINCT FROM OLD.job_description OR NEW.selected_capabilities IS DISTINCT FROM OLD.selected_capabilities
      OR NEW.dashboard_widgets IS DISTINCT FROM OLD.dashboard_widgets
      OR NEW.proposal_capabilities IS DISTINCT FROM OLD.proposal_capabilities OR NEW.proposal_method IS DISTINCT FROM OLD.proposal_method OR NEW.version IS DISTINCT FROM OLD.version OR NEW.role_id IS DISTINCT FROM OLD.role_id) THEN
    RAISE EXCEPTION 'A submitted version can never be edited; make a new version' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The role factory carries the widget list
-- ---------------------------------------------------------------------------
DO $$
DECLARE _def text; _old text;
BEGIN
  _def := pg_get_functiondef('public.role_factory_submit(uuid)'::regprocedure);
  _old := 'UPDATE public.factory_role_versions SET status = ''pending_review'', submitted_at = now() WHERE id = _version;';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'role_factory_submit: anchor not found'; END IF;
  _def := replace(_def, _old, 'IF EXISTS (SELECT 1 FROM unnest(v.dashboard_widgets) w WHERE NOT EXISTS (SELECT 1 FROM public.dashboard_widget_catalogue c WHERE c.code = w AND c.active AND c.capability = ANY (v.selected_capabilities))) THEN RAISE EXCEPTION ''A dashboard widget needs a capability this role does not have; update the widgets''; END IF;' || E'\n  ' || _old);
  EXECUTE _def;

  _def := pg_get_functiondef('public.role_factory_decide(uuid, boolean, text, boolean)'::regprocedure);
  _old := 'UPDATE public.factory_role_versions SET status = ''approved'', approved_capabilities = v.selected_capabilities,';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'role_factory_decide: anchor not found'; END IF;
  _def := replace(_def, _old, 'UPDATE public.factory_role_versions SET status = ''approved'', approved_widgets = ARRAY(SELECT w FROM unnest(v.dashboard_widgets) w WHERE EXISTS (SELECT 1 FROM public.dashboard_widget_catalogue c WHERE c.code = w AND c.active AND c.capability = ANY (v.selected_capabilities))), approved_capabilities = v.selected_capabilities,');
  EXECUTE _def;

  _def := pg_get_functiondef('public.role_factory_overview()'::regprocedure);
  _old := '''proposal_note'', v.proposal_note,';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'role_factory_overview: anchor not found'; END IF;
  _def := replace(_def, _old, '''proposal_note'', v.proposal_note, ''dashboard_widgets'', v.dashboard_widgets, ''approved_widgets'', v.approved_widgets,');
  EXECUTE _def;

  _def := pg_get_functiondef('public.role_factory_new_version(uuid)'::regprocedure);
  _old := '(role_id, version, job_description, reports_to_role, selected_capabilities, created_by)';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'role_factory_new_version: column anchor not found'; END IF;
  _def := replace(_def, _old, '(role_id, version, job_description, reports_to_role, selected_capabilities, dashboard_widgets, created_by)');
  _old := 'coalesce(v.approved_capabilities, v.selected_capabilities), auth.uid())';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'role_factory_new_version: value anchor not found'; END IF;
  _def := replace(_def, _old, 'coalesce(v.approved_capabilities, v.selected_capabilities), coalesce(v.approved_widgets, v.dashboard_widgets), auth.uid())');
  EXECUTE _def;
END $$;

CREATE OR REPLACE FUNCTION public.role_factory_save_widgets(_version uuid, _widgets text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.factory_role_versions%ROWTYPE; w text; _clean text[] := ARRAY[]::text[];
BEGIN
  PERFORM private.factory_super();
  SELECT * INTO v FROM public.factory_role_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;
  IF v.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be edited'; END IF;
  FOREACH w IN ARRAY coalesce(_widgets, ARRAY[]::text[]) LOOP
    IF w = ANY (_clean) THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dashboard_widget_catalogue c WHERE c.code = w AND c.active) THEN RAISE EXCEPTION 'Unknown widget: %', w; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dashboard_widget_catalogue c WHERE c.code = w AND c.capability = ANY (v.selected_capabilities)) THEN
      RAISE EXCEPTION 'The widget "%" needs the capability % which this role does not have', w, (SELECT c.capability FROM public.dashboard_widget_catalogue c WHERE c.code = w);
    END IF;
    _clean := _clean || w;
  END LOOP;
  UPDATE public.factory_role_versions SET dashboard_widgets = _clean WHERE id = _version;
END $$;

CREATE OR REPLACE FUNCTION public.dashboard_widget_catalogue_list() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN '[]'::jsonb ELSE coalesce(jsonb_agg(jsonb_build_object('code', w.code, 'title', w.title, 'description', w.description, 'capability', w.capability, 'kind', w.kind,
           'sensitive', k.sensitive) ORDER BY w.sort_order), '[]'::jsonb) END
    FROM public.dashboard_widget_catalogue w JOIN public.role_capability_catalogue k ON k.code = w.capability WHERE w.active;
$$;

-- ---------------------------------------------------------------------------
-- 3. What a person's dashboard shows, and the data behind each widget
-- ---------------------------------------------------------------------------
-- does this person hold the widget through an active, approved assignment at the centre and still hold its capability?
CREATE OR REPLACE FUNCTION private.has_widget(_user_id uuid, _org uuid, _widget text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dashboard_widget_catalogue c
      JOIN public.user_custom_roles a ON a.user_id = _user_id AND a.organization_id = _org AND a.ended_at IS NULL
      JOIN public.factory_roles r ON r.id = a.role_id AND r.status = 'active'
      JOIN public.factory_role_versions v ON v.id = r.active_version_id AND v.status = 'approved'
     WHERE c.code = _widget AND c.active AND _widget = ANY (coalesce(v.approved_widgets, ARRAY[]::text[])) AND c.capability = ANY (v.approved_capabilities)
       AND private.has_capability(_user_id, _org, c.capability));
$$;
REVOKE ALL ON FUNCTION private.has_widget(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_dashboard(_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'roles', coalesce((SELECT jsonb_agg(DISTINCT r.role_name) FROM public.user_custom_roles a JOIN public.factory_roles r ON r.id = a.role_id AND r.status = 'active'
                        WHERE a.user_id = auth.uid() AND a.organization_id = _org AND a.ended_at IS NULL), '[]'::jsonb),
    'widgets', coalesce((SELECT jsonb_agg(jsonb_build_object('code', c.code, 'title', c.title, 'description', c.description, 'kind', c.kind) ORDER BY c.sort_order)
                          FROM public.dashboard_widget_catalogue c WHERE private.has_widget(auth.uid(), _org, c.code)), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.dashboard_widget_data(_org uuid, _widget text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _year text; _billed numeric; _paid numeric; _decided bigint; _passed bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_widget(auth.uid(), _org, _widget) THEN RAISE EXCEPTION 'This widget is not part of your dashboard' USING ERRCODE = '42501'; END IF;
  CASE _widget
    WHEN 'centre.headcounts' THEN
      RETURN jsonb_build_object('stats', jsonb_build_array(
        jsonb_build_object('label', 'Active trainees', 'value', (SELECT count(*) FROM public.trainees WHERE organization_id = _org AND status::text = 'active')),
        jsonb_build_object('label', 'Approved classes', 'value', (SELECT count(*) FROM public.classes WHERE organization_id = _org AND active AND approval_status = 'approved')),
        jsonb_build_object('label', 'Active trainers', 'value', (SELECT count(*) FROM public.trainers WHERE organization_id = _org AND active))));
    WHEN 'trainees.by_trade' THEN
      RETURN jsonb_build_object('bars', coalesce((SELECT jsonb_agg(jsonb_build_object('label', x.name, 'value', x.n) ORDER BY x.n DESC, x.name)
        FROM (SELECT t.name, count(*) AS n FROM public.trainees tr JOIN public.trades t ON t.id = tr.trade_id WHERE tr.organization_id = _org AND tr.status::text = 'active' GROUP BY t.name ORDER BY count(*) DESC LIMIT 12) x), '[]'::jsonb));
    WHEN 'classes.overview' THEN
      RETURN jsonb_build_object('columns', jsonb_build_array('Class', 'Level', 'Capacity', 'Enrolled'), 'rows', coalesce((SELECT jsonb_agg(jsonb_build_array(c.class_name, c.level, c.capacity,
          (SELECT count(*) FROM public.class_enrollments e WHERE e.class_id = c.id AND e.status = 'active')) ORDER BY c.class_name)
        FROM (SELECT * FROM public.classes WHERE organization_id = _org AND active AND approval_status = 'approved' ORDER BY class_name LIMIT 30) c), '[]'::jsonb));
    WHEN 'assessment.pass_rate' THEN
      SELECT count(*) FILTER (WHERE result_status IS NOT NULL AND result_status NOT IN ('pending')), count(*) FILTER (WHERE result_status IN ('pass', 'passed', 'competent'))
        INTO _decided, _passed FROM public.qualification_results WHERE organization_id = _org AND approved_by IS NOT NULL;
      RETURN jsonb_build_object('stats', jsonb_build_array(
        jsonb_build_object('label', 'Decided results', 'value', _decided), jsonb_build_object('label', 'Passed', 'value', _passed),
        jsonb_build_object('label', 'Pass rate', 'value', CASE WHEN _decided > 0 THEN round(100.0 * _passed / _decided, 1) END, 'unit', '%'),
        jsonb_build_object('label', 'Waiting for approval', 'value', (SELECT count(*) FROM public.qualification_results WHERE organization_id = _org AND approved_by IS NULL))));
    WHEN 'fees.collection' THEN
      SELECT max(academic_year) INTO _year FROM public.fee_records WHERE organization_id = _org;
      SELECT coalesce(sum(total_fee), 0), coalesce(sum(amount_paid), 0) INTO _billed, _paid FROM public.fee_records WHERE organization_id = _org AND academic_year = _year;
      RETURN jsonb_build_object('stats', CASE WHEN _year IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(
        jsonb_build_object('label', 'Academic year', 'value', _year), jsonb_build_object('label', 'Billed', 'value', _billed, 'unit', 'N$'),
        jsonb_build_object('label', 'Collected', 'value', _paid, 'unit', 'N$'),
        jsonb_build_object('label', 'Collection rate', 'value', CASE WHEN _billed > 0 THEN round(100.0 * _paid / _billed, 1) END, 'unit', '%')) END);
    WHEN 'requisitions.mine' THEN
      RETURN jsonb_build_object('bars', coalesce((SELECT jsonb_agg(jsonb_build_object('label', replace(x.status, '_', ' '), 'value', x.n) ORDER BY x.n DESC)
        FROM (SELECT status, count(*) AS n FROM public.purchase_requisitions WHERE organization_id = _org AND requested_by = auth.uid() GROUP BY status) x), '[]'::jsonb));
    WHEN 'requisitions.centre' THEN
      RETURN jsonb_build_object('bars', coalesce((SELECT jsonb_agg(jsonb_build_object('label', replace(x.status, '_', ' '), 'value', x.n) ORDER BY x.n DESC)
        FROM (SELECT status, count(*) AS n FROM public.purchase_requisitions WHERE organization_id = _org GROUP BY status) x), '[]'::jsonb));
    WHEN 'procurement.pipeline' THEN
      RETURN jsonb_build_object('stats', jsonb_build_array(
        jsonb_build_object('label', 'Awaiting procurement', 'value', (SELECT count(*) FROM public.purchase_requisitions WHERE organization_id = _org AND status = 'approved_awaiting_procurement')),
        jsonb_build_object('label', 'In progress', 'value', (SELECT count(*) FROM public.purchase_requisitions WHERE organization_id = _org AND status = 'procurement_in_progress')),
        jsonb_build_object('label', 'Orders placed', 'value', (SELECT count(*) FROM public.purchase_requisitions WHERE organization_id = _org AND status IN ('order_placed', 'delivery_outstanding', 'partially_received'))),
        jsonb_build_object('label', 'Fully received', 'value', (SELECT count(*) FROM public.purchase_requisitions WHERE organization_id = _org AND status = 'fully_received'))));
    WHEN 'approvals.waiting' THEN
      RETURN jsonb_build_object('stats', jsonb_build_array(
        jsonb_build_object('label', 'Waiting for me', 'value', (SELECT count(*) FROM public.workflow_my_tasks())),
        jsonb_build_object('label', 'Overdue', 'value', (SELECT count(*) FROM public.workflow_my_tasks() t WHERE t.due_at IS NOT NULL AND t.due_at < now()))));
    WHEN 'hr.staffing' THEN
      RETURN jsonb_build_object('stats', jsonb_build_array(
        jsonb_build_object('label', 'Staff', 'value', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE organization_id = _org AND role::text NOT IN ('trainee', 'applicant'))),
        jsonb_build_object('label', 'Trainers in post', 'value', (SELECT count(*) FROM public.trainers WHERE organization_id = _org AND active))));
    ELSE RAISE EXCEPTION 'Unknown widget';
  END CASE;
END $$;

REVOKE ALL ON FUNCTION public.role_factory_save_widgets(uuid, text[]), public.dashboard_widget_catalogue_list(), public.my_dashboard(uuid), public.dashboard_widget_data(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_factory_save_widgets(uuid, text[]), public.dashboard_widget_catalogue_list(), public.my_dashboard(uuid), public.dashboard_widget_data(uuid, text) TO authenticated, service_role;
