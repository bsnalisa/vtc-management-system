-- Reporting structure (phase 4 of docs/requisition-and-org-structure-plan.md).
-- Who supervises whom decides who approves what, so every change now goes through checked, audited functions:
--  * a person can be given a named supervisor for a period (effective dates); the new supervisor must belong to the same
--    centre, be active, not be the person, not create a loop, and not be the administrator making the change;
--  * role-level lines are checked for loops too;
--  * changing the supervisor of the Accountant, the Head of Finance and Administration or the Centre Manager (by name or by
--    role line) is only a request until a Super Admin confirms it;
--  * the organisation chart, an impact preview and a gaps list come from live records;
--  * approvals already waiting can be moved to another person only by an explicit, audited reassignment, and decisions
--    already taken are never touched.
-- The Organisation Admin (IT administrator) no longer writes reporting_lines / user_supervisors directly.

-- ---------------------------------------------------------------------------
-- 1. Named supervisors get dates and an identity
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_supervisors DROP CONSTRAINT IF EXISTS user_supervisors_pkey;
ALTER TABLE public.user_supervisors
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_supervisors ADD PRIMARY KEY (id);
ALTER TABLE public.user_supervisors ADD CONSTRAINT user_supervisors_dates_check CHECK (effective_to IS NULL OR effective_to >= effective_from);
CREATE INDEX IF NOT EXISTS idx_user_supervisors_person ON public.user_supervisors (organization_id, user_id, effective_from);

DROP POLICY IF EXISTS "Workflow admins manage reporting lines" ON public.reporting_lines;
DROP POLICY IF EXISTS "Workflow admins manage supervisor overrides" ON public.user_supervisors;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.reporting_lines, public.user_supervisors FROM anon, authenticated;

CREATE TABLE public.reporting_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('line', 'supervisor')),
  subject_role text, subject_user uuid,
  new_supervisor_role text, new_supervisor_user uuid,
  effective_from date, effective_to date,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'withdrawn')),
  requested_by uuid, requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid, decided_at timestamptz, decision_note text
);
CREATE INDEX idx_reporting_requests_open ON public.reporting_change_requests (organization_id, status);

CREATE TABLE public.reporting_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL,
  event text NOT NULL,
  subject_user uuid, subject_role text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid, actor_name text, actor_role text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reporting_events_org ON public.reporting_events (organization_id, at DESC);
CREATE TRIGGER trg_reporting_events_append_only BEFORE UPDATE OR DELETE ON public.reporting_events FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();

ALTER TABLE public.reporting_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators and the Centre Manager read requests" ON public.reporting_change_requests FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['organization_admin', 'admin', 'centre_manager']));
CREATE POLICY "Administrators and the Centre Manager read the log" ON public.reporting_events FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['organization_admin', 'admin', 'centre_manager']));
CREATE POLICY "Super admins read requests" ON public.reporting_change_requests FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins read the log" ON public.reporting_events FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
DO $$
DECLARE t text; expr text := 'NOT (SELECT public.is_centre_scoped_user()) OR (%1$I.organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['reporting_change_requests', 'reporting_events'] LOOP
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (' || expr || ') WITH CHECK (' || expr || ')', t, t, t);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.reporting_change_requests, public.reporting_events FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Routing respects the dates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.reporting_supervisors_at(_org uuid, _user uuid, _asof date) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT us.supervisor_user_id FROM public.user_supervisors us
   WHERE us.organization_id = _org AND us.user_id = _user AND us.effective_from <= _asof AND (us.effective_to IS NULL OR us.effective_to >= _asof)
  UNION
  SELECT DISTINCT ur.user_id FROM public.user_roles ur
  WHERE ur.organization_id = _org AND ur.user_id <> _user
    AND NOT EXISTS (SELECT 1 FROM public.user_supervisors us WHERE us.organization_id = _org AND us.user_id = _user AND us.effective_from <= _asof AND (us.effective_to IS NULL OR us.effective_to >= _asof))
    AND ur.role::text IN (SELECT rl.supervisor_role FROM public.reporting_lines rl
                          WHERE rl.organization_id = _org
                            AND rl.role IN (SELECT r2.role::text FROM public.user_roles r2 WHERE r2.user_id = _user AND r2.organization_id = _org));
