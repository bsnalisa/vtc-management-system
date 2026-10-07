-- Configurable workflow engine (spec 2.1-2.5, 6.4).
--  * Admins define, per process, an ordered list of approval steps (role or named user, SLA, escalation target).
--  * A workflow is OPT-IN per process: until a definition is activated, each process behaves exactly as before.
--  * Approvers act in the app (My Approvals) or from the email link (approve / reject / request more information).
--  * Tasks past their SLA escalate; scheduled delegations let a colleague act while someone is away.
--  * Everything is written to an audit trail.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- The original constraint listed five types, but the application sends many more (report, trial_expired, library,
-- workflow, ...). Keep a sanity check on the format only. NOT VALID so rows already in a live database cannot block this.
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type ~ '^[a-z][a-z_]*$') NOT VALID;

CREATE OR REPLACE FUNCTION public.is_workflow_admin(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = _user_id AND ur.organization_id = _org
                   AND ur.role::text IN ('admin','organization_admin'));
$$;

-- Processes that can run through a workflow
CREATE TABLE public.workflow_process_types (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text
);
INSERT INTO public.workflow_process_types (code, label, description) VALUES
  ('general', 'General approval request', 'Any request a user starts manually from My Approvals'),
  ('assessment_request', 'Exemption / external assessment requests', 'Trainee exemption and external assessment applications (RPL is decided by the assessment itself)'),
  ('delivery_plan', 'Delivery plans', 'Trainer delivery plans submitted for approval');
ALTER TABLE public.workflow_process_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can list process types" ON public.workflow_process_types FOR SELECT TO authenticated USING (true);

CREATE TABLE public.workflow_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  process_type text NOT NULL REFERENCES public.workflow_process_types(code),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- only one active workflow per process per centre
CREATE UNIQUE INDEX uq_workflow_active_per_process ON public.workflow_definitions (organization_id, process_type) WHERE active;

CREATE TABLE public.workflow_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  step_no integer NOT NULL CHECK (step_no > 0),
  name text NOT NULL,
  approver_role text,
  approver_user uuid,
  sla_hours integer CHECK (sla_hours IS NULL OR sla_hours > 0),
  escalate_to_role text,
  escalate_to_user uuid,
  allow_self_approval boolean NOT NULL DEFAULT false,
  UNIQUE (definition_id, step_no),
  CHECK ((approver_role IS NOT NULL) <> (approver_user IS NOT NULL))
);

CREATE TABLE public.workflow_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  app_base_url text -- used to build the approve / reject links in emails
);
CREATE TABLE public.workflow_alert_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('task_assigned','task_escalated','info_requested','completed')),
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id, event)
);

CREATE TABLE public.workflow_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE RESTRICT,
  process_type text NOT NULL REFERENCES public.workflow_process_types(code),
  subject_id uuid, -- the record being approved (NULL for general requests)
  title text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','awaiting_info','approved','rejected','cancelled')),
  current_step integer NOT NULL DEFAULT 1,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  outcome_comment text
);
CREATE INDEX idx_workflow_instances_subject ON public.workflow_instances (process_type, subject_id);
CREATE INDEX idx_workflow_instances_org_status ON public.workflow_instances (organization_id, status);

CREATE TABLE public.workflow_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  step_no integer NOT NULL,
  step_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','info_requested','cancelled')),
  due_at timestamptz,
  escalated_at timestamptz,
  acted_by uuid,
  acted_at timestamptz,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflow_tasks_instance ON public.workflow_tasks (instance_id);
CREATE INDEX idx_workflow_tasks_pending ON public.workflow_tasks (status, due_at);

CREATE TABLE public.workflow_task_assignees (
  task_id uuid NOT NULL REFERENCES public.workflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('step','escalation')),
  PRIMARY KEY (task_id, user_id)
);

-- Single-use email action links, one per (task, recipient)
CREATE TABLE public.workflow_action_tokens (
  token text PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  task_id uuid NOT NULL REFERENCES public.workflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz
);
ALTER TABLE public.workflow_action_tokens ENABLE ROW LEVEL SECURITY; -- no policies: reachable only through the functions below

CREATE TABLE public.workflow_delegations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  process_type text REFERENCES public.workflow_process_types(code), -- NULL = every process
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (from_user <> to_user)
);
CREATE INDEX idx_workflow_delegations_to ON public.workflow_delegations (to_user, active);

