-- Role factory (phase 5 of docs/requisition-and-org-structure-plan.md).
-- The Super Admin defines new roles on a capability layer that sits BESIDE the existing roles: nothing about the
-- app_role enum, user_roles, policies or route guards changes, and a role made here grants nothing until its
-- capabilities are reviewed and approved. Capabilities come from a fixed catalogue; the Super Admin writes a job
-- description (mandatory), asks for a proposal (AI when available, otherwise the built-in rules, or picks by hand; the
-- method is always recorded), reviews and edits it, and a Super Admin approves. Versions are kept; only the approved
-- version of an active role counts. `private.has_capability` is what later screens and dashboard widgets check.

-- ---------------------------------------------------------------------------
-- 1. Catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE public.role_capability_catalogue (
  code text PRIMARY KEY CHECK (code ~ '^[a-z]+(_[a-z]+)*\.[a-z_]+$'),
  area text NOT NULL, label text NOT NULL, description text NOT NULL,
  sensitive boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO public.role_capability_catalogue (code, area, label, description, sensitive) VALUES
  ('centre.overview', 'Centre', 'Centre overview figures', 'Headline counts for the centre (trainees, classes, trainers). No names.', false),
  ('reports.view', 'Centre', 'View centre reports', 'Open the standard centre reports.', false),
  ('trainees.summary', 'Trainees', 'Trainee numbers', 'Registration and enrolment counts by trade and level. No names.', false),
  ('trainees.records', 'Trainees', 'Named trainee records', 'See individual trainees and their details.', true),
  ('classes.view', 'Training', 'View classes', 'See classes, buildings and rooms.', false),
  ('timetable.view', 'Training', 'View the timetable', 'See the published timetable.', false),
  ('attendance.summary', 'Training', 'Attendance figures', 'Attendance rates by class. No names.', false),
  ('assessment.summary', 'Assessment', 'Assessment figures', 'Assessment progress and pass rates. No names.', false),
  ('results.records', 'Assessment', 'Named results', 'See individual trainees'' marks and results.', true),
  ('fees.summary', 'Finance', 'Fee collection figures', 'Billed and collected totals. No names.', false),
  ('fees.records', 'Finance', 'Named fee records', 'See individual trainees'' fee accounts and payments.', true),
  ('requisitions.own', 'Procurement', 'Make and follow own requisitions', 'Create requisitions and follow the ones you made.', false),
  ('requisitions.centre', 'Procurement', 'See all centre requisitions', 'See every requisition of the centre, whoever made it.', true),
  ('procurement.summary', 'Procurement', 'Procurement figures', 'Orders, deliveries and outstanding items. No supplier prices.', false),
  ('inventory.summary', 'Stores', 'Stock figures', 'Stock levels and movements.', false),
  ('hr.own', 'People', 'Own leave and HR', 'Own leave balance and requests.', false),
  ('hr.centre_summary', 'People', 'Staff figures', 'Staff numbers, vacancies and leave across the centre.', true),
  ('approvals.inbox', 'Workflow', 'Approvals inbox', 'See and act on approvals assigned to this person.', false),
  ('tickets.own', 'Support', 'Support tickets', 'Raise and follow own support tickets.', false);
ALTER TABLE public.role_capability_catalogue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff read the catalogue" ON public.role_capability_catalogue FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.role_capability_catalogue FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Roles, versions, assignments, log
-- ---------------------------------------------------------------------------
CREATE TABLE public.factory_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_code text NOT NULL UNIQUE CHECK (role_code ~ '^[a-z][a-z0-9_]{2,40}$'),
  role_name text NOT NULL CHECK (length(role_name) BETWEEN 3 AND 80),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  active_version_id uuid,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz
);
CREATE TABLE public.factory_role_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id uuid NOT NULL REFERENCES public.factory_roles(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'superseded')),
  job_description text NOT NULL CHECK (length(trim(job_description)) >= 80),
  reports_to_role text,
  proposal_method text CHECK (proposal_method IN ('ai', 'rules', 'manual')),
  proposal_capabilities text[] NOT NULL DEFAULT ARRAY[]::text[],
  proposal_note text,
  selected_capabilities text[] NOT NULL DEFAULT ARRAY[]::text[],
  approved_capabilities text[],
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  reviewed_by uuid, reviewed_at timestamptz, review_note text,
  UNIQUE (role_id, version)
);
CREATE UNIQUE INDEX uq_factory_role_open_version ON public.factory_role_versions (role_id) WHERE status IN ('draft', 'pending_review');
ALTER TABLE public.factory_roles ADD CONSTRAINT factory_roles_active_version_fk FOREIGN KEY (active_version_id) REFERENCES public.factory_role_versions(id);