$$;
REVOKE ALL ON FUNCTION private.reporting_supervisors_at(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.workflow_supervisors_of(_org uuid, _user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.reporting_supervisors_at(_org, _user, current_date);
$$;
REVOKE ALL ON FUNCTION public.workflow_supervisors_of(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Rules
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.reporting_protected_roles() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['accountant', 'head_of_finance_admin', 'centre_manager'];
$$;
CREATE OR REPLACE FUNCTION private.reporting_user_active(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = _user AND (a.banned_until IS NULL OR a.banned_until < now()));
$$;
CREATE OR REPLACE FUNCTION private.reporting_can_manage(_user uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_workflow_admin(_user, _org) OR public.is_super_admin(_user);
$$;
CREATE OR REPLACE FUNCTION private.reporting_actor(_org uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.requisition_person(_org, auth.uid());
$$;
REVOKE ALL ON FUNCTION private.reporting_protected_roles(), private.reporting_user_active(uuid), private.reporting_can_manage(uuid, uuid), private.reporting_actor(uuid) FROM PUBLIC, anon, authenticated;

-- is _target above _start in the reporting chain on that date? (people-level; a role line means everyone holding the role)
CREATE OR REPLACE FUNCTION private.reporting_reaches(_org uuid, _start uuid, _target uuid, _asof date) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cur uuid[] := ARRAY[_start]; seen uuid[] := ARRAY[_start]; nxt uuid[]; i integer;
BEGIN
  FOR i IN 1..15 LOOP
    SELECT COALESCE(array_agg(DISTINCT s), ARRAY[]::uuid[]) INTO nxt FROM unnest(cur) u, LATERAL private.reporting_supervisors_at(_org, u, _asof) s;
    IF _target = ANY (nxt) THEN RETURN true; END IF;
    nxt := ARRAY(SELECT x FROM unnest(nxt) x WHERE NOT (x = ANY (seen)));
    EXIT WHEN cardinality(nxt) = 0;
    seen := seen || nxt; cur := nxt;
  END LOOP;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.reporting_reaches(uuid, uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- the first problem with giving _user the supervisor _sup from _from, or NULL when it is acceptable
CREATE OR REPLACE FUNCTION private.reporting_problem(_org uuid, _user uuid, _sup uuid, _from date, _to date) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user IS NULL OR _sup IS NULL THEN RETURN 'Choose the person and their supervisor'; END IF;
  IF _user = _sup THEN RETURN 'A person cannot be their own supervisor'; END IF;
  IF _sup = auth.uid() AND NOT public.is_super_admin(auth.uid()) THEN RETURN 'Administrators cannot make themselves a supervisor'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user AND ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant')) THEN RETURN 'The person does not hold a staff role at this centre'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _sup AND ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant')) THEN RETURN 'The supervisor must hold a staff role at this same centre'; END IF;
  IF NOT private.reporting_user_active(_sup) THEN RETURN 'The supervisor''s account is not active'; END IF;
  IF _from IS NULL OR _from < current_date THEN RETURN 'The start date cannot be in the past'; END IF;
  IF _to IS NOT NULL AND _to < _from THEN RETURN 'The end date is before the start date'; END IF;
  IF private.reporting_reaches(_org, _sup, _user, _from) THEN RETURN 'That would make a loop: the supervisor already reports, directly or through others, to this person'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_supervisors us WHERE us.organization_id = _org AND us.user_id = _user AND us.effective_from > _from
               AND (_to IS NULL OR us.effective_from <= _to)) THEN RETURN 'A later supervisor change is already scheduled for this person; remove it first'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.reporting_problem(uuid, uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.reporting_log(_org uuid, _event text, _user uuid, _role text, _details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p jsonb := private.reporting_actor(_org);
BEGIN
  INSERT INTO public.reporting_events (organization_id, event, subject_user, subject_role, details, actor, actor_name, actor_role)
    VALUES (_org, _event, _user, _role, coalesce(_details, '{}'::jsonb), auth.uid(), _p ->> 'name', _p ->> 'role');
END $$;
REVOKE ALL ON FUNCTION private.reporting_log(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- applies (or, with a NULL supervisor, ends) a named supervisor; the previous open-ended one finishes the day before
CREATE OR REPLACE FUNCTION private.reporting_apply_supervisor(_org uuid, _user uuid, _sup uuid, _from date, _to date, _note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _prev record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('reporting:' || _org::text || ':' || _user::text));
  IF _sup IS NULL THEN
    UPDATE public.user_supervisors SET effective_to = greatest(effective_from, _from - 1)
     WHERE organization_id = _org AND user_id = _user AND effective_from <= _from AND (effective_to IS NULL OR effective_to >= _from);
    DELETE FROM public.user_supervisors WHERE organization_id = _org AND user_id = _user AND effective_from > _from;
    PERFORM private.reporting_log(_org, 'supervisor_removed', _user, NULL, jsonb_build_object('from', _from));
    RETURN NULL;
  END IF;
  FOR _prev IN SELECT * FROM public.user_supervisors WHERE organization_id = _org AND user_id = _user AND effective_from <= _from AND (effective_to IS NULL OR effective_to >= _from) LOOP
    IF _prev.effective_from = _from THEN DELETE FROM public.user_supervisors WHERE id = _prev.id;
    ELSE UPDATE public.user_supervisors SET effective_to = _from - 1 WHERE id = _prev.id; END IF;
  END LOOP;
  INSERT INTO public.user_supervisors (organization_id, user_id, supervisor_user_id, effective_from, effective_to, note, created_by)
    VALUES (_org, _user, _sup, _from, _to, nullif(trim(coalesce(_note, '')), ''), auth.uid()) RETURNING id INTO _id;
  PERFORM private.reporting_log(_org, 'supervisor_set', _user, NULL, jsonb_build_object('supervisor', _sup, 'from', _from, 'to', _to, 'note', _note));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION private.reporting_apply_supervisor(uuid, uuid, uuid, date, date, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.reporting_role_problem(_org uuid, _role text, _sup_role text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cur text := _sup_role; i integer;
BEGIN
  IF _role IS NULL OR _sup_role IS NULL THEN RETURN 'Choose both roles'; END IF;
  IF _role = _sup_role THEN RETURN 'A role cannot report to itself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.custom_roles c WHERE c.role_code = _role AND c.active) OR NOT EXISTS (SELECT 1 FROM public.custom_roles c WHERE c.role_code = _sup_role AND c.active) THEN RETURN 'Both must be active roles'; END IF;
  FOR i IN 1..20 LOOP
    SELECT rl.supervisor_role INTO cur FROM public.reporting_lines rl WHERE rl.organization_id = _org AND rl.role = cur AND NOT (rl.role = _role);
    EXIT WHEN cur IS NULL;
    IF cur = _role THEN RETURN 'That would make a loop between roles'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.reporting_role_problem(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Changes (requests when the Accountant, Head of Finance and Administration or Centre Manager is affected)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reporting_set_supervisor(_org uuid, _user uuid, _supervisor uuid, _from date DEFAULT current_date, _to date DEFAULT NULL, _note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p text; _req uuid; _prot boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT private.reporting_can_manage(auth.uid(), _org) THEN RAISE EXCEPTION 'Only the Organisation Admin manages reporting lines' USING ERRCODE = '42501'; END IF;
  _p := private.reporting_problem(_org, _user, _supervisor, coalesce(_from, current_date), _to);
  IF _p IS NOT NULL THEN RAISE EXCEPTION '%', _p; END IF;
  _prot := EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user AND ur.organization_id = _org AND ur.role::text = ANY (private.reporting_protected_roles()));
  IF _prot AND NOT public.is_super_admin(auth.uid()) THEN
    IF EXISTS (SELECT 1 FROM public.reporting_change_requests WHERE organization_id = _org AND subject_user = _user AND status = 'pending') THEN RAISE EXCEPTION 'A change for this person is already waiting for the Super Admin'; END IF;
    INSERT INTO public.reporting_change_requests (organization_id, kind, subject_user, new_supervisor_user, effective_from, effective_to, note, requested_by)
      VALUES (_org, 'supervisor', _user, _supervisor, coalesce(_from, current_date), _to, nullif(trim(coalesce(_note, '')), ''), auth.uid()) RETURNING id INTO _req;
    PERFORM private.reporting_log(_org, 'change_requested', _user, NULL, jsonb_build_object('request', _req, 'supervisor', _supervisor, 'from', coalesce(_from, current_date)));
    RETURN jsonb_build_object('status', 'pending_confirmation', 'request_id', _req);
  END IF;
  RETURN jsonb_build_object('status', 'applied', 'id', private.reporting_apply_supervisor(_org, _user, _supervisor, coalesce(_from, current_date), _to, _note));
END $$;

CREATE OR REPLACE FUNCTION public.reporting_remove_supervisor(_org uuid, _user uuid, _from date DEFAULT current_date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req uuid; _prot boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT private.reporting_can_manage(auth.uid(), _org) THEN RAISE EXCEPTION 'Only the Organisation Admin manages reporting lines' USING ERRCODE = '42501'; END IF;
  IF _from IS NULL OR _from < current_date THEN RAISE EXCEPTION 'The date cannot be in the past'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_supervisors WHERE organization_id = _org AND user_id = _user AND (effective_to IS NULL OR effective_to >= current_date)) THEN RAISE EXCEPTION 'This person has no named supervisor'; END IF;
  _prot := EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user AND ur.organization_id = _org AND ur.role::text = ANY (private.reporting_protected_roles()));
  IF _prot AND NOT public.is_super_admin(auth.uid()) THEN
    IF EXISTS (SELECT 1 FROM public.reporting_change_requests WHERE organization_id = _org AND subject_user = _user AND status = 'pending') THEN RAISE EXCEPTION 'A change for this person is already waiting for the Super Admin'; END IF;
    INSERT INTO public.reporting_change_requests (organization_id, kind, subject_user, new_supervisor_user, effective_from, requested_by) VALUES (_org, 'supervisor', _user, NULL, _from, auth.uid()) RETURNING id INTO _req;
    PERFORM private.reporting_log(_org, 'change_requested', _user, NULL, jsonb_build_object('request', _req, 'remove', true));
    RETURN jsonb_build_object('status', 'pending_confirmation', 'request_id', _req);
  END IF;
  PERFORM private.reporting_apply_supervisor(_org, _user, NULL, _from, NULL, NULL);
  RETURN jsonb_build_object('status', 'applied');
END $$;

CREATE OR REPLACE FUNCTION public.reporting_set_line(_org uuid, _role text, _supervisor_role text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p text; _req uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.reporting_can_manage(auth.uid(), _org) THEN RAISE EXCEPTION 'Only the Organisation Admin manages reporting lines' USING ERRCODE = '42501'; END IF;
  _p := private.reporting_role_problem(_org, _role, _supervisor_role);
  IF _p IS NOT NULL THEN RAISE EXCEPTION '%', _p; END IF;
  IF _role = ANY (private.reporting_protected_roles()) AND NOT public.is_super_admin(auth.uid()) THEN
    IF EXISTS (SELECT 1 FROM public.reporting_change_requests WHERE organization_id = _org AND kind = 'line' AND subject_role = _role AND status = 'pending') THEN RAISE EXCEPTION 'A change for this role is already waiting for the Super Admin'; END IF;
    INSERT INTO public.reporting_change_requests (organization_id, kind, subject_role, new_supervisor_role, requested_by) VALUES (_org, 'line', _role, _supervisor_role, auth.uid()) RETURNING id INTO _req;
    PERFORM private.reporting_log(_org, 'change_requested', NULL, _role, jsonb_build_object('request', _req, 'supervisor_role', _supervisor_role));
    RETURN jsonb_build_object('status', 'pending_confirmation', 'request_id', _req);
  END IF;
  INSERT INTO public.reporting_lines (organization_id, role, supervisor_role) VALUES (_org, _role, _supervisor_role)
    ON CONFLICT (organization_id, role) DO UPDATE SET supervisor_role = excluded.supervisor_role;
  PERFORM private.reporting_log(_org, 'line_set', NULL, _role, jsonb_build_object('supervisor_role', _supervisor_role));
  RETURN jsonb_build_object('status', 'applied');
END $$;

CREATE OR REPLACE FUNCTION public.reporting_remove_line(_org uuid, _role text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.reporting_can_manage(auth.uid(), _org) THEN RAISE EXCEPTION 'Only the Organisation Admin manages reporting lines' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reporting_lines WHERE organization_id = _org AND role = _role) THEN RAISE EXCEPTION 'There is no reporting line for this role'; END IF;
  IF _role = ANY (private.reporting_protected_roles()) AND NOT public.is_super_admin(auth.uid()) THEN
    IF EXISTS (SELECT 1 FROM public.reporting_change_requests WHERE organization_id = _org AND kind = 'line' AND subject_role = _role AND status = 'pending') THEN RAISE EXCEPTION 'A change for this role is already waiting for the Super Admin'; END IF;
    INSERT INTO public.reporting_change_requests (organization_id, kind, subject_role, new_supervisor_role, requested_by) VALUES (_org, 'line', _role, NULL, auth.uid()) RETURNING id INTO _req;
    PERFORM private.reporting_log(_org, 'change_requested', NULL, _role, jsonb_build_object('request', _req, 'remove', true));
    RETURN jsonb_build_object('status', 'pending_confirmation', 'request_id', _req);
  END IF;
  DELETE FROM public.reporting_lines WHERE organization_id = _org AND role = _role;
  PERFORM private.reporting_log(_org, 'line_removed', NULL, _role, '{}'::jsonb);
  RETURN jsonb_build_object('status', 'applied');
END $$;

CREATE OR REPLACE FUNCTION public.reporting_withdraw_change(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reporting_change_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.reporting_change_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT private.reporting_can_manage(auth.uid(), r.organization_id) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
  UPDATE public.reporting_change_requests SET status = 'withdrawn', decided_by = auth.uid(), decided_at = now() WHERE id = _id;
  PERFORM private.reporting_log(r.organization_id, 'change_withdrawn', r.subject_user, r.subject_role, jsonb_build_object('request', _id));
END $$;

-- The Super Admin confirms or rejects; the rules are checked again at that moment
CREATE OR REPLACE FUNCTION public.reporting_decide_change(_id uuid, _approve boolean, _note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reporting_change_requests%ROWTYPE; _p text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only a Super Admin confirms a change to the Accountant, Head of Finance and Administration or Centre Manager reporting line' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.reporting_change_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
  IF NOT _approve AND length(trim(coalesce(_note, ''))) < 5 THEN RAISE EXCEPTION 'Give the reason for rejecting the change'; END IF;
  IF _approve THEN
    IF r.kind = 'supervisor' THEN
      IF r.new_supervisor_user IS NOT NULL THEN
        _p := private.reporting_problem(r.organization_id, r.subject_user, r.new_supervisor_user, greatest(r.effective_from, current_date), r.effective_to);
        IF _p IS NOT NULL THEN RAISE EXCEPTION 'The change can no longer be applied: %', _p; END IF;
        PERFORM private.reporting_apply_supervisor(r.organization_id, r.subject_user, r.new_supervisor_user, greatest(r.effective_from, current_date), r.effective_to, r.note);
      ELSE
        PERFORM private.reporting_apply_supervisor(r.organization_id, r.subject_user, NULL, greatest(r.effective_from, current_date), NULL, NULL);
      END IF;
    ELSIF r.new_supervisor_role IS NOT NULL THEN
      _p := private.reporting_role_problem(r.organization_id, r.subject_role, r.new_supervisor_role);
      IF _p IS NOT NULL THEN RAISE EXCEPTION 'The change can no longer be applied: %', _p; END IF;
      INSERT INTO public.reporting_lines (organization_id, role, supervisor_role) VALUES (r.organization_id, r.subject_role, r.new_supervisor_role)
        ON CONFLICT (organization_id, role) DO UPDATE SET supervisor_role = excluded.supervisor_role;
      PERFORM private.reporting_log(r.organization_id, 'line_set', NULL, r.subject_role, jsonb_build_object('supervisor_role', r.new_supervisor_role, 'request', _id));
    ELSE
      DELETE FROM public.reporting_lines WHERE organization_id = r.organization_id AND role = r.subject_role;
      PERFORM private.reporting_log(r.organization_id, 'line_removed', NULL, r.subject_role, jsonb_build_object('request', _id));
    END IF;
  END IF;
  UPDATE public.reporting_change_requests SET status = CASE WHEN _approve THEN 'confirmed' ELSE 'rejected' END, decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(coalesce(_note, '')), '') WHERE id = _id;
  PERFORM private.reporting_log(r.organization_id, CASE WHEN _approve THEN 'change_confirmed' ELSE 'change_rejected' END, r.subject_user, r.subject_role, jsonb_build_object('request', _id, 'note', _note));
  IF r.requested_by IS NOT NULL THEN
    PERFORM public.notify_person(r.organization_id, r.requested_by, NULL, 'reporting_change', CASE WHEN _approve THEN 'Reporting change confirmed' ELSE 'Reporting change rejected' END,
      CASE WHEN _approve THEN 'The Super Admin confirmed your reporting-line change.' ELSE 'The Super Admin rejected your reporting-line change: ' || trim(_note) END, '/reporting-structure');
  END IF;
  RETURN CASE WHEN _approve THEN 'confirmed' ELSE 'rejected' END;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Reading: chart, gaps, requests, impact preview
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.reporting_can_read(_user uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND (public.is_super_admin(_user) OR public.has_org_role(_user, _org, ARRAY['organization_admin', 'admin', 'centre_manager', 'hr_officer', 'pa_to_centre_manager', 'head_of_finance_admin']));
$$;
REVOKE ALL ON FUNCTION private.reporting_can_read(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reporting_org_chart(_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.reporting_can_read(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'people', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'name', p.name, 'roles', p.roles, 'active', private.reporting_user_active(p.user_id),
        'protected', p.roles && private.reporting_protected_roles(),
        'supervisors', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', s, 'name', private.requisition_person(_org, s) ->> 'name', 'active', private.reporting_user_active(s))) FROM private.reporting_supervisors_at(_org, p.user_id, current_date) s), '[]'::jsonb),
        'source', CASE WHEN EXISTS (SELECT 1 FROM public.user_supervisors us WHERE us.organization_id = _org AND us.user_id = p.user_id AND us.effective_from <= current_date AND (us.effective_to IS NULL OR us.effective_to >= current_date)) THEN 'named' ELSE 'role' END,
        'named_until', (SELECT us.effective_to FROM public.user_supervisors us WHERE us.organization_id = _org AND us.user_id = p.user_id AND us.effective_from <= current_date AND (us.effective_to IS NULL OR us.effective_to >= current_date) LIMIT 1),
        'scheduled', coalesce((SELECT jsonb_agg(jsonb_build_object('supervisor', private.requisition_person(_org, us.supervisor_user_id) ->> 'name', 'from', us.effective_from, 'to', us.effective_to) ORDER BY us.effective_from)
                               FROM public.user_supervisors us WHERE us.organization_id = _org AND us.user_id = p.user_id AND us.effective_from > current_date), '[]'::jsonb)
      ) ORDER BY p.name)
      FROM (SELECT ur.user_id, coalesce(nullif(trim(max(pr.full_name)), ''), max(pr.email), 'Unnamed') AS name, array_agg(DISTINCT ur.role::text) AS roles
              FROM public.user_roles ur LEFT JOIN public.profiles pr ON pr.user_id = ur.user_id
             WHERE ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant') GROUP BY ur.user_id) p), '[]'::jsonb),
    'lines', coalesce((SELECT jsonb_agg(jsonb_build_object('role', rl.role, 'supervisor_role', rl.supervisor_role) ORDER BY rl.supervisor_role, rl.role) FROM public.reporting_lines rl WHERE rl.organization_id = _org), '[]'::jsonb),
    'protected_roles', to_jsonb(private.reporting_protected_roles()));
END $$;

CREATE OR REPLACE FUNCTION public.reporting_gaps(_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _gaps jsonb := '[]'::jsonb; r record;
BEGIN
  IF NOT private.reporting_can_read(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  -- people with nobody to submit to: their requisitions are blocked
  FOR r IN SELECT p.user_id, p.name, p.roles FROM (SELECT ur.user_id, coalesce(nullif(trim(max(pr.full_name)), ''), max(pr.email), 'Unnamed') AS name, array_agg(DISTINCT ur.role::text) AS roles
              FROM public.user_roles ur LEFT JOIN public.profiles pr ON pr.user_id = ur.user_id
             WHERE ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant') GROUP BY ur.user_id) p LOOP
    IF NOT EXISTS (SELECT 1 FROM private.reporting_supervisors_at(_org, r.user_id, current_date) s WHERE private.reporting_user_active(s)) THEN
      _gaps := _gaps || jsonb_build_object('kind', 'no_supervisor', 'user_id', r.user_id, 'name', r.name, 'roles', r.roles,
        'message', r.name || ' has no active supervisor, so their requisitions cannot be submitted');
    END IF;
  END LOOP;
  -- a named supervisor whose account is no longer active
  FOR r IN SELECT us.user_id, us.supervisor_user_id FROM public.user_supervisors us WHERE us.organization_id = _org AND us.effective_from <= current_date AND (us.effective_to IS NULL OR us.effective_to >= current_date) AND NOT private.reporting_user_active(us.supervisor_user_id) LOOP
    _gaps := _gaps || jsonb_build_object('kind', 'inactive_supervisor', 'user_id', r.user_id, 'name', private.requisition_person(_org, r.user_id) ->> 'name',
      'message', (private.requisition_person(_org, r.supervisor_user_id) ->> 'name') || ' is the named supervisor of ' || (private.requisition_person(_org, r.user_id) ->> 'name') || ' but their account is not active');
  END LOOP;
  -- a role line pointing at a role nobody holds
  FOR r IN SELECT rl.role, rl.supervisor_role FROM public.reporting_lines rl WHERE rl.organization_id = _org
             AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.organization_id = _org AND ur.role::text = rl.role)
             AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.organization_id = _org AND ur.role::text = rl.supervisor_role) LOOP
    _gaps := _gaps || jsonb_build_object('kind', 'empty_supervisor_role', 'role', r.role, 'supervisor_role', r.supervisor_role,
      'message', 'Nobody holds the role ' || replace(r.supervisor_role, '_', ' ') || ', which ' || replace(r.role, '_', ' ') || ' reports to');
  END LOOP;
  -- named supervisors ending soon
  FOR r IN SELECT us.user_id, us.effective_to FROM public.user_supervisors us WHERE us.organization_id = _org AND us.effective_to BETWEEN current_date AND current_date + 14 LOOP
    _gaps := _gaps || jsonb_build_object('kind', 'ending_soon', 'user_id', r.user_id, 'name', private.requisition_person(_org, r.user_id) ->> 'name',
      'message', (private.requisition_person(_org, r.user_id) ->> 'name') || '''s named supervisor ends on ' || to_char(r.effective_to, 'DD Mon YYYY'));
  END LOOP;
  RETURN _gaps;
END $$;

CREATE OR REPLACE FUNCTION public.reporting_change_requests_list(_org uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _super boolean := public.is_super_admin(auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF NOT _super AND (_org IS NULL OR NOT private.reporting_can_manage(auth.uid(), _org)) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'organization_id', c.organization_id, 'centre', o.name, 'kind', c.kind, 'status', c.status,
      'subject', CASE WHEN c.kind = 'line' THEN replace(c.subject_role, '_', ' ') ELSE private.requisition_person(c.organization_id, c.subject_user) ->> 'name' END,
      'subject_roles', CASE WHEN c.kind = 'supervisor' THEN (SELECT array_agg(DISTINCT ur.role::text) FROM public.user_roles ur WHERE ur.user_id = c.subject_user AND ur.organization_id = c.organization_id) END,
      'current', CASE WHEN c.kind = 'line' THEN (SELECT replace(rl.supervisor_role, '_', ' ') FROM public.reporting_lines rl WHERE rl.organization_id = c.organization_id AND rl.role = c.subject_role)
                      ELSE (SELECT string_agg(private.requisition_person(c.organization_id, s) ->> 'name', ', ') FROM private.reporting_supervisors_at(c.organization_id, c.subject_user, current_date) s) END,
      'proposed', CASE WHEN c.kind = 'line' THEN replace(c.new_supervisor_role, '_', ' ') ELSE private.requisition_person(c.organization_id, c.new_supervisor_user) ->> 'name' END,
      'effective_from', c.effective_from, 'effective_to', c.effective_to, 'note', c.note,
      'requested_by', private.requisition_person(c.organization_id, c.requested_by) ->> 'name', 'requested_at', c.requested_at,
      'decided_by', private.requisition_person(c.organization_id, c.decided_by) ->> 'name', 'decided_at', c.decided_at, 'decision_note', c.decision_note)
      ORDER BY (c.status = 'pending') DESC, c.requested_at DESC)
    FROM (SELECT * FROM public.reporting_change_requests x WHERE (_org IS NULL OR x.organization_id = _org) AND (x.status = 'pending' OR x.requested_at > now() - interval '90 days')
           ORDER BY (x.status = 'pending') DESC, x.requested_at DESC LIMIT 100) c JOIN public.organizations o ON o.id = c.organization_id), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.reporting_events_list(_org uuid, _limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.reporting_can_read(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event, 'subject', coalesce(private.requisition_person(_org, e.subject_user) ->> 'name', replace(e.subject_role, '_', ' ')), 'details', e.details, 'by', e.actor_name, 'role', e.actor_role, 'at', e.at) ORDER BY e.at DESC)
    FROM (SELECT * FROM public.reporting_events WHERE organization_id = _org ORDER BY at DESC LIMIT least(coalesce(_limit, 50), 200)) e), '[]'::jsonb);
END $$;

-- what a change would touch, and whether it is allowed, before anything is saved
CREATE OR REPLACE FUNCTION public.reporting_preview(_org uuid, _user uuid, _supervisor uuid DEFAULT NULL, _from date DEFAULT current_date, _to date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _problem text; _prot boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT private.reporting_can_manage(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF _supervisor IS NOT NULL THEN _problem := private.reporting_problem(_org, _user, _supervisor, coalesce(_from, current_date), _to); END IF;
  _prot := EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user AND ur.organization_id = _org AND ur.role::text = ANY (private.reporting_protected_roles()));
  RETURN jsonb_build_object(
    'problem', _problem,
    'needs_super_admin', _prot AND NOT public.is_super_admin(auth.uid()),
    'current', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', s, 'name', private.requisition_person(_org, s) ->> 'name')) FROM private.reporting_supervisors_at(_org, _user, current_date) s), '[]'::jsonb),
    'direct_reports', coalesce((SELECT jsonb_agg(DISTINCT private.requisition_person(_org, ur.user_id) ->> 'name') FROM public.user_roles ur
        WHERE ur.organization_id = _org AND ur.user_id <> _user AND _user IN (SELECT private.reporting_supervisors_at(_org, ur.user_id, current_date))), '[]'::jsonb),
    'pending_approvals', coalesce((SELECT jsonb_agg(jsonb_build_object('instance_id', i.id, 'reference', i.reference, 'title', i.title, 'task_id', t.id, 'step', t.step_name,
          'approvers', (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', a.user_id, 'name', private.requisition_person(_org, a.user_id) ->> 'name')), '[]'::jsonb) FROM public.workflow_task_assignees a WHERE a.task_id = t.id)) ORDER BY i.started_at)
        FROM public.workflow_instances i JOIN public.workflow_tasks t ON t.instance_id = i.id AND t.status = 'pending'
        JOIN public.workflow_steps s ON s.definition_id = i.definition_id AND s.step_no = t.step_no AND s.approver_role ~ '^@supervisor[1-3]?$'
        WHERE i.organization_id = _org AND i.started_by = _user AND i.status IN ('in_progress', 'awaiting_info')), '[]'::jsonb));
END $$;

-- ---------------------------------------------------------------------------
-- 6. Moving waiting approvals (explicit, audited; decisions already taken are never touched)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reporting_reassign_pending(_org uuid, _submitter uuid, _from_user uuid, _to_user uuid, _reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; _moved integer := 0; _skipped integer := 0; _super boolean := public.is_super_admin(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR NOT private.reporting_can_manage(auth.uid(), _org) THEN RAISE EXCEPTION 'Only the Organisation Admin reassigns waiting approvals' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'Give the reason for moving these approvals'; END IF;
  IF _to_user IS NULL OR _to_user = _from_user THEN RAISE EXCEPTION 'Choose a different person to take over'; END IF;
  IF _to_user = _submitter THEN RAISE EXCEPTION 'The person who submitted the request cannot approve it'; END IF;
  IF _to_user = auth.uid() AND NOT _super THEN RAISE EXCEPTION 'Administrators cannot assign approvals to themselves'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _to_user AND ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant')) THEN RAISE EXCEPTION 'The new approver must hold a staff role at this centre'; END IF;
  IF NOT private.reporting_user_active(_to_user) THEN RAISE EXCEPTION 'The new approver''s account is not active'; END IF;
  FOR t IN SELECT wt.id AS task_id, wt.instance_id, i.reference
             FROM public.workflow_tasks wt JOIN public.workflow_instances i ON i.id = wt.instance_id
             JOIN public.workflow_steps s ON s.definition_id = i.definition_id AND s.step_no = wt.step_no AND s.approver_role ~ '^@supervisor[1-3]?$'
             JOIN public.workflow_task_assignees a ON a.task_id = wt.id AND a.user_id = _from_user
            WHERE i.organization_id = _org AND i.started_by = _submitter AND wt.status = 'pending' AND i.status IN ('in_progress', 'awaiting_info') FOR UPDATE OF wt LOOP
    -- one person never decides two stages of the same request
    IF EXISTS (SELECT 1 FROM public.workflow_tasks x WHERE x.instance_id = t.instance_id AND x.acted_by = _to_user AND x.status = 'approved') THEN _skipped := _skipped + 1; CONTINUE; END IF;
    DELETE FROM public.workflow_task_assignees WHERE task_id = t.task_id AND user_id = _from_user;
    INSERT INTO public.workflow_task_assignees (task_id, user_id, reason) VALUES (t.task_id, _to_user, 'step') ON CONFLICT DO NOTHING;
    PERFORM public.workflow_log(t.instance_id, t.task_id, 'reassigned', auth.uid(), 'app', 'Moved from ' || (private.requisition_person(_org, _from_user) ->> 'name') || ' to ' || (private.requisition_person(_org, _to_user) ->> 'name') || ': ' || trim(_reason));
    PERFORM public.notify_person(_org, _to_user, NULL, 'workflow', 'Approval reassigned to you: ' || coalesce(t.reference, ''), 'An approval waiting for ' || (private.requisition_person(_org, _from_user) ->> 'name') || ' was reassigned to you. Open My Approvals.', '/my-approvals');
    _moved := _moved + 1;
  END LOOP;
  PERFORM private.reporting_log(_org, 'approvals_reassigned', _submitter, NULL, jsonb_build_object('from', _from_user, 'to', _to_user, 'moved', _moved, 'skipped', _skipped, 'reason', trim(_reason)));
  RETURN jsonb_build_object('moved', _moved, 'skipped', _skipped);
END $$;

REVOKE ALL ON FUNCTION public.reporting_set_supervisor(uuid, uuid, uuid, date, date, text), public.reporting_remove_supervisor(uuid, uuid, date), public.reporting_set_line(uuid, text, text),
  public.reporting_remove_line(uuid, text), public.reporting_withdraw_change(uuid), public.reporting_decide_change(uuid, boolean, text), public.reporting_org_chart(uuid), public.reporting_gaps(uuid),
  public.reporting_change_requests_list(uuid), public.reporting_events_list(uuid, integer), public.reporting_preview(uuid, uuid, uuid, date, date), public.reporting_reassign_pending(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reporting_set_supervisor(uuid, uuid, uuid, date, date, text), public.reporting_remove_supervisor(uuid, uuid, date), public.reporting_set_line(uuid, text, text),
  public.reporting_remove_line(uuid, text), public.reporting_withdraw_change(uuid), public.reporting_decide_change(uuid, boolean, text), public.reporting_org_chart(uuid), public.reporting_gaps(uuid),
  public.reporting_change_requests_list(uuid), public.reporting_events_list(uuid, integer), public.reporting_preview(uuid, uuid, uuid, date, date), public.reporting_reassign_pending(uuid, uuid, uuid, uuid, text) TO authenticated, service_role;
