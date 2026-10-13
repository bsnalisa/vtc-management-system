-- Organisational hierarchy and supervisor routing for the workflow engine (extends 20261009090000_workflow_engine).
--  * reporting_lines: which role reports to which, per centre (seeded with the default matrix, editable by admins).
--  * user_supervisors: optional per-person override of the role-based line.
--  * Workflow steps can name "the submitter's direct supervisor" (@supervisor, @supervisor2, ...) instead of a fixed role.
--  * Every request gets a reference number, the submitter's role and a next action; the status set gains
--    draft / completed, and supervisors can escalate to the next level or return a request for correction.

-- ---------------------------------------------------------------------------
-- 1. Roles must be assignable
-- ---------------------------------------------------------------------------
INSERT INTO public.custom_roles (role_code, role_name, description, is_system_role, active) VALUES
  ('accountant', 'Accountant', 'Prepares financial transactions and reports for the Head of Finance and Administration', true, true),
  ('head_of_finance_admin', 'Head of Finance and Administration', 'Supervises the finance and administration officers and approves their submissions', true, true),
  ('creditors_officer', 'Creditor''s Officer', 'Records supplier invoices and prepares payment requests', true, true),
  ('loan_officer', 'Loan Officer', 'Registers and assesses loan applications and monitors repayments', true, true),
  ('pa_to_centre_manager', 'PA to Centre Manager', 'Coordinates the Centre Manager''s correspondence, schedule and follow-ups', true, true)