CREATE TABLE public.workflow_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  task_id uuid,
  event text NOT NULL,
  actor uuid,
  via text, -- 'app' | 'email' | 'system'
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflow_events_instance ON public.workflow_events (instance_id, created_at);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
-- Is this user (or someone delegating to them right now) an assignee of the task?
CREATE OR REPLACE FUNCTION public.workflow_can_act(_user_id uuid, _task uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workflow_tasks t
    JOIN public.workflow_instances i ON i.id = t.instance_id
    WHERE t.id = _task
      AND (EXISTS (SELECT 1 FROM public.workflow_task_assignees a WHERE a.task_id = t.id AND a.user_id = _user_id)
        OR EXISTS (SELECT 1 FROM public.workflow_delegations d
                   JOIN public.workflow_task_assignees a ON a.task_id = t.id AND a.user_id = d.from_user
                   WHERE d.to_user = _user_id AND d.active AND now() BETWEEN d.starts_at AND d.ends_at
                     AND d.organization_id = i.organization_id
                     AND (d.process_type IS NULL OR d.process_type = i.process_type)))
  );
$$;

CREATE OR REPLACE FUNCTION public.workflow_can_view_instance(_user_id uuid, _instance uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workflow_instances i
    WHERE i.id = _instance
      AND (i.started_by = _user_id
        OR public.is_workflow_admin(_user_id, i.organization_id)
        OR EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.instance_id = i.id AND public.workflow_can_act(_user_id, t.id))
        OR EXISTS (SELECT 1 FROM public.workflow_events e WHERE e.instance_id = i.id AND e.actor = _user_id))
  );
$$;

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflow admins manage definitions" ON public.workflow_definitions FOR ALL
  USING (public.is_workflow_admin(auth.uid(), organization_id)) WITH CHECK (public.is_workflow_admin(auth.uid(), organization_id));
CREATE POLICY "Workflow admins manage steps" ON public.workflow_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = definition_id AND public.is_workflow_admin(auth.uid(), d.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = definition_id AND public.is_workflow_admin(auth.uid(), d.organization_id)));
CREATE POLICY "Workflow admins manage settings" ON public.workflow_settings FOR ALL
  USING (public.is_workflow_admin(auth.uid(), organization_id)) WITH CHECK (public.is_workflow_admin(auth.uid(), organization_id));
CREATE POLICY "Workflow admins manage alert settings" ON public.workflow_alert_settings FOR ALL
  USING (public.is_workflow_admin(auth.uid(), organization_id)) WITH CHECK (public.is_workflow_admin(auth.uid(), organization_id));
CREATE POLICY "Involved users see instances" ON public.workflow_instances FOR SELECT
  USING (public.workflow_can_view_instance(auth.uid(), id));
CREATE POLICY "Involved users see tasks" ON public.workflow_tasks FOR SELECT
  USING (public.workflow_can_view_instance(auth.uid(), instance_id));
CREATE POLICY "Involved users see assignees" ON public.workflow_task_assignees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.id = task_id AND public.workflow_can_view_instance(auth.uid(), t.instance_id)));
CREATE POLICY "Involved users see events" ON public.workflow_events FOR SELECT
  USING (public.workflow_can_view_instance(auth.uid(), instance_id));
CREATE POLICY "Users manage their own delegations" ON public.workflow_delegations FOR ALL
  USING (from_user = auth.uid() OR public.is_workflow_admin(auth.uid(), organization_id))
  WITH CHECK ((from_user = auth.uid() OR public.is_workflow_admin(auth.uid(), organization_id))
              AND organization_id = public.get_user_organization(from_user));