CREATE TABLE public.user_custom_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.factory_roles(id),
  assigned_by uuid, assigned_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, ended_by uuid
);
CREATE UNIQUE INDEX uq_user_custom_role_open ON public.user_custom_roles (user_id, organization_id, role_id) WHERE ended_at IS NULL;

CREATE TABLE public.factory_role_events (
  id bigserial PRIMARY KEY,
  role_id uuid, organization_id uuid,
  event text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid, actor_name text, at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_factory_events_role ON public.factory_role_events (role_id, at DESC);
CREATE TRIGGER trg_factory_events_append_only BEFORE UPDATE OR DELETE ON public.factory_role_events FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();

-- a version that was submitted never changes its content; only status and review fields move
CREATE OR REPLACE FUNCTION public.factory_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'A submitted version is kept for the record' USING ERRCODE = '42501'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (NEW.job_description IS DISTINCT FROM OLD.job_description OR NEW.selected_capabilities IS DISTINCT FROM OLD.selected_capabilities
      OR NEW.proposal_capabilities IS DISTINCT FROM OLD.proposal_capabilities OR NEW.proposal_method IS DISTINCT FROM OLD.proposal_method OR NEW.version IS DISTINCT FROM OLD.version OR NEW.role_id IS DISTINCT FROM OLD.role_id) THEN
    RAISE EXCEPTION 'A submitted version can never be edited; make a new version' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_factory_version_guard BEFORE UPDATE OR DELETE ON public.factory_role_versions FOR EACH ROW EXECUTE FUNCTION public.factory_version_guard();

ALTER TABLE public.factory_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_role_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_role_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read factory roles" ON public.factory_roles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins read versions" ON public.factory_role_versions FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins read the log" ON public.factory_role_events FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins and the centre read assignments" ON public.user_custom_roles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid() OR public.has_org_role(auth.uid(), organization_id, ARRAY['organization_admin', 'admin', 'centre_manager']));
CREATE POLICY "Centre isolation" ON public.user_custom_roles AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.factory_roles, public.factory_role_versions, public.user_custom_roles, public.factory_role_events FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.factory_log(_role uuid, _org uuid, _event text, _details jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.factory_role_events (role_id, organization_id, event, details, actor, actor_name)
  VALUES (_role, _org, _event, coalesce(_details, '{}'::jsonb), auth.uid(), (SELECT coalesce(nullif(trim(p.full_name), ''), p.email) FROM public.profiles p WHERE p.user_id = auth.uid()));
$$;
-- the unknown / inactive capabilities in a list ('' when all are in the catalogue)
CREATE OR REPLACE FUNCTION private.factory_unknown_caps(_caps text[]) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(c), ARRAY[]::text[]) FROM unnest(coalesce(_caps, ARRAY[]::text[])) c WHERE NOT EXISTS (SELECT 1 FROM public.role_capability_catalogue k WHERE k.code = c AND k.active);
$$;
CREATE OR REPLACE FUNCTION private.factory_has_sensitive(_caps text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.role_capability_catalogue k WHERE k.code = ANY (coalesce(_caps, ARRAY[]::text[])) AND k.sensitive);
$$;
CREATE OR REPLACE FUNCTION private.factory_super() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only the Super Admin defines roles' USING ERRCODE = '42501'; END IF;
END $$;