ON CONFLICT (role_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Reporting lines
-- ---------------------------------------------------------------------------
CREATE TABLE public.reporting_lines (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL,
  supervisor_role text NOT NULL,
  PRIMARY KEY (organization_id, role),
  CHECK (role <> supervisor_role)
);
CREATE TABLE public.user_supervisors (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  supervisor_user_id uuid NOT NULL,
  PRIMARY KEY (organization_id, user_id),
  CHECK (user_id <> supervisor_user_id)
);
ALTER TABLE public.reporting_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_supervisors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read their centre's reporting lines" ON public.reporting_lines FOR SELECT TO authenticated
  USING (organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
CREATE POLICY "Workflow admins manage reporting lines" ON public.reporting_lines FOR ALL TO authenticated
  USING (public.is_workflow_admin(auth.uid(), organization_id)) WITH CHECK (public.is_workflow_admin(auth.uid(), organization_id));
CREATE POLICY "Staff read their centre's supervisor overrides" ON public.user_supervisors FOR SELECT TO authenticated
  USING (organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
CREATE POLICY "Workflow admins manage supervisor overrides" ON public.user_supervisors FOR ALL TO authenticated
  USING (public.is_workflow_admin(auth.uid(), organization_id)) WITH CHECK (public.is_workflow_admin(auth.uid(), organization_id));

DO $$
DECLARE t text; expr text := 'NOT (SELECT public.is_centre_scoped_user()) OR (%1$I.organization_id IS NULL OR %1$I.organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['reporting_lines', 'user_supervisors'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Centre isolation" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (' || expr || ') WITH CHECK (' || expr || ')', t, t, t, t);
  END LOOP;
END $$;

-- The default matrix
CREATE OR REPLACE FUNCTION public.seed_reporting_lines(_org uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.reporting_lines (organization_id, role, supervisor_role)
  SELECT _org, v.r, v.s FROM (VALUES
    ('head_of_finance_admin', 'centre_manager'), ('head_of_training', 'centre_manager'), ('head_of_trainee_support', 'centre_manager'),
    ('projects_coordinator', 'centre_manager'), ('pa_to_centre_manager', 'centre_manager'),
    ('accountant', 'head_of_finance_admin'), ('creditors_officer', 'head_of_finance_admin'), ('debtor_officer', 'head_of_finance_admin'),
    ('loan_officer', 'head_of_finance_admin'), ('asset_maintenance_coordinator', 'head_of_finance_admin'), ('maintenance_coordinator', 'head_of_finance_admin'),
    ('trainer', 'head_of_training'), ('assessment_coordinator', 'head_of_training'), ('rpl_coordinator', 'head_of_training'),
    ('liaison_officer', 'head_of_trainee_support'), ('placement_officer', 'head_of_trainee_support'),
    ('registration_officer', 'head_of_trainee_support'), ('resource_center_coordinator', 'head_of_trainee_support')
  ) v(r, s)
  ON CONFLICT DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.seed_reporting_lines(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.org_seed_reporting_lines() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.seed_reporting_lines(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER trg_org_seed_reporting_lines AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.org_seed_reporting_lines();
SELECT public.seed_reporting_lines(id) FROM public.organizations;

-- Who supervises this person? A named override wins; otherwise everyone holding the supervisor role at the centre.
CREATE OR REPLACE FUNCTION public.workflow_supervisors_of(_org uuid, _user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT us.supervisor_user_id FROM public.user_supervisors us WHERE us.organization_id = _org AND us.user_id = _user
  UNION
  SELECT DISTINCT ur.user_id FROM public.user_roles ur
  WHERE ur.organization_id = _org AND ur.user_id <> _user
    AND NOT EXISTS (SELECT 1 FROM public.user_supervisors us WHERE us.organization_id = _org AND us.user_id = _user)
    AND ur.role::text IN (SELECT rl.supervisor_role FROM public.reporting_lines rl
                          WHERE rl.organization_id = _org
                            AND rl.role IN (SELECT r2.role::text FROM public.user_roles r2 WHERE r2.user_id = _user AND r2.organization_id = _org));
$$;
REVOKE ALL ON FUNCTION public.workflow_supervisors_of(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- The supervisors N levels up (1 = direct supervisor, 2 = their supervisor, ...)
CREATE OR REPLACE FUNCTION public.workflow_supervisor_level(_org uuid, _user uuid, _level integer)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cur uuid[] := ARRAY[_user]; nxt uuid[]; i integer;
BEGIN
  FOR i IN 1.._level LOOP
    SELECT COALESCE(array_agg(DISTINCT s), ARRAY[]::uuid[]) INTO nxt FROM unnest(cur) u, LATERAL public.workflow_supervisors_of(_org, u) s;
    cur := nxt;
    EXIT WHEN cardinality(cur) = 0;
  END LOOP;
  RETURN cur;
END $$;
REVOKE ALL ON FUNCTION public.workflow_supervisor_level(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

-- The submitter's role for display: the first role that has a reporting line, else any role
CREATE OR REPLACE FUNCTION public.workflow_submitter_role(_org uuid, _user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT ur.role::text FROM public.user_roles ur JOIN public.reporting_lines rl ON rl.organization_id = ur.organization_id AND rl.role = ur.role::text
      WHERE ur.user_id = _user AND ur.organization_id = _org LIMIT 1),
    (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = _user AND ur.organization_id = _org LIMIT 1));
$$;
REVOKE ALL ON FUNCTION public.workflow_submitter_role(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Workflow schema extensions
-- ---------------------------------------------------------------------------
ALTER TABLE public.workflow_instances DROP CONSTRAINT IF EXISTS workflow_instances_status_check;
ALTER TABLE public.workflow_instances ADD CONSTRAINT workflow_instances_status_check
  CHECK (status IN ('draft','in_progress','awaiting_info','approved','rejected','cancelled','completed'));
ALTER TABLE public.workflow_tasks DROP CONSTRAINT IF EXISTS workflow_tasks_status_check;
ALTER TABLE public.workflow_tasks ADD CONSTRAINT workflow_tasks_status_check
  CHECK (status IN ('pending','approved','rejected','info_requested','cancelled','escalated'));

ALTER TABLE public.workflow_instances
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS submitter_role text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resubmitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resubmissions integer NOT NULL DEFAULT 0;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS higher_level boolean NOT NULL DEFAULT false;

CREATE SEQUENCE IF NOT EXISTS public.workflow_reference_seq;
CREATE OR REPLACE FUNCTION public.workflow_instance_defaults() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reference IS NULL THEN NEW.reference := 'WF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.workflow_reference_seq')::text, 6, '0'); END IF;
  IF NEW.submitter_role IS NULL AND NEW.started_by IS NOT NULL THEN NEW.submitter_role := public.workflow_submitter_role(NEW.organization_id, NEW.started_by); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_workflow_instance_defaults BEFORE INSERT ON public.workflow_instances FOR EACH ROW EXECUTE FUNCTION public.workflow_instance_defaults();

-- Existing requests get a reference too (oldest first)
UPDATE public.workflow_instances i SET reference = 'WF-' || to_char(i.started_at, 'YYYY') || '-' || lpad(nextval('public.workflow_reference_seq')::text, 6, '0')
FROM (SELECT id FROM public.workflow_instances WHERE reference IS NULL ORDER BY started_at, id) o WHERE o.id = i.id;
UPDATE public.workflow_instances SET submitter_role = public.workflow_submitter_role(organization_id, started_by) WHERE submitter_role IS NULL AND started_by IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_instances_reference ON public.workflow_instances (reference);

-- The audit trail is permanent: events can be added, never changed
CREATE OR REPLACE FUNCTION public.workflow_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'The approval history cannot be changed'; END $$;
DROP TRIGGER IF EXISTS trg_workflow_events_append_only ON public.workflow_events;
CREATE TRIGGER trg_workflow_events_append_only BEFORE UPDATE ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION public.workflow_events_append_only();

-- ---------------------------------------------------------------------------
-- 4. Engine: supervisor steps, next action, escalation, resubmission
-- ---------------------------------------------------------------------------
-- Names for the "next action" line
CREATE OR REPLACE FUNCTION public.workflow_people_names(_ids uuid[])
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(COALESCE(p.full_name, p.email, 'a colleague'), ', ' ORDER BY p.full_name), 'nobody')
  FROM public.profiles p WHERE p.user_id = ANY (_ids);
$$;
REVOKE ALL ON FUNCTION public.workflow_people_names(uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.workflow_open_step(_instance uuid, _step_no integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE; s public.workflow_steps%ROWTYPE; _task uuid; _n integer := 0; r record; a record; _lvl integer; _ids uuid[];
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  SELECT * INTO s FROM public.workflow_steps WHERE definition_id = i.definition_id AND step_no = _step_no;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow step % not found', _step_no; END IF;

  INSERT INTO public.workflow_tasks (instance_id, step_no, step_name, due_at)
  VALUES (i.id, s.step_no, s.name, CASE WHEN s.sla_hours IS NULL THEN NULL ELSE now() + make_interval(hours => s.sla_hours) END)
  RETURNING id INTO _task;

  IF s.approver_user IS NOT NULL THEN
    INSERT INTO public.workflow_task_assignees (task_id, user_id, reason) VALUES (_task, s.approver_user, 'step');
  ELSIF s.approver_role ~ '^@supervisor[1-3]?$' THEN
    -- the submitter's direct supervisor (or the one N levels above)
    _lvl := COALESCE(NULLIF(substring(s.approver_role from '[1-3]$'), '')::integer, 1);
    INSERT INTO public.workflow_task_assignees (task_id, user_id, reason)
    SELECT _task, u, 'step' FROM unnest(public.workflow_supervisor_level(i.organization_id, i.started_by, _lvl)) u ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.workflow_task_assignees (task_id, user_id, reason)
    SELECT DISTINCT _task, ur.user_id, 'step' FROM public.user_roles ur
    WHERE ur.organization_id = i.organization_id AND ur.role::text = s.approver_role
    ON CONFLICT DO NOTHING;
  END IF;
  -- the starter cannot approve their own request unless the step allows it (separation of duties)
  IF NOT s.allow_self_approval AND i.started_by IS NOT NULL THEN
    DELETE FROM public.workflow_task_assignees WHERE task_id = _task AND user_id = i.started_by;
  END IF;

  -- a submitter with no reporting line (or whose supervisor is themselves) goes to the Centre Manager
  IF s.approver_role ~ '^@supervisor[1-3]?$' AND NOT EXISTS (SELECT 1 FROM public.workflow_task_assignees WHERE task_id = _task) THEN
    INSERT INTO public.workflow_task_assignees (task_id, user_id, reason)
    SELECT DISTINCT _task, ur.user_id, 'step' FROM public.user_roles ur
    WHERE ur.organization_id = i.organization_id AND ur.role::text = 'centre_manager' AND ur.user_id IS DISTINCT FROM i.started_by
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*), array_agg(user_id) INTO _n, _ids FROM public.workflow_task_assignees WHERE task_id = _task;
  PERFORM public.workflow_log(i.id, _task, 'step_opened', NULL, 'system', s.name);
  UPDATE public.workflow_instances SET escalated = s.higher_level, resubmitted = false,
         next_action = CASE WHEN _n = 0 THEN 'No approver found for "' || s.name || '": an administrator must fix the reporting line'
                            ELSE s.name || ': waiting for ' || public.workflow_people_names(_ids) END
   WHERE id = i.id;

  IF _n = 0 THEN
    PERFORM public.workflow_log(i.id, _task, 'no_assignees', NULL, 'system', 'No eligible approver for step ' || s.step_no);
    FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = i.organization_id AND ur.role::text IN ('admin','organization_admin') LOOP
      PERFORM public.workflow_notify(i.organization_id, r.user_id, 'task_escalated', 'Workflow step has no approver: ' || i.title,
        'Step ' || s.step_no || ' (' || s.name || ') has nobody to approve it.', '/workflows', 'Step ' || s.step_no || ' (' || s.name || ') of "' || i.title || '" has no eligible approver. Check the reporting lines and role assignments.');
    END LOOP;
  ELSE
    FOR a IN SELECT user_id FROM public.workflow_task_assignees WHERE task_id = _task LOOP
      PERFORM public.workflow_announce_task(_task, a.user_id, 'task_assigned', 'Approval needed');
    END LOOP;
  END IF;
  RETURN _task;
END $$;
REVOKE ALL ON FUNCTION public.workflow_open_step(uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.workflow_complete(_instance uuid, _outcome text, _comment text, _actor uuid, _via text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  UPDATE public.workflow_instances SET status = _outcome, completed_at = now(), outcome_comment = _comment, escalated = false, resubmitted = false,
         next_action = CASE _outcome WHEN 'approved' THEN 'Approved: any further processing is recorded separately' WHEN 'rejected' THEN 'None: rejected' ELSE 'None: cancelled' END
   WHERE id = _instance RETURNING * INTO i;
  UPDATE public.workflow_tasks SET status = 'cancelled' WHERE instance_id = _instance AND status IN ('pending','info_requested');
  PERFORM public.workflow_log(_instance, NULL, 'completed_' || _outcome, _actor, _via, _comment);
  IF _outcome IN ('approved','rejected') THEN PERFORM public.workflow_apply_result(_instance, _outcome, _comment); END IF;
  PERFORM public.workflow_notify(i.organization_id, i.started_by, 'completed',
    CASE _outcome WHEN 'approved' THEN 'Approved: ' WHEN 'rejected' THEN 'Rejected: ' ELSE 'Cancelled: ' END || i.reference || ' ' || i.title,
    COALESCE(_comment, 'The approval process has finished.'), '/my-approvals',
    i.reference || ' ' || i.title || E'\nOutcome: ' || _outcome || COALESCE(E'\nComment: ' || _comment, ''));
END $$;
REVOKE ALL ON FUNCTION public.workflow_complete(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.workflow_resume(_instance uuid, _actor uuid, _comment text, _via text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.workflow_tasks%ROWTYPE; s public.workflow_steps%ROWTYPE; i public.workflow_instances%ROWTYPE; a record; _ids uuid[];
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  SELECT * INTO t FROM public.workflow_tasks WHERE instance_id = _instance AND status = 'info_requested' ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No information has been requested'; END IF;
  SELECT s2.* INTO s FROM public.workflow_steps s2 WHERE s2.definition_id = i.definition_id AND s2.step_no = t.step_no;
  UPDATE public.workflow_tasks SET status = 'pending', escalated_at = CASE WHEN t.step_name LIKE 'Higher-level approval%' THEN t.escalated_at ELSE NULL END,
         due_at = CASE WHEN s.sla_hours IS NULL THEN NULL ELSE now() + make_interval(hours => s.sla_hours) END
   WHERE id = t.id;
  SELECT array_agg(user_id) INTO _ids FROM public.workflow_task_assignees WHERE task_id = t.id;
  UPDATE public.workflow_instances SET status = 'in_progress', resubmitted = true, resubmissions = resubmissions + 1,
         next_action = t.step_name || ': waiting for ' || public.workflow_people_names(_ids) WHERE id = _instance;
  PERFORM public.workflow_log(_instance, t.id, 'info_provided', _actor, _via, _comment);
  FOR a IN SELECT user_id FROM public.workflow_task_assignees WHERE task_id = t.id LOOP
    PERFORM public.workflow_announce_task(t.id, a.user_id, 'task_assigned', 'Corrected and resubmitted, approval needed');
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.workflow_resume(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- The one place decisions are made. Actions: approve, reject (reason required), request_info = return for correction
-- (comments required), escalate = send to the actor's own supervisor for a higher-level decision (comments required).
CREATE OR REPLACE FUNCTION public.workflow_act_as(_actor uuid, _task uuid, _action text, _comment text, _via text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.workflow_tasks%ROWTYPE; i public.workflow_instances%ROWTYPE; s public.workflow_steps%ROWTYPE; _next integer;
        _targets uuid[]; _new uuid; a record;
BEGIN
  IF _action NOT IN ('approve','reject','request_info','escalate') THEN RAISE EXCEPTION 'Unknown action'; END IF;
  SELECT * INTO t FROM public.workflow_tasks WHERE id = _task FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  SELECT * INTO i FROM public.workflow_instances WHERE id = t.instance_id FOR UPDATE;
  IF t.status <> 'pending' OR i.status <> 'in_progress' THEN RAISE EXCEPTION 'This request is no longer waiting for a decision'; END IF;
  IF NOT public.workflow_can_act(_actor, _task) THEN RAISE EXCEPTION 'You are not an approver for this step'; END IF;
  SELECT * INTO s FROM public.workflow_steps WHERE definition_id = i.definition_id AND step_no = t.step_no;
  IF _actor = i.started_by AND NOT COALESCE(s.allow_self_approval, false) THEN RAISE EXCEPTION 'You cannot decide on your own request'; END IF;
  IF _action IN ('reject','request_info','escalate') AND COALESCE(trim(_comment), '') = '' THEN
    RAISE EXCEPTION 'A comment is required when you % a request',
      CASE _action WHEN 'reject' THEN 'reject' WHEN 'escalate' THEN 'escalate' ELSE 'return for correction' END;
  END IF;

  IF _action = 'request_info' THEN
    UPDATE public.workflow_tasks SET status = 'info_requested', acted_by = _actor, acted_at = now(), comment = _comment WHERE id = t.id;
    UPDATE public.workflow_instances SET status = 'awaiting_info', resubmitted = false, next_action = 'Returned for correction: the submitter must update and resubmit' WHERE id = i.id;
    UPDATE public.workflow_action_tokens SET used_at = now() WHERE task_id = t.id AND used_at IS NULL;
    PERFORM public.workflow_log(i.id, t.id, 'info_requested', _actor, _via, _comment);
    PERFORM public.workflow_notify(i.organization_id, i.started_by, 'info_requested', 'Returned for correction: ' || i.reference || ' ' || i.title,
      _comment, '/my-approvals', i.reference || ' ' || i.title || E'\nReturned for correction:\n' || _comment || E'\n\nOpen My Approvals to correct and resubmit.');
    RETURN 'awaiting_info';
  END IF;

  IF _action = 'escalate' THEN
    _targets := public.workflow_supervisor_level(i.organization_id, _actor, 1);
    _targets := array_remove(_targets, i.started_by);
    IF cardinality(_targets) = 0 THEN RAISE EXCEPTION 'There is nobody above you to escalate this to'; END IF;
    UPDATE public.workflow_tasks SET status = 'escalated', acted_by = _actor, acted_at = now(), comment = _comment WHERE id = t.id;
    UPDATE public.workflow_action_tokens SET used_at = now() WHERE task_id = t.id AND used_at IS NULL;
    INSERT INTO public.workflow_tasks (instance_id, step_no, step_name, escalated_at, due_at)
    VALUES (i.id, t.step_no, 'Higher-level approval: ' || regexp_replace(t.step_name, '^Higher-level approval: ', ''), now(),
            CASE WHEN s.sla_hours IS NULL THEN NULL ELSE now() + make_interval(hours => s.sla_hours) END) RETURNING id INTO _new;
    INSERT INTO public.workflow_task_assignees (task_id, user_id, reason) SELECT _new, u, 'escalation' FROM unnest(_targets) u ON CONFLICT DO NOTHING;
    UPDATE public.workflow_instances SET escalated = true, resubmitted = false,
           next_action = 'Higher-level approval: waiting for ' || public.workflow_people_names(_targets) WHERE id = i.id;
    PERFORM public.workflow_log(i.id, t.id, 'escalated_by_approver', _actor, _via, _comment);
    FOR a IN SELECT user_id FROM public.workflow_task_assignees WHERE task_id = _new LOOP
      PERFORM public.workflow_announce_task(_new, a.user_id, 'task_escalated', 'Escalated for your approval');
    END LOOP;
    PERFORM public.workflow_notify(i.organization_id, i.started_by, 'task_escalated', 'Escalated: ' || i.reference || ' ' || i.title,
      'Your request needs higher-level approval.', '/my-approvals', i.reference || ' ' || i.title || E'\nEscalated for higher-level approval:\n' || _comment);
    RETURN 'escalated';
  END IF;

  UPDATE public.workflow_tasks SET status = CASE _action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
         acted_by = _actor, acted_at = now(), comment = _comment WHERE id = t.id;
  UPDATE public.workflow_action_tokens SET used_at = now() WHERE task_id = t.id AND used_at IS NULL;
  PERFORM public.workflow_log(i.id, t.id, CASE _action WHEN 'approve' THEN 'approved' ELSE 'rejected' END, _actor, _via, _comment);

  IF _action = 'reject' THEN
    PERFORM public.workflow_complete(i.id, 'rejected', _comment, _actor, _via);
    RETURN 'rejected';
  END IF;

  SELECT min(step_no) INTO _next FROM public.workflow_steps WHERE definition_id = i.definition_id AND step_no > t.step_no;
  IF _next IS NULL THEN
    PERFORM public.workflow_complete(i.id, 'approved', _comment, _actor, _via);
    RETURN 'approved';
  END IF;
  UPDATE public.workflow_instances SET current_step = _next WHERE id = i.id;
  PERFORM public.workflow_notify(i.organization_id, i.started_by, 'task_assigned', 'Step approved: ' || i.reference || ' ' || i.title,
    'Step ' || t.step_no || ' (' || t.step_name || ') was approved. The request moves on.', '/my-approvals',
    i.reference || ' ' || i.title || E'\nStep ' || t.step_no || ' approved; moving to the next approval.');
  PERFORM public.workflow_open_step(i.id, _next);
  RETURN 'in_progress';
END $$;
REVOKE ALL ON FUNCTION public.workflow_act_as(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Steps may name the submitter's supervisor instead of a fixed role, and can be flagged as the higher level
CREATE OR REPLACE FUNCTION public.workflow_save_steps(_definition uuid, _steps jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.workflow_definitions%ROWTYPE; s jsonb; i integer := 0;
BEGIN
  SELECT * INTO d FROM public.workflow_definitions WHERE id = _definition;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow not found'; END IF;
  IF NOT public.is_workflow_admin(auth.uid(), d.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF jsonb_typeof(_steps) <> 'array' THEN RAISE EXCEPTION 'Steps must be a list'; END IF;
  IF d.active AND jsonb_array_length(_steps) = 0 THEN RAISE EXCEPTION 'An active workflow needs at least one step'; END IF;

  DELETE FROM public.workflow_steps WHERE definition_id = _definition;
  FOR s IN SELECT * FROM jsonb_array_elements(_steps) LOOP
    i := i + 1;
    IF COALESCE(trim(s->>'name'), '') = '' THEN RAISE EXCEPTION 'Step % needs a name', i; END IF;
    IF (NULLIF(s->>'approver_role', '') IS NULL) = (NULLIF(s->>'approver_user', '') IS NULL) THEN
      RAISE EXCEPTION 'Step % needs either a role or a named person to approve', i;
    END IF;
    IF NULLIF(s->>'approver_role', '') IS NOT NULL AND s->>'approver_role' !~ '^@supervisor[1-3]?$' AND NOT EXISTS (
         SELECT 1 FROM public.custom_roles r WHERE r.role_code = s->>'approver_role' AND r.active AND (r.organization_id IS NULL OR r.organization_id = d.organization_id)) THEN
      RAISE EXCEPTION 'Step %: the role "%" does not exist', i, s->>'approver_role';
    END IF;
    INSERT INTO public.workflow_steps (definition_id, step_no, name, approver_role, approver_user, sla_hours, escalate_to_role, escalate_to_user, allow_self_approval, higher_level)
    VALUES (_definition, i, trim(s->>'name'), NULLIF(s->>'approver_role', ''), NULLIF(s->>'approver_user', '')::uuid,
            NULLIF(s->>'sla_hours', '')::integer, NULLIF(s->>'escalate_to_role', ''), NULLIF(s->>'escalate_to_user', '')::uuid,
            COALESCE((s->>'allow_self_approval')::boolean, false), COALESCE((s->>'higher_level')::boolean, false));
  END LOOP;
  UPDATE public.workflow_definitions SET updated_at = now() WHERE id = _definition;
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_save_steps(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Drafts, submission, cancellation and completion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workflow_create_request(_process text, _title text, _description text, _submit boolean DEFAULT true, _draft uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _d public.workflow_definitions%ROWTYPE; _i public.workflow_instances%ROWTYPE; _name text; _sum jsonb;
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF COALESCE(trim(_title), '') = '' THEN RAISE EXCEPTION 'Give the request a title'; END IF;
  SELECT full_name INTO _name FROM public.profiles WHERE user_id = auth.uid();
  _sum := jsonb_build_object('Requested by', COALESCE(_name, 'Unknown'), 'Details', COALESCE(_description, ''));

  IF _draft IS NOT NULL THEN
    SELECT * INTO _i FROM public.workflow_instances WHERE id = _draft;
    IF NOT FOUND OR _i.started_by IS DISTINCT FROM auth.uid() OR _i.status <> 'draft' THEN RAISE EXCEPTION 'That draft cannot be changed'; END IF;
    UPDATE public.workflow_instances SET title = trim(_title), summary = _sum WHERE id = _draft;
  ELSE
    SELECT * INTO _d FROM public.workflow_definitions WHERE organization_id = _org AND process_type = _process AND active;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.workflow_steps WHERE definition_id = _d.id) THEN
      RAISE EXCEPTION 'No approval workflow is set up for this kind of request yet. Ask an administrator.';
    END IF;
    INSERT INTO public.workflow_instances (organization_id, definition_id, process_type, title, summary, started_by, status)
    VALUES (_org, _d.id, _process, trim(_title), _sum, auth.uid(), 'draft') RETURNING * INTO _i;
    _draft := _i.id;
    PERFORM public.workflow_log(_draft, NULL, 'draft_saved', auth.uid(), 'app', trim(_title));
  END IF;
  IF _submit THEN PERFORM public.workflow_submit(_draft); END IF;
  RETURN _draft;
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_create_request(text, text, text, boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.workflow_submit(_instance uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE; _first integer;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance FOR UPDATE;
  IF NOT FOUND OR i.started_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who made the request can submit it'; END IF;
  IF i.status <> 'draft' THEN RAISE EXCEPTION 'This request has already been submitted'; END IF;
  SELECT min(step_no) INTO _first FROM public.workflow_steps WHERE definition_id = i.definition_id;
  IF _first IS NULL THEN RAISE EXCEPTION 'This workflow has no steps'; END IF;
  UPDATE public.workflow_instances SET status = 'in_progress', current_step = _first, started_at = now() WHERE id = _instance;
  PERFORM public.workflow_log(_instance, NULL, 'submitted', auth.uid(), 'app', i.title);
  PERFORM public.workflow_open_step(_instance, _first);
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_submit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.workflow_cancel(_instance uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT (i.started_by = auth.uid() OR public.is_workflow_admin(auth.uid(), i.organization_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF i.status NOT IN ('draft','in_progress','awaiting_info') THEN RAISE EXCEPTION 'This request has already finished'; END IF;
  PERFORM public.workflow_complete(_instance, 'cancelled', _reason, auth.uid(), 'app');
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_cancel(uuid, text) TO authenticated;

-- Approved is not the same as done: whoever carries out the approved action marks it completed.
CREATE OR REPLACE FUNCTION public.workflow_mark_completed(_instance uuid, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT (i.started_by = auth.uid() OR public.is_workflow_admin(auth.uid(), i.organization_id)
          OR EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.instance_id = i.id AND t.acted_by = auth.uid())) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF i.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved request can be marked completed'; END IF;
  UPDATE public.workflow_instances SET status = 'completed', completed_at = now(), next_action = 'None: completed' WHERE id = _instance;
  PERFORM public.workflow_log(_instance, NULL, 'completed', auth.uid(), 'app', _comment);
  PERFORM public.workflow_notify(i.organization_id, i.started_by, 'completed', 'Completed: ' || i.reference || ' ' || i.title,
    COALESCE(_comment, 'Processing of the approved request is complete.'), '/my-approvals', i.reference || ' ' || i.title || ' is complete.');
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_mark_completed(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Tasks list gains reference, submitter role, next action and the higher-level flag
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.workflow_my_tasks();
CREATE FUNCTION public.workflow_my_tasks()
RETURNS TABLE (task_id uuid, instance_id uuid, process_type text, title text, summary jsonb, step_no integer, step_name text,
               due_at timestamptz, escalated boolean, delegated boolean, requested_by text, started_at timestamptz,
               reference text, submitter_role text, next_action text, can_escalate boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, i.id, i.process_type, i.title, i.summary, t.step_no, t.step_name, t.due_at, t.escalated_at IS NOT NULL,
         NOT EXISTS (SELECT 1 FROM public.workflow_task_assignees a WHERE a.task_id = t.id AND a.user_id = auth.uid()),
         (SELECT p.full_name FROM public.profiles p WHERE p.user_id = i.started_by), i.started_at,
         i.reference, i.submitter_role, i.next_action,
         EXISTS (SELECT 1 FROM public.workflow_supervisors_of(i.organization_id, auth.uid()) x WHERE x <> i.started_by)
  FROM public.workflow_tasks t JOIN public.workflow_instances i ON i.id = t.instance_id
  WHERE t.status = 'pending' AND i.status = 'in_progress' AND public.workflow_can_act(auth.uid(), t.id)
    AND NOT (i.started_by = auth.uid() AND NOT COALESCE((SELECT s.allow_self_approval FROM public.workflow_steps s WHERE s.definition_id = i.definition_id AND s.step_no = t.step_no), false))
  ORDER BY t.due_at NULLS LAST, t.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.workflow_my_tasks() TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Process types and a default "supervisor approval" workflow for each centre
--    (the older processes, including 'general', stay opt-in: nothing changes for them until an admin activates a workflow)
-- ---------------------------------------------------------------------------
INSERT INTO public.workflow_process_types (code, label, description) VALUES
  ('finance_submission', 'Financial submission or report', 'Accountant submissions and reports needing authorisation'),
  ('payment_request', 'Supplier invoice / payment request', 'Creditor''s Officer invoices and payment requests'),
  ('debtor_adjustment', 'Debtor adjustment, write-off or refund', 'Controlled changes to debtor accounts'),
  ('loan_request', 'Loan recommendation, disbursement or adjustment', 'Loan Officer requests'),
  ('asset_request', 'Asset or maintenance request', 'Purchases, transfers, disposals and maintenance expenditure'),
  ('training_submission', 'Training submission', 'Trainer, assessment and RPL submissions for the Head of Training'),
  ('trainee_support_submission', 'Trainee support submission', 'Liaison, placement, registration and resource-centre submissions for the Head of Trainee Support'),
  ('executive_matter', 'Matter for the Centre Manager', 'Departmental reports and matters needing executive approval')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_default_workflows(_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; _def uuid;
BEGIN
  FOREACH p IN ARRAY ARRAY['finance_submission','payment_request','debtor_adjustment','loan_request','asset_request',
                           'training_submission','trainee_support_submission','executive_matter'] LOOP
    IF EXISTS (SELECT 1 FROM public.workflow_definitions WHERE organization_id = _org AND process_type = p) THEN CONTINUE; END IF;
    INSERT INTO public.workflow_definitions (organization_id, process_type, name, active, created_by)
    VALUES (_org, p, 'Supervisor approval', false, NULL) RETURNING id INTO _def;
    INSERT INTO public.workflow_steps (definition_id, step_no, name, approver_role) VALUES (_def, 1, 'Supervisor approval', '@supervisor');
    UPDATE public.workflow_definitions SET active = true WHERE id = _def;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.seed_default_workflows(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.org_seed_default_workflows() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.seed_default_workflows(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER trg_org_seed_default_workflows AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.org_seed_default_workflows();
SELECT public.seed_default_workflows(id) FROM public.organizations;

-- Which kinds of request can the caller send right now? (those with an active workflow at their centre)
CREATE OR REPLACE FUNCTION public.workflow_available_processes()
RETURNS TABLE (code text, label text, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.code, p.label, p.description FROM public.workflow_process_types p
  WHERE auth.uid() IS NOT NULL
    AND p.code NOT IN ('assessment_request', 'delivery_plan')
    AND EXISTS (SELECT 1 FROM public.workflow_definitions d
                WHERE d.organization_id = public.get_user_organization(auth.uid()) AND d.process_type = p.code AND d.active)
  ORDER BY p.label;
$$;
GRANT EXECUTE ON FUNCTION public.workflow_available_processes() TO authenticated;