-- ---------------------------------------------------------------------------
-- Notifications (in-app and email, per the centre's alert settings)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workflow_notify(
  _org uuid, _user uuid, _event text, _title text, _message text, _link text, _email_body text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.workflow_alert_settings%ROWTYPE; _email text;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  SELECT * INTO s FROM public.workflow_alert_settings WHERE organization_id = _org AND event = _event;
  IF NOT FOUND THEN s.in_app := true; s.email := true; END IF;
  IF s.in_app THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
    VALUES (_user, _org, 'workflow', _title, _message, _link);
  END IF;
  IF s.email THEN
    SELECT email INTO _email FROM public.profiles WHERE user_id = _user;
    IF _email IS NOT NULL AND _email <> '' THEN
      INSERT INTO public.outbound_messages (organization_id, channel, recipient, subject, body)
      VALUES (_org, 'email', _email, _title, _email_body);
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.workflow_notify(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.workflow_summary_text(_summary jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(string_agg(key || ': ' || value, E'\n' ORDER BY key), '') FROM jsonb_each_text(_summary);
$$;

-- Tell one assignee (and anyone currently delegated for them) that a task needs action
CREATE OR REPLACE FUNCTION public.workflow_announce_task(_task uuid, _user uuid, _event text, _lead text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.workflow_tasks%ROWTYPE; i public.workflow_instances%ROWTYPE; _base text; _tok text; _body text; r record;
BEGIN
  SELECT * INTO t FROM public.workflow_tasks WHERE id = _task;
  SELECT * INTO i FROM public.workflow_instances WHERE id = t.instance_id;
  SELECT app_base_url INTO _base FROM public.workflow_settings WHERE organization_id = i.organization_id;

  FOR r IN
    SELECT _user AS uid
    UNION
    SELECT d.to_user FROM public.workflow_delegations d
    WHERE d.from_user = _user AND d.active AND now() BETWEEN d.starts_at AND d.ends_at
      AND d.organization_id = i.organization_id AND (d.process_type IS NULL OR d.process_type = i.process_type)
  LOOP
    INSERT INTO public.workflow_action_tokens (task_id, user_id, expires_at)
    VALUES (t.id, r.uid, GREATEST(now() + interval '14 days', COALESCE(t.due_at, now()) + interval '7 days'))
    RETURNING token INTO _tok;
    _body := _lead || E'\n\n' || i.title || E'\nStep ' || t.step_no || ': ' || t.step_name
      || COALESCE(E'\nPlease respond by ' || to_char(t.due_at, 'DD Mon YYYY HH24:MI'), '')
      || E'\n\n' || public.workflow_summary_text(i.summary) || E'\n\n'
      || CASE WHEN _base IS NULL OR _base = '' THEN 'Open My Approvals in the system to respond.'
           ELSE 'Approve: ' || _base || '/workflow/action/' || _tok || E'?a=approve\n'
             || 'Reject: ' || _base || '/workflow/action/' || _tok || E'?a=reject\n'
             || 'Ask for more information: ' || _base || '/workflow/action/' || _tok || '?a=request_info' END;
    PERFORM public.workflow_notify(i.organization_id, r.uid, _event, _lead || ': ' || i.title,
                                   'Step ' || t.step_no || ' (' || t.step_name || ') is waiting for you.', '/my-approvals', _body);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.workflow_announce_task(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Engine core
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workflow_log(_instance uuid, _task uuid, _event text, _actor uuid, _via text, _comment text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.workflow_events (instance_id, task_id, event, actor, via, comment) VALUES (_instance, _task, _event, _actor, _via, _comment);
$$;
REVOKE ALL ON FUNCTION public.workflow_log(uuid, uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Create the task for a step and tell its approvers
CREATE OR REPLACE FUNCTION public.workflow_open_step(_instance uuid, _step_no integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE; s public.workflow_steps%ROWTYPE; _task uuid; _n integer := 0; r record; a record;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  SELECT * INTO s FROM public.workflow_steps WHERE definition_id = i.definition_id AND step_no = _step_no;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow step % not found', _step_no; END IF;

  INSERT INTO public.workflow_tasks (instance_id, step_no, step_name, due_at)
  VALUES (i.id, s.step_no, s.name, CASE WHEN s.sla_hours IS NULL THEN NULL ELSE now() + make_interval(hours => s.sla_hours) END)
  RETURNING id INTO _task;

  IF s.approver_user IS NOT NULL THEN
    INSERT INTO public.workflow_task_assignees (task_id, user_id, reason) VALUES (_task, s.approver_user, 'step');
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

  GET DIAGNOSTICS _n = ROW_COUNT; -- unused; count below
  SELECT count(*) INTO _n FROM public.workflow_task_assignees WHERE task_id = _task;
  PERFORM public.workflow_log(i.id, _task, 'step_opened', NULL, 'system', s.name);

  IF _n = 0 THEN
    -- nobody can act: tell the workflow admins so they can fix the definition or roles
    PERFORM public.workflow_log(i.id, _task, 'no_assignees', NULL, 'system', 'No eligible approver for step ' || s.step_no);
    FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = i.organization_id AND ur.role::text IN ('admin','organization_admin') LOOP
      PERFORM public.workflow_notify(i.organization_id, r.user_id, 'task_escalated', 'Workflow step has no approver: ' || i.title,
        'Step ' || s.step_no || ' (' || s.name || ') has nobody to approve it.', '/workflows', 'Step ' || s.step_no || ' (' || s.name || ') of "' || i.title || '" has no eligible approver. Check the workflow definition and role assignments.');
    END LOOP;
  ELSE
    FOR a IN SELECT user_id FROM public.workflow_task_assignees WHERE task_id = _task LOOP
      PERFORM public.workflow_announce_task(_task, a.user_id, 'task_assigned', 'Approval needed');
    END LOOP;
  END IF;
  RETURN _task;
END $$;
REVOKE ALL ON FUNCTION public.workflow_open_step(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Writes the outcome back to the record that was submitted
CREATE OR REPLACE FUNCTION public.workflow_apply_result(_instance uuid, _outcome text, _comment text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  PERFORM set_config('app.workflow_apply', 'on', true);
  IF i.process_type = 'assessment_request' AND i.subject_id IS NOT NULL THEN
    UPDATE public.assessment_requests SET status = _outcome, decision_notes = COALESCE(NULLIF(_comment, ''), decision_notes)
    WHERE id = i.subject_id AND status NOT IN ('approved','rejected');
  ELSIF i.process_type = 'delivery_plan' AND i.subject_id IS NOT NULL THEN
    UPDATE public.delivery_plans SET status = _outcome, review_notes = COALESCE(NULLIF(_comment, ''), review_notes)
    WHERE id = i.subject_id AND status = 'submitted';
  END IF;
  PERFORM set_config('app.workflow_apply', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.workflow_apply_result(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.workflow_complete(_instance uuid, _outcome text, _comment text, _actor uuid, _via text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  UPDATE public.workflow_instances SET status = _outcome, completed_at = now(), outcome_comment = _comment WHERE id = _instance RETURNING * INTO i;
  UPDATE public.workflow_tasks SET status = 'cancelled' WHERE instance_id = _instance AND status IN ('pending','info_requested');
  PERFORM public.workflow_log(_instance, NULL, 'completed_' || _outcome, _actor, _via, _comment);
  IF _outcome IN ('approved','rejected') THEN PERFORM public.workflow_apply_result(_instance, _outcome, _comment); END IF;
  PERFORM public.workflow_notify(i.organization_id, i.started_by, 'completed',
    CASE _outcome WHEN 'approved' THEN 'Approved: ' WHEN 'rejected' THEN 'Rejected: ' ELSE 'Cancelled: ' END || i.title,
    COALESCE(_comment, 'The approval process has finished.'), '/my-approvals',
    i.title || E'\nOutcome: ' || _outcome || COALESCE(E'\nComment: ' || _comment, ''));
END $$;
REVOKE ALL ON FUNCTION public.workflow_complete(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- Start a workflow for a record, if the centre has an active definition for the process
CREATE OR REPLACE FUNCTION public.workflow_start(_org uuid, _process text, _subject uuid, _title text, _summary jsonb, _starter uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.workflow_definitions%ROWTYPE; _instance uuid;
BEGIN
  SELECT * INTO d FROM public.workflow_definitions WHERE organization_id = _org AND process_type = _process AND active;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.workflow_steps WHERE definition_id = d.id) THEN RETURN NULL; END IF;
  INSERT INTO public.workflow_instances (organization_id, definition_id, process_type, subject_id, title, summary, started_by)
  VALUES (_org, d.id, _process, _subject, _title, COALESCE(_summary, '{}'::jsonb), _starter) RETURNING id INTO _instance;
  PERFORM public.workflow_log(_instance, NULL, 'started', _starter, 'app', _title);
  PERFORM public.workflow_open_step(_instance, (SELECT min(step_no) FROM public.workflow_steps WHERE definition_id = d.id));
  UPDATE public.workflow_instances SET current_step = (SELECT min(step_no) FROM public.workflow_steps WHERE definition_id = d.id) WHERE id = _instance;
  RETURN _instance;
END $$;
REVOKE ALL ON FUNCTION public.workflow_start(uuid, text, uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- Used by the triggers on source tables
CREATE OR REPLACE FUNCTION public.workflow_on_submit(_org uuid, _process text, _subject uuid, _title text, _summary jsonb, _starter uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing public.workflow_instances%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM public.workflow_instances
    WHERE process_type = _process AND subject_id = _subject AND status IN ('in_progress','awaiting_info') ORDER BY started_at DESC LIMIT 1;
  IF FOUND THEN
    IF existing.status = 'awaiting_info' THEN
      PERFORM public.workflow_resume(existing.id, _starter, 'Resubmitted by the applicant', 'system');
    END IF;
    RETURN;
  END IF;
  PERFORM public.workflow_start(_org, _process, _subject, _title, _summary, _starter);
END $$;
REVOKE ALL ON FUNCTION public.workflow_on_submit(uuid, text, uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- Information was supplied: reopen the step that asked for it
CREATE OR REPLACE FUNCTION public.workflow_resume(_instance uuid, _actor uuid, _comment text, _via text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.workflow_tasks%ROWTYPE; s public.workflow_steps%ROWTYPE; i public.workflow_instances%ROWTYPE; a record;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  SELECT * INTO t FROM public.workflow_tasks WHERE instance_id = _instance AND status = 'info_requested' ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No information has been requested'; END IF;
  SELECT s2.* INTO s FROM public.workflow_steps s2 WHERE s2.definition_id = i.definition_id AND s2.step_no = t.step_no;
  UPDATE public.workflow_tasks SET status = 'pending', escalated_at = NULL,
         due_at = CASE WHEN s.sla_hours IS NULL THEN NULL ELSE now() + make_interval(hours => s.sla_hours) END
   WHERE id = t.id;
  UPDATE public.workflow_instances SET status = 'in_progress' WHERE id = _instance;
  PERFORM public.workflow_log(_instance, t.id, 'info_provided', _actor, _via, _comment);
  FOR a IN SELECT user_id FROM public.workflow_task_assignees WHERE task_id = t.id LOOP
    PERFORM public.workflow_announce_task(t.id, a.user_id, 'task_assigned', 'Information supplied, approval needed');
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.workflow_resume(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- The one place decisions are made. _actor has already been identified (session user or email token holder).
CREATE OR REPLACE FUNCTION public.workflow_act_as(_actor uuid, _task uuid, _action text, _comment text, _via text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.workflow_tasks%ROWTYPE; i public.workflow_instances%ROWTYPE; s public.workflow_steps%ROWTYPE; _next integer;
BEGIN
  IF _action NOT IN ('approve','reject','request_info') THEN RAISE EXCEPTION 'Unknown action'; END IF;
  SELECT * INTO t FROM public.workflow_tasks WHERE id = _task FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  SELECT * INTO i FROM public.workflow_instances WHERE id = t.instance_id FOR UPDATE;
  IF t.status <> 'pending' OR i.status <> 'in_progress' THEN RAISE EXCEPTION 'This request is no longer waiting for a decision'; END IF;
  IF NOT public.workflow_can_act(_actor, _task) THEN RAISE EXCEPTION 'You are not an approver for this step'; END IF;
  SELECT * INTO s FROM public.workflow_steps WHERE definition_id = i.definition_id AND step_no = t.step_no;
  IF _actor = i.started_by AND NOT COALESCE(s.allow_self_approval, false) THEN RAISE EXCEPTION 'You cannot decide on your own request'; END IF;
  IF _action IN ('reject','request_info') AND COALESCE(trim(_comment), '') = '' THEN
    RAISE EXCEPTION 'A comment is required when you % a request', CASE _action WHEN 'reject' THEN 'reject' ELSE 'ask for information on' END;
  END IF;

  IF _action = 'request_info' THEN
    UPDATE public.workflow_tasks SET status = 'info_requested', acted_by = _actor, acted_at = now(), comment = _comment WHERE id = t.id;
    UPDATE public.workflow_instances SET status = 'awaiting_info' WHERE id = i.id;
    UPDATE public.workflow_action_tokens SET used_at = now() WHERE task_id = t.id AND used_at IS NULL;
    PERFORM public.workflow_log(i.id, t.id, 'info_requested', _actor, _via, _comment);
    PERFORM public.workflow_notify(i.organization_id, i.started_by, 'info_requested', 'More information needed: ' || i.title,
      _comment, '/my-approvals', i.title || E'\nMore information is needed:\n' || _comment || E'\n\nOpen My Approvals to respond.');
    RETURN 'awaiting_info';
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
  PERFORM public.workflow_open_step(i.id, _next);
  RETURN 'in_progress';
END $$;
REVOKE ALL ON FUNCTION public.workflow_act_as(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public API
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workflow_act(_task uuid, _action text, _comment text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  RETURN public.workflow_act_as(auth.uid(), _task, _action, _comment, 'app');
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_act(uuid, text, text) TO authenticated;

-- Email link: identifies the approver by the single-use token
CREATE OR REPLACE FUNCTION public.workflow_get_task_by_token(_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', i.title, 'summary', i.summary, 'step_no', t.step_no, 'step_name', t.step_name,
    'due_at', t.due_at, 'instance_status', i.status, 'task_status', t.status,
    'usable', (tok.used_at IS NULL AND tok.expires_at > now() AND t.status = 'pending' AND i.status = 'in_progress'))
  FROM public.workflow_action_tokens tok
  JOIN public.workflow_tasks t ON t.id = tok.task_id
  JOIN public.workflow_instances i ON i.id = t.instance_id
  WHERE tok.token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.workflow_get_task_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.workflow_act_by_token(_token text, _action text, _comment text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tok public.workflow_action_tokens%ROWTYPE; r text;
BEGIN
  SELECT * INTO tok FROM public.workflow_action_tokens WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is not valid'; END IF;
  IF tok.used_at IS NOT NULL THEN RAISE EXCEPTION 'This link has already been used'; END IF;
  IF tok.expires_at < now() THEN RAISE EXCEPTION 'This link has expired. Open My Approvals in the system instead.'; END IF;
  r := public.workflow_act_as(tok.user_id, tok.task_id, _action, _comment, 'email');
  UPDATE public.workflow_action_tokens SET used_at = now() WHERE token = _token;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_act_by_token(text, text, text) TO anon, authenticated;

-- Anyone can start a "general" request; the title and description are shown to approvers
CREATE OR REPLACE FUNCTION public.workflow_start_request(_title text, _description text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _id uuid; _name text;
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF COALESCE(trim(_title), '') = '' THEN RAISE EXCEPTION 'Give the request a title'; END IF;
  SELECT full_name INTO _name FROM public.profiles WHERE user_id = auth.uid();
  _id := public.workflow_start(_org, 'general', NULL, trim(_title),
          jsonb_build_object('Requested by', COALESCE(_name, 'Unknown'), 'Details', COALESCE(_description, '')), auth.uid());
  IF _id IS NULL THEN RAISE EXCEPTION 'No approval workflow is set up for general requests yet. Ask an administrator.'; END IF;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_start_request(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.workflow_provide_info(_instance uuid, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  IF NOT FOUND OR i.started_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who made the request can reply'; END IF;
  IF i.status <> 'awaiting_info' THEN RAISE EXCEPTION 'No information has been requested'; END IF;
  IF COALESCE(trim(_comment), '') = '' THEN RAISE EXCEPTION 'Write your reply'; END IF;
  PERFORM public.workflow_resume(_instance, auth.uid(), _comment, 'app');
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_provide_info(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.workflow_cancel(_instance uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT (i.started_by = auth.uid() OR public.is_workflow_admin(auth.uid(), i.organization_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF i.status NOT IN ('in_progress','awaiting_info') THEN RAISE EXCEPTION 'This request has already finished'; END IF;
  PERFORM public.workflow_complete(_instance, 'cancelled', _reason, auth.uid(), 'app');
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_cancel(uuid, text) TO authenticated;

-- Tasks the caller can act on right now (own, escalated to them, or delegated)
CREATE OR REPLACE FUNCTION public.workflow_my_tasks()
RETURNS TABLE (task_id uuid, instance_id uuid, process_type text, title text, summary jsonb, step_no integer, step_name text,
               due_at timestamptz, escalated boolean, delegated boolean, requested_by text, started_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, i.id, i.process_type, i.title, i.summary, t.step_no, t.step_name, t.due_at, t.escalated_at IS NOT NULL,
         NOT EXISTS (SELECT 1 FROM public.workflow_task_assignees a WHERE a.task_id = t.id AND a.user_id = auth.uid()),
         (SELECT p.full_name FROM public.profiles p WHERE p.user_id = i.started_by), i.started_at
  FROM public.workflow_tasks t JOIN public.workflow_instances i ON i.id = t.instance_id
  WHERE t.status = 'pending' AND i.status = 'in_progress' AND public.workflow_can_act(auth.uid(), t.id)
    AND NOT (i.started_by = auth.uid() AND NOT COALESCE((SELECT s.allow_self_approval FROM public.workflow_steps s WHERE s.definition_id = i.definition_id AND s.step_no = t.step_no), false))
  ORDER BY t.due_at NULLS LAST, t.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.workflow_my_tasks() TO authenticated;

-- Colleagues in the caller's centre, for choosing a delegate or a named approver
CREATE OR REPLACE FUNCTION public.workflow_list_users()
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.user_id, p.full_name, p.email
  FROM public.user_roles ur JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.organization_id = public.get_user_organization(auth.uid()) AND ur.role::text <> 'trainee' AND auth.uid() IS NOT NULL
  ORDER BY p.full_name;
$$;
GRANT EXECUTE ON FUNCTION public.workflow_list_users() TO authenticated;

-- Escalation sweep: tasks past their SLA bring in the step's escalation target. Run on a schedule or from the admin screen.
CREATE OR REPLACE FUNCTION public.workflow_escalate_overdue(_org uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; s public.workflow_steps%ROWTYPE; i public.workflow_instances%ROWTYPE; n integer := 0; _added integer; a record;
BEGIN
  IF NOT (public.is_workflow_admin(auth.uid(), _org) OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  FOR r IN SELECT t.* FROM public.workflow_tasks t JOIN public.workflow_instances ins ON ins.id = t.instance_id
           WHERE ins.organization_id = _org AND t.status = 'pending' AND ins.status = 'in_progress'
             AND t.due_at IS NOT NULL AND t.due_at < now() AND t.escalated_at IS NULL
  LOOP
    SELECT * INTO i FROM public.workflow_instances WHERE id = r.instance_id;
    SELECT * INTO s FROM public.workflow_steps WHERE definition_id = i.definition_id AND step_no = r.step_no;
    IF s.escalate_to_user IS NULL AND s.escalate_to_role IS NULL THEN
      UPDATE public.workflow_tasks SET escalated_at = now() WHERE id = r.id; -- overdue but nowhere to escalate: mark so it is not re-checked
      PERFORM public.workflow_log(r.instance_id, r.id, 'overdue', NULL, 'system', 'No escalation target configured');
      CONTINUE;
    END IF;
    IF s.escalate_to_user IS NOT NULL THEN
      INSERT INTO public.workflow_task_assignees (task_id, user_id, reason) VALUES (r.id, s.escalate_to_user, 'escalation') ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.workflow_task_assignees (task_id, user_id, reason)
      SELECT DISTINCT r.id, ur.user_id, 'escalation' FROM public.user_roles ur
      WHERE ur.organization_id = _org AND ur.role::text = s.escalate_to_role ON CONFLICT DO NOTHING;
    END IF;
    GET DIAGNOSTICS _added = ROW_COUNT;
    UPDATE public.workflow_tasks SET escalated_at = now() WHERE id = r.id;
    PERFORM public.workflow_log(r.instance_id, r.id, 'escalated', NULL, 'system', _added || ' escalation approver(s) added');
    FOR a IN SELECT user_id FROM public.workflow_task_assignees WHERE task_id = r.id AND reason = 'escalation' LOOP
      IF NOT (a.user_id = i.started_by AND NOT s.allow_self_approval) THEN
        PERFORM public.workflow_announce_task(r.id, a.user_id, 'task_escalated', 'Overdue approval escalated to you');
      END IF;
    END LOOP;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_escalate_overdue(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Adopting processes: exemption/external-assessment requests and delivery plans
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assessment_request_status_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE label text; engine boolean := COALESCE(current_setting('app.workflow_apply', true), '') = 'on';
BEGIN
  NEW.updated_at := now();
  -- Applicants may only add evidence / resubmit; everything else is staff-controlled
  IF auth.uid() IS NOT NULL AND NOT engine AND NOT public.is_assessment_staff(auth.uid(), NEW.organization_id) THEN
    NEW.request_type := OLD.request_type; NEW.trainee_id := OLD.trainee_id; NEW.created_by := OLD.created_by;
    NEW.organization_id := OLD.organization_id; NEW.reference_number := OLD.reference_number;
    NEW.assessor_name := OLD.assessor_name; NEW.scheduled_at := OLD.scheduled_at; NEW.venue := OLD.venue;
    NEW.outcome := OLD.outcome; NEW.decision_notes := OLD.decision_notes;
    NEW.decided_by := OLD.decided_by; NEW.decided_at := OLD.decided_at;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- a request that is going through an approval workflow can only be decided by that workflow
    IF NEW.status IN ('approved','rejected') AND NOT engine AND EXISTS (
         SELECT 1 FROM public.workflow_instances w WHERE w.process_type = 'assessment_request' AND w.subject_id = NEW.id
           AND w.status IN ('in_progress','awaiting_info')) THEN
      RAISE EXCEPTION 'This request is going through an approval workflow. Decide it from My Approvals.';
    END IF;
    IF NEW.status IN ('approved','rejected') THEN
      NEW.decided_by := COALESCE(auth.uid(), NEW.decided_by);
      NEW.decided_at := now();
    END IF;
    label := CASE NEW.request_type WHEN 'rpl' THEN 'RPL application' WHEN 'exemption' THEN 'Exemption request' ELSE 'External assessment application' END;
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
    VALUES (NEW.created_by, NEW.organization_id, 'assessment',
            label || ' ' || NEW.reference_number || ': ' || replace(NEW.status, '_', ' '),
            COALESCE(NEW.decision_notes, 'Your request status has been updated.'),
            '/trainee/requests');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.assessment_request_start_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.request_type <> 'rpl' AND NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted') THEN
    PERFORM public.workflow_on_submit(NEW.organization_id, 'assessment_request', NEW.id,
      CASE NEW.request_type WHEN 'exemption' THEN 'Exemption request ' ELSE 'External assessment ' END || NEW.reference_number || ' - ' || NEW.applicant_name,
      jsonb_build_object('Applicant', NEW.applicant_name, 'Reference', NEW.reference_number, 'Type', replace(NEW.request_type, '_', ' '),
                         'Motivation', left(NEW.motivation, 600), 'Evidence files', jsonb_array_length(NEW.evidence)::text),
      NEW.created_by);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_assessment_request_workflow AFTER INSERT OR UPDATE OF status ON public.assessment_requests
FOR EACH ROW EXECUTE FUNCTION public.assessment_request_start_workflow();

CREATE OR REPLACE FUNCTION public.guard_delivery_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE engine boolean := COALESCE(current_setting('app.workflow_apply', true), '') = 'on';
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') AND NOT engine AND EXISTS (
       SELECT 1 FROM public.workflow_instances w WHERE w.process_type = 'delivery_plan' AND w.subject_id = NEW.id
         AND w.status IN ('in_progress','awaiting_info')) THEN
    RAISE EXCEPTION 'This plan is going through an approval workflow. Decide it from My Approvals.';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT engine AND NOT public.is_training_staff(auth.uid(), NEW.organization_id) THEN
    NEW.review_notes := OLD.review_notes; NEW.reviewed_by := OLD.reviewed_by; NEW.organization_id := OLD.organization_id;
    NEW.class_id := OLD.class_id; NEW.trainer_id := OLD.trainer_id; NEW.start_date := OLD.start_date; NEW.weeks := OLD.weeks;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    NEW.reviewed_by := COALESCE(auth.uid(), NEW.reviewed_by);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.delivery_plan_start_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted' THEN
    SELECT cl.class_name, t.full_name AS trainer INTO c FROM public.classes cl LEFT JOIN public.trainers t ON t.id = NEW.trainer_id WHERE cl.id = NEW.class_id;
    PERFORM public.workflow_on_submit(NEW.organization_id, 'delivery_plan', NEW.id, 'Delivery plan: ' || NEW.title,
      jsonb_build_object('Class', COALESCE(c.class_name, ''), 'Trainer', COALESCE(c.trainer, ''), 'Starts', NEW.start_date::text, 'Weeks', NEW.weeks::text),
      auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_delivery_plan_workflow AFTER UPDATE OF status ON public.delivery_plans
FOR EACH ROW EXECUTE FUNCTION public.delivery_plan_start_workflow();

-- ---------------------------------------------------------------------------
-- Editing safety
-- ---------------------------------------------------------------------------
-- Steps are read live by running requests, so they cannot change underneath them.
CREATE OR REPLACE FUNCTION public.guard_workflow_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _def uuid := COALESCE(NEW.definition_id, OLD.definition_id); _n integer;
BEGIN
  SELECT count(*) INTO _n FROM public.workflow_instances WHERE definition_id = _def AND status IN ('in_progress','awaiting_info');
  IF _n > 0 THEN
    RAISE EXCEPTION 'Finish or cancel the % running request(s) before changing the steps of this workflow', _n;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_guard_workflow_steps BEFORE INSERT OR UPDATE OR DELETE ON public.workflow_steps
FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_steps();

-- Replace a definition's steps in one transaction.
-- _steps: [{ name, approver_role | approver_user, sla_hours, escalate_to_role, escalate_to_user, allow_self_approval }]
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
    IF NULLIF(s->>'approver_role', '') IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.custom_roles r WHERE r.role_code = s->>'approver_role' AND r.active AND (r.organization_id IS NULL OR r.organization_id = d.organization_id)) THEN
      RAISE EXCEPTION 'Step %: the role "%" does not exist', i, s->>'approver_role';
    END IF;
    INSERT INTO public.workflow_steps (definition_id, step_no, name, approver_role, approver_user, sla_hours, escalate_to_role, escalate_to_user, allow_self_approval)
    VALUES (_definition, i, trim(s->>'name'), NULLIF(s->>'approver_role', ''), NULLIF(s->>'approver_user', '')::uuid,
            NULLIF(s->>'sla_hours', '')::integer, NULLIF(s->>'escalate_to_role', ''), NULLIF(s->>'escalate_to_user', '')::uuid,
            COALESCE((s->>'allow_self_approval')::boolean, false));
  END LOOP;
  UPDATE public.workflow_definitions SET updated_at = now() WHERE id = _definition;
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_save_steps(uuid, jsonb) TO authenticated;

-- An active workflow must keep at least one step
CREATE OR REPLACE FUNCTION public.guard_workflow_activation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.active AND NOT COALESCE(OLD.active, false) AND NOT EXISTS (SELECT 1 FROM public.workflow_steps WHERE definition_id = NEW.id) THEN
    RAISE EXCEPTION 'Add at least one step before activating this workflow';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_workflow_activation BEFORE UPDATE ON public.workflow_definitions
FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_activation();