-- The built-in rules: words in the job description that point at an area of work. They only ever propose
-- figures-level capabilities; named records and other sensitive ones must be picked by a person.
CREATE OR REPLACE FUNCTION private.factory_rules(_text text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r record; _caps text[] := ARRAY[]::text[]; _why jsonb := '[]'::jsonb; _t text := lower(coalesce(_text, ''));
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('trainees.summary', 'trainee|student|enrol|registration|intake'),
      ('classes.view', 'class(es)?\y|classroom|workshop|room allocation|lecture|lesson'),
      ('timetable.view', 'timetable|schedule|roster|period'),
      ('attendance.summary', 'attendance|absent'),
      ('assessment.summary', 'assess|moderat|exam|competen|portfolio'),
      ('fees.summary', 'fee|invoice|payment|collection|debtor|revenue'),
      ('requisitions.own', 'requisition|purchase request|procure'),
      ('procurement.summary', 'procure|supplier|quotation|tender|order'),
      ('inventory.summary', 'stock|inventory|stores|equipment issue|consumable'),
      ('hr.own', 'leave|staff welfare|personnel'),
      ('reports.view', 'report|statistics|monitor|compile'),
      ('centre.overview', 'oversee|manage the centre|coordinate the centre|head of'),
      ('approvals.inbox', 'approve|approval|authoris|sign off|verify'),
      ('tickets.own', 'support ticket|help desk|it support|troubleshoot')
    ) v(cap, pat) LOOP
    IF _t ~ r.pat THEN
      _caps := _caps || r.cap;
      _why := _why || jsonb_build_object('capability', r.cap, 'because', 'the description mentions "' || (regexp_match(_t, '(' || r.pat || ')'))[1] || '"');
    END IF;
  END LOOP;
  RETURN jsonb_build_object('capabilities', to_jsonb(_caps), 'reasons', _why);
END $$;
REVOKE ALL ON FUNCTION private.factory_log(uuid, uuid, text, jsonb), private.factory_unknown_caps(text[]), private.factory_has_sensitive(text[]), private.factory_super(), private.factory_rules(text) FROM PUBLIC, anon, authenticated;

-- What a person may do through the capability layer. Retired roles and unapproved versions grant nothing.
CREATE OR REPLACE FUNCTION private.has_capability(_user_id uuid, _org uuid, _cap text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_custom_roles a
      JOIN public.factory_roles r ON r.id = a.role_id AND r.status = 'active'
      JOIN public.factory_role_versions v ON v.id = r.active_version_id AND v.status = 'approved'
      JOIN public.role_capability_catalogue k ON k.code = _cap AND k.active
     WHERE a.user_id = _user_id AND a.organization_id = _org AND a.ended_at IS NULL AND _cap = ANY (v.approved_capabilities));
$$;
REVOKE ALL ON FUNCTION private.has_capability(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_capabilities(_org uuid) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT k.code ORDER BY k.code), ARRAY[]::text[]) FROM public.role_capability_catalogue k WHERE k.active AND private.has_capability(auth.uid(), _org, k.code);
$$;

-- ---------------------------------------------------------------------------
-- 4. Defining roles (Super Admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_factory_catalogue() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN '[]'::jsonb ELSE coalesce(jsonb_agg(jsonb_build_object('code', code, 'area', area, 'label', label, 'description', description, 'sensitive', sensitive) ORDER BY area, label), '[]'::jsonb) END
    FROM public.role_capability_catalogue WHERE active;
$$;

CREATE OR REPLACE FUNCTION public.role_factory_create(_code text, _name text, _job_description text, _reports_to_role text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rid uuid; _vid uuid;
BEGIN
  PERFORM private.factory_super();
  _code := lower(trim(coalesce(_code, '')));
  IF _code !~ '^[a-z][a-z0-9_]{2,40}$' THEN RAISE EXCEPTION 'The role code must be 3 to 41 characters: lower-case letters, digits and underscores, starting with a letter'; END IF;
  IF EXISTS (SELECT 1 FROM public.custom_roles c WHERE c.role_code = _code) OR EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = _code) THEN
    RAISE EXCEPTION 'A role with the code "%" already exists', _code;
  END IF;
  IF length(trim(coalesce(_job_description, ''))) < 80 THEN RAISE EXCEPTION 'A job description of at least 80 characters is required'; END IF;
  IF length(_job_description) > 8000 THEN RAISE EXCEPTION 'The job description is too long (at most 8000 characters)'; END IF;
  IF _reports_to_role IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.custom_roles c WHERE c.role_code = _reports_to_role AND c.active) THEN RAISE EXCEPTION 'Choose an existing role to report to'; END IF;
  INSERT INTO public.factory_roles (role_code, role_name, created_by) VALUES (_code, trim(_name), auth.uid()) RETURNING id INTO _rid;
  INSERT INTO public.factory_role_versions (role_id, version, job_description, reports_to_role, created_by) VALUES (_rid, 1, trim(_job_description), _reports_to_role, auth.uid()) RETURNING id INTO _vid;
  PERFORM private.factory_log(_rid, NULL, 'role_created', jsonb_build_object('code', _code, 'version', 1));
  RETURN _vid;
END $$;

-- a new draft version of an existing role, starting from its latest content
CREATE OR REPLACE FUNCTION public.role_factory_new_version(_role uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.factory_role_versions%ROWTYPE; _id uuid;
BEGIN
  PERFORM private.factory_super();
  IF EXISTS (SELECT 1 FROM public.factory_role_versions WHERE role_id = _role AND status IN ('draft', 'pending_review')) THEN RAISE EXCEPTION 'This role already has a version in progress'; END IF;
  IF (SELECT status FROM public.factory_roles WHERE id = _role) = 'retired' THEN RAISE EXCEPTION 'A retired role cannot be changed'; END IF;
  SELECT * INTO v FROM public.factory_role_versions WHERE role_id = _role ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
  INSERT INTO public.factory_role_versions (role_id, version, job_description, reports_to_role, selected_capabilities, created_by)
    VALUES (_role, v.version + 1, v.job_description, v.reports_to_role, coalesce(v.approved_capabilities, v.selected_capabilities), auth.uid()) RETURNING id INTO _id;
  PERFORM private.factory_log(_role, NULL, 'version_started', jsonb_build_object('version', v.version + 1));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.role_factory_save_draft(_version uuid, _job_description text, _reports_to_role text, _capabilities text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.factory_role_versions%ROWTYPE; _unknown text[];
BEGIN
  PERFORM private.factory_super();
  SELECT * INTO v FROM public.factory_role_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;
  IF v.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be edited'; END IF;
  IF length(trim(coalesce(_job_description, ''))) < 80 THEN RAISE EXCEPTION 'A job description of at least 80 characters is required'; END IF;
  IF length(_job_description) > 8000 THEN RAISE EXCEPTION 'The job description is too long (at most 8000 characters)'; END IF;
  _unknown := private.factory_unknown_caps(_capabilities);
  IF cardinality(_unknown) > 0 THEN RAISE EXCEPTION 'Unknown capability: %', _unknown[1]; END IF;
  IF _reports_to_role IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.custom_roles c WHERE c.role_code = _reports_to_role AND c.active) THEN RAISE EXCEPTION 'Choose an existing role to report to'; END IF;
  UPDATE public.factory_role_versions SET job_description = trim(_job_description), reports_to_role = _reports_to_role,
      selected_capabilities = ARRAY(SELECT DISTINCT c FROM unnest(coalesce(_capabilities, ARRAY[]::text[])) c ORDER BY c),
      -- picking by hand with no proposal yet is the "manual" method
      proposal_method = coalesce(v.proposal_method, CASE WHEN cardinality(coalesce(_capabilities, ARRAY[]::text[])) > 0 THEN 'manual' END),
      proposal_capabilities = CASE WHEN v.proposal_method IS NULL AND cardinality(coalesce(_capabilities, ARRAY[]::text[])) > 0 THEN ARRAY(SELECT DISTINCT c FROM unnest(_capabilities) c ORDER BY c) ELSE v.proposal_capabilities END
    WHERE id = _version;
END $$;

-- proposal by the built-in rules (computed here, so the label cannot be claimed by the caller)
CREATE OR REPLACE FUNCTION public.role_factory_run_rules(_version uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.factory_role_versions%ROWTYPE; _res jsonb; _caps text[];
BEGIN
  PERFORM private.factory_super();
  SELECT * INTO v FROM public.factory_role_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND OR v.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be analysed'; END IF;
  _res := private.factory_rules(v.job_description);
  _caps := ARRAY(SELECT jsonb_array_elements_text(_res -> 'capabilities'));
  UPDATE public.factory_role_versions SET proposal_method = 'rules', proposal_capabilities = _caps, selected_capabilities = _caps,
      proposal_note = 'Proposed by the built-in keyword rules (no AI was used). It only proposes figures-level capabilities.' WHERE id = _version;
  PERFORM private.factory_log(v.role_id, NULL, 'proposal_rules', jsonb_build_object('version', v.version, 'capabilities', _caps));
  RETURN _res || jsonb_build_object('method', 'rules');
END $$;

-- proposal by the AI function: only the service key may record it, and only on behalf of a Super Admin
CREATE OR REPLACE FUNCTION public.role_factory_record_ai(_version uuid, _capabilities text[], _note text, _actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.factory_role_versions%ROWTYPE; _ok text[]; _dropped text[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Only the analysis service records an AI proposal' USING ERRCODE = '42501'; END IF;
  IF _actor IS NULL OR NOT public.is_super_admin(_actor) THEN RAISE EXCEPTION 'The analysis was not requested by a Super Admin' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v FROM public.factory_role_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND OR v.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be analysed'; END IF;
  _dropped := private.factory_unknown_caps(_capabilities);
  _ok := ARRAY(SELECT DISTINCT c FROM unnest(coalesce(_capabilities, ARRAY[]::text[])) c WHERE NOT (c = ANY (_dropped)) ORDER BY c);
  UPDATE public.factory_role_versions SET proposal_method = 'ai', proposal_capabilities = _ok, selected_capabilities = _ok,
      proposal_note = left(coalesce(_note, '') || CASE WHEN cardinality(_dropped) > 0 THEN E'\nIgnored (not in the capability list): ' || array_to_string(_dropped, ', ') ELSE '' END, 2000) WHERE id = _version;
  INSERT INTO public.factory_role_events (role_id, event, details, actor) VALUES (v.role_id, 'proposal_ai', jsonb_build_object('version', v.version, 'capabilities', _ok, 'ignored', _dropped), _actor);
  RETURN jsonb_build_object('capabilities', to_jsonb(_ok), 'ignored', to_jsonb(_dropped), 'method', 'ai');
END $$;

CREATE OR REPLACE FUNCTION public.role_factory_submit(_version uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.factory_role_versions%ROWTYPE;
BEGIN
  PERFORM private.factory_super();
  SELECT * INTO v FROM public.factory_role_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND OR v.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be sent for review'; END IF;
  IF length(trim(v.job_description)) < 80 THEN RAISE EXCEPTION 'A job description is required'; END IF;
  IF cardinality(v.selected_capabilities) = 0 THEN RAISE EXCEPTION 'Choose at least one capability (or analyse the job description) before review'; END IF;
  UPDATE public.factory_role_versions SET status = 'pending_review', submitted_at = now() WHERE id = _version;
  PERFORM private.factory_log(v.role_id, NULL, 'submitted', jsonb_build_object('version', v.version));
END $$;

CREATE OR REPLACE FUNCTION public.role_factory_withdraw(_version uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.factory_role_versions%ROWTYPE;
BEGIN
  PERFORM private.factory_super();
  SELECT * INTO v FROM public.factory_role_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND OR v.status <> 'pending_review' THEN RAISE EXCEPTION 'Only a version waiting for review can be taken back'; END IF;
  UPDATE public.factory_role_versions SET status = 'draft', submitted_at = NULL WHERE id = _version;
  PERFORM private.factory_log(v.role_id, NULL, 'withdrawn', jsonb_build_object('version', v.version));
END $$;

-- Review: a Super Admin approves (and the role becomes active) or rejects. With more than one Super Admin the
-- reviewer must not be the author. Sensitive capabilities need an explicit acknowledgement.
CREATE OR REPLACE FUNCTION public.role_factory_decide(_version uuid, _approve boolean, _note text, _ack_sensitive boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.factory_role_versions%ROWTYPE; _supers integer;
BEGIN
  PERFORM private.factory_super();
  SELECT * INTO v FROM public.factory_role_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND OR v.status <> 'pending_review' THEN RAISE EXCEPTION 'This version is not waiting for review'; END IF;
  SELECT count(DISTINCT user_id) INTO _supers FROM public.user_roles WHERE role::text = 'super_admin';
  IF _supers > 1 AND v.created_by = auth.uid() THEN RAISE EXCEPTION 'Another Super Admin must review a role you prepared' USING ERRCODE = '42501'; END IF;
  IF NOT _approve THEN
    IF length(trim(coalesce(_note, ''))) < 5 THEN RAISE EXCEPTION 'Give the reason for rejecting it'; END IF;
    UPDATE public.factory_role_versions SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = trim(_note) WHERE id = _version;
    PERFORM private.factory_log(v.role_id, NULL, 'rejected', jsonb_build_object('version', v.version, 'note', _note));
    RETURN 'rejected';
  END IF;
  IF private.factory_has_sensitive(v.selected_capabilities) AND NOT coalesce(_ack_sensitive, false) THEN RAISE EXCEPTION 'This role includes sensitive capabilities; confirm that you have reviewed them'; END IF;
  IF cardinality(private.factory_unknown_caps(v.selected_capabilities)) > 0 THEN RAISE EXCEPTION 'The capability list changed; ask for the proposal again'; END IF;
  UPDATE public.factory_role_versions SET status = 'superseded' WHERE role_id = v.role_id AND status = 'approved';
  UPDATE public.factory_role_versions SET status = 'approved', approved_capabilities = v.selected_capabilities, reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(coalesce(_note, '')), '') WHERE id = _version;
  UPDATE public.factory_roles SET status = 'active', active_version_id = _version WHERE id = v.role_id;
  PERFORM private.factory_log(v.role_id, NULL, 'approved', jsonb_build_object('version', v.version, 'capabilities', v.selected_capabilities));
  RETURN 'approved';
END $$;

CREATE OR REPLACE FUNCTION public.role_factory_retire(_role uuid, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.factory_super();
  IF length(trim(coalesce(_note, ''))) < 5 THEN RAISE EXCEPTION 'Give the reason for retiring the role'; END IF;
  UPDATE public.factory_roles SET status = 'retired', retired_at = now() WHERE id = _role AND status <> 'retired';
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found or already retired'; END IF;
  UPDATE public.factory_role_versions SET status = 'rejected', review_note = 'Role retired' WHERE role_id = _role AND status IN ('draft', 'pending_review');
  PERFORM private.factory_log(_role, NULL, 'retired', jsonb_build_object('note', _note));
END $$;

-- ---------------------------------------------------------------------------
-- 5. Assigning (Super Admin anywhere; the centre's Organisation Admin only roles without sensitive capabilities)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_factory_assign(_org uuid, _user uuid, _role uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.factory_roles%ROWTYPE; v public.factory_role_versions%ROWTYPE; _id uuid; _super boolean := public.is_super_admin(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR NOT (_super OR public.has_org_role(auth.uid(), _org, ARRAY['organization_admin', 'admin'])) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.factory_roles WHERE id = _role;
  IF NOT FOUND OR r.status <> 'active' THEN RAISE EXCEPTION 'This role is not active'; END IF;
  SELECT * INTO v FROM public.factory_role_versions WHERE id = r.active_version_id;
  IF NOT _super AND private.factory_has_sensitive(v.approved_capabilities) THEN RAISE EXCEPTION 'Only the Super Admin assigns a role that includes sensitive capabilities' USING ERRCODE = '42501'; END IF;
  IF _user = auth.uid() AND NOT _super THEN RAISE EXCEPTION 'Administrators cannot assign roles to themselves' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user AND ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant')) THEN RAISE EXCEPTION 'The person must already be staff at this centre'; END IF;
  IF NOT private.reporting_user_active(_user) THEN RAISE EXCEPTION 'The person''s account is not active'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_custom_roles WHERE user_id = _user AND organization_id = _org AND role_id = _role AND ended_at IS NULL) THEN RAISE EXCEPTION 'The person already holds this role'; END IF;
  INSERT INTO public.user_custom_roles (user_id, organization_id, role_id, assigned_by) VALUES (_user, _org, _role, auth.uid()) RETURNING id INTO _id;
  PERFORM private.factory_log(_role, _org, 'assigned', jsonb_build_object('user', _user, 'version', v.version));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.role_factory_unassign(_assignment uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.user_custom_roles%ROWTYPE; _super boolean := public.is_super_admin(auth.uid());
BEGIN
  SELECT * INTO a FROM public.user_custom_roles WHERE id = _assignment FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT (_super OR public.has_org_role(auth.uid(), a.organization_id, ARRAY['organization_admin', 'admin'])) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF a.ended_at IS NOT NULL THEN RAISE EXCEPTION 'Already ended'; END IF;
  UPDATE public.user_custom_roles SET ended_at = now(), ended_by = auth.uid() WHERE id = _assignment;
  PERFORM private.factory_log(a.role_id, a.organization_id, 'unassigned', jsonb_build_object('user', a.user_id));
END $$;

-- ---------------------------------------------------------------------------
-- 6. Reading
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_factory_overview() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.factory_super();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'role_code', r.role_code, 'role_name', r.role_name, 'status', r.status, 'active_version_id', r.active_version_id,
      'assigned', (SELECT count(*) FROM public.user_custom_roles a WHERE a.role_id = r.id AND a.ended_at IS NULL),
      'versions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', v.id, 'version', v.version, 'status', v.status, 'job_description', v.job_description, 'reports_to_role', v.reports_to_role,
            'proposal_method', v.proposal_method, 'proposal_capabilities', v.proposal_capabilities, 'proposal_note', v.proposal_note,
            'selected_capabilities', v.selected_capabilities, 'approved_capabilities', v.approved_capabilities, 'sensitive', private.factory_has_sensitive(v.selected_capabilities),
            'created_by', (SELECT coalesce(nullif(trim(p.full_name), ''), p.email) FROM public.profiles p WHERE p.user_id = v.created_by), 'created_by_me', v.created_by = auth.uid(), 'created_at', v.created_at,
            'reviewed_by', (SELECT coalesce(nullif(trim(p.full_name), ''), p.email) FROM public.profiles p WHERE p.user_id = v.reviewed_by), 'reviewed_at', v.reviewed_at, 'review_note', v.review_note) ORDER BY v.version DESC), '[]'::jsonb)
         FROM public.factory_role_versions v WHERE v.role_id = r.id)) ORDER BY r.role_name)
    FROM public.factory_roles r), '[]'::jsonb);
END $$;

-- active roles a centre can assign, with their approved capabilities (no job-description drafts)
CREATE OR REPLACE FUNCTION public.role_factory_assignable(_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_super_admin(auth.uid()) OR public.has_org_role(auth.uid(), _org, ARRAY['organization_admin', 'admin', 'centre_manager'])) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'roles', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'role_name', r.role_name, 'role_code', r.role_code, 'capabilities', v.approved_capabilities, 'sensitive', private.factory_has_sensitive(v.approved_capabilities),
                'can_assign', public.is_super_admin(auth.uid()) OR NOT private.factory_has_sensitive(v.approved_capabilities)) ORDER BY r.role_name)
        FROM public.factory_roles r JOIN public.factory_role_versions v ON v.id = r.active_version_id WHERE r.status = 'active'), '[]'::jsonb),
    'assignments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'user_id', a.user_id, 'name', private.requisition_person(_org, a.user_id) ->> 'name', 'role_id', a.role_id, 'role_name', r.role_name, 'assigned_at', a.assigned_at) ORDER BY a.assigned_at DESC)
        FROM public.user_custom_roles a JOIN public.factory_roles r ON r.id = a.role_id WHERE a.organization_id = _org AND a.ended_at IS NULL), '[]'::jsonb),
    'staff', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', p.name) ORDER BY p.name)
        FROM (SELECT ur.user_id, coalesce(nullif(trim(max(pr.full_name)), ''), max(pr.email), 'Unnamed') AS name FROM public.user_roles ur LEFT JOIN public.profiles pr ON pr.user_id = ur.user_id
               WHERE ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant') GROUP BY ur.user_id) p WHERE private.reporting_user_active(p.user_id)), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.role_factory_events_list(_role uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.factory_super();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event, 'role', r.role_name, 'details', e.details, 'by', e.actor_name, 'at', e.at) ORDER BY e.at DESC)
    FROM (SELECT * FROM public.factory_role_events x WHERE _role IS NULL OR x.role_id = _role ORDER BY at DESC LIMIT 100) e LEFT JOIN public.factory_roles r ON r.id = e.role_id), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.factory_version_guard(), public.my_capabilities(uuid), public.role_factory_catalogue(), public.role_factory_create(text, text, text, text), public.role_factory_new_version(uuid),
  public.role_factory_save_draft(uuid, text, text, text[]), public.role_factory_run_rules(uuid), public.role_factory_record_ai(uuid, text[], text, uuid), public.role_factory_submit(uuid), public.role_factory_withdraw(uuid),
  public.role_factory_decide(uuid, boolean, text, boolean), public.role_factory_retire(uuid, text), public.role_factory_assign(uuid, uuid, uuid), public.role_factory_unassign(uuid), public.role_factory_overview(),
  public.role_factory_assignable(uuid), public.role_factory_events_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_capabilities(uuid), public.role_factory_catalogue(), public.role_factory_create(text, text, text, text), public.role_factory_new_version(uuid),
  public.role_factory_save_draft(uuid, text, text, text[]), public.role_factory_run_rules(uuid), public.role_factory_record_ai(uuid, text[], text, uuid), public.role_factory_submit(uuid), public.role_factory_withdraw(uuid),
  public.role_factory_decide(uuid, boolean, text, boolean), public.role_factory_retire(uuid, text), public.role_factory_assign(uuid, uuid, uuid), public.role_factory_unassign(uuid), public.role_factory_overview(),
  public.role_factory_assignable(uuid), public.role_factory_events_list(uuid) TO authenticated, service_role;
