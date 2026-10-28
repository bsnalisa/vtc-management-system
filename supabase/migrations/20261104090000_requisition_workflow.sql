-- Phase 1 of the requisition programme (docs/requisition-and-org-structure-plan.md): requisitions run on the existing workflow engine.
--  * New process type `purchase_requisition` with four fixed stages: the requester's line supervisor (recommend), the Accountant (fund
--    available + GL code), the Head of Finance and Administration (recommend) and the Centre Manager (approve). The order is fixed: nobody can
--    edit these steps, and a decision can only be made through `requisition_decide`, never through the generic approval functions.
--  * The supervisor is the requester's configured line supervisor (reporting lines), never chosen by the requester; submission is blocked when
--    none is valid. One person never decides two stages of the same requisition: the later stage goes to that person's own supervisor.
--  * Requisition status is changed only by the functions below (a trigger refuses anything else) and every change, every decision and every
--    submitted version is kept as a linked, append-only row.
-- The existing purchase_requisitions / purchase_requisition_items tables are extended (they held no rows), not duplicated.

-- ---------------------------------------------------------------------------
-- 1. Process type and fixed workflow
-- ---------------------------------------------------------------------------
INSERT INTO public.workflow_process_types (code, label, description)
VALUES ('purchase_requisition', 'Purchase requisition', 'Internal quotation request for goods or services, approved by supervisor, Accountant, Head of Finance and Administration and Centre Manager')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.requisition_stage_key(_step integer) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _step WHEN 1 THEN 'line_supervisor' WHEN 2 THEN 'accountant' WHEN 3 THEN 'head_finance' WHEN 4 THEN 'centre_manager' END
$$;

CREATE OR REPLACE FUNCTION public.seed_requisition_workflow(_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _def uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.workflow_definitions WHERE organization_id = _org AND process_type = 'purchase_requisition') THEN RETURN; END IF;
  PERFORM set_config('app.requisition_seed', 'on', true);
  INSERT INTO public.workflow_definitions (organization_id, process_type, name, active, created_by)
    VALUES (_org, 'purchase_requisition', 'Purchase requisition approval', false, NULL) RETURNING id INTO _def;
  INSERT INTO public.workflow_steps (definition_id, step_no, name, approver_role) VALUES
    (_def, 1, 'Line supervisor recommendation', '@supervisor'),
    (_def, 2, 'Accountant funding review', 'accountant'),
    (_def, 3, 'Head of Finance and Administration recommendation', 'head_of_finance_admin'),
    (_def, 4, 'Centre Manager approval', 'centre_manager');
  UPDATE public.workflow_definitions SET active = true WHERE id = _def;
  PERFORM set_config('app.requisition_seed', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.seed_requisition_workflow(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.org_seed_requisition_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.seed_requisition_workflow(NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_org_seed_requisition_workflow ON public.organizations;
CREATE TRIGGER trg_org_seed_requisition_workflow AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.org_seed_requisition_workflow();

-- the four stages cannot be edited, reordered or removed by anyone
CREATE OR REPLACE FUNCTION public.guard_requisition_steps() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _def uuid := COALESCE(NEW.definition_id, OLD.definition_id);
BEGIN
  IF coalesce(current_setting('app.requisition_seed', true), '') = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = _def AND d.process_type = 'purchase_requisition') THEN
    RAISE EXCEPTION 'The approval stages of a purchase requisition are fixed and cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_guard_requisition_steps ON public.workflow_steps;
CREATE TRIGGER trg_guard_requisition_steps BEFORE INSERT OR UPDATE OR DELETE ON public.workflow_steps FOR EACH ROW EXECUTE FUNCTION public.guard_requisition_steps();

-- ---------------------------------------------------------------------------
-- 2. Engine guards: requisitions are decided, returned and cancelled only through the requisition functions
-- ---------------------------------------------------------------------------
DO $$
DECLARE _def text; _old text;
BEGIN
  -- decisions
  _def := pg_get_functiondef('public.workflow_act_as(uuid, uuid, text, text, text)'::regprocedure);
  _old := 'IF NOT public.workflow_can_act(_actor, _task) THEN RAISE EXCEPTION ''You are not an approver for this step''; END IF;';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'workflow_act_as: expected text not found'; END IF;
  _def := replace(_def, _old, _old || E'\n  IF i.process_type = ''purchase_requisition'' AND coalesce(current_setting(''app.requisition_decide'', true), '''') <> ''on'' THEN\n    RAISE EXCEPTION ''Open the requisition to record your decision'';\n  END IF;');
  EXECUTE _def;

  -- reply to a return and cancel
  _def := pg_get_functiondef('public.workflow_provide_info(uuid, text)'::regprocedure);
  _old := 'IF i.status <> ''awaiting_info'' THEN RAISE EXCEPTION ''No information has been requested''; END IF;';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'workflow_provide_info: expected text not found'; END IF;
  _def := replace(_def, _old, _old || E'\n  IF i.process_type = ''purchase_requisition'' THEN RAISE EXCEPTION ''Correct the requisition and resubmit it from its page''; END IF;');
  EXECUTE _def;

  _def := pg_get_functiondef('public.workflow_cancel(uuid, text)'::regprocedure);
  _old := 'IF NOT FOUND THEN RAISE EXCEPTION ''Request not found''; END IF;';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'workflow_cancel: expected text not found'; END IF;
  _def := replace(_def, _old, _old || E'\n  IF i.process_type = ''purchase_requisition'' AND coalesce(current_setting(''app.requisition_decide'', true), '''') <> ''on'' THEN RAISE EXCEPTION ''Cancel the requisition from its page''; END IF;');
  EXECUTE _def;

  -- generic "new request" screen must not offer requisitions
  _def := pg_get_functiondef('public.workflow_available_processes()'::regprocedure);
  _old := 'p.code NOT IN (''assessment_request'', ''delivery_plan'')';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'workflow_available_processes: expected text not found'; END IF;
  _def := replace(_def, _old, 'p.code NOT IN (''assessment_request'', ''delivery_plan'', ''purchase_requisition'')');
  EXECUTE _def;

  -- segregation of duties: one person never decides two stages of the same requisition
  _def := pg_get_functiondef('public.workflow_open_step(uuid, integer)'::regprocedure);
  _old := '-- a submitter with no reporting line (or whose supervisor is themselves) goes to the Centre Manager';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'workflow_open_step: expected text not found'; END IF;
  _def := replace(_def, _old, E'IF i.process_type = ''purchase_requisition'' THEN\n'
    || E'    SELECT count(*) INTO _n FROM public.workflow_task_assignees WHERE task_id = _task;\n'
    || E'    DELETE FROM public.workflow_task_assignees WHERE task_id = _task AND user_id IN\n'
    || E'      (SELECT t2.acted_by FROM public.workflow_tasks t2 WHERE t2.instance_id = i.id AND t2.acted_by IS NOT NULL AND t2.status = ''approved'');\n'
    || E'    IF _n > 0 AND NOT EXISTS (SELECT 1 FROM public.workflow_task_assignees WHERE task_id = _task) THEN\n'
    || E'      INSERT INTO public.workflow_task_assignees (task_id, user_id, reason)\n'
    || E'      SELECT DISTINCT _task, sup, ''step'' FROM (SELECT t3.acted_by FROM public.workflow_tasks t3 WHERE t3.instance_id = i.id AND t3.acted_by IS NOT NULL AND t3.status = ''approved'') d,\n'
    || E'        LATERAL unnest(public.workflow_supervisor_level(i.organization_id, d.acted_by, 1)) sup\n'
    || E'       WHERE sup IS DISTINCT FROM i.started_by AND sup NOT IN (SELECT t4.acted_by FROM public.workflow_tasks t4 WHERE t4.instance_id = i.id AND t4.acted_by IS NOT NULL AND t4.status = ''approved'')\n'
    || E'      ON CONFLICT DO NOTHING;\n'
    || E'    END IF;\n'
    || E'  END IF;\n  ' || _old);
  EXECUTE _def;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.requisition_reference_seq;

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.purchase_requisitions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE public.purchase_requisitions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS workflow_instance_id uuid REFERENCES public.workflow_instances(id),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS template_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS requester_role text;
ALTER TABLE public.purchase_requisitions ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.purchase_requisitions ADD CONSTRAINT purchase_requisitions_status_check CHECK (status IN (
  'draft', 'submitted', 'pending_line_supervisor', 'returned_for_correction', 'not_recommended', 'pending_accountant', 'funding_not_available',
  'pending_head_finance', 'pending_centre_manager', 'not_approved', 'approved_awaiting_procurement', 'procurement_in_progress', 'order_placed',
  'delivery_outstanding', 'partially_received', 'fully_received', 'closed', 'cancelled'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_requisition_number ON public.purchase_requisitions (organization_id, requisition_number);
CREATE INDEX IF NOT EXISTS idx_requisitions_requester ON public.purchase_requisitions (requested_by, status);

ALTER TABLE public.purchase_requisition_items
  ADD COLUMN IF NOT EXISTS line_no integer,
  ADD COLUMN IF NOT EXISTS specifications text;
ALTER TABLE public.purchase_requisition_items ALTER COLUMN estimated_unit_cost SET DEFAULT 0;

-- every decision, with who made it and in which role at the time
CREATE TABLE public.requisition_decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id),
  task_id uuid NOT NULL,
  round integer NOT NULL,
  stage_no integer NOT NULL CHECK (stage_no BETWEEN 1 AND 4),
  stage_key text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('recommend', 'not_recommend', 'fund_available', 'fund_not_available', 'approve', 'not_approve', 'return')),
  gl_code text,
  comments text,
  decided_by uuid NOT NULL,
  decided_by_name text, decided_by_role text,
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_requisition_decisions_req ON public.requisition_decisions (requisition_id, decided_at);

-- every status the requisition has had
CREATE TABLE public.requisition_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  from_status text, to_status text NOT NULL, reason text,
  changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_requisition_status_history_req ON public.requisition_status_history (requisition_id, changed_at);

-- the content as submitted in each round, so a correction never overwrites what the approvers saw
CREATE TABLE public.requisition_snapshots (
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  round integer NOT NULL,
  purpose text NOT NULL, department text NOT NULL, items jsonb NOT NULL, template_version integer NOT NULL,
  requester_name text, requester_role text, supervisor_names text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requisition_id, round)
);

CREATE OR REPLACE FUNCTION public.requisition_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Requisition history can never be changed or removed' USING ERRCODE = '42501'; END $$;
CREATE TRIGGER trg_requisition_decisions_append_only BEFORE UPDATE OR DELETE ON public.requisition_decisions FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();
CREATE TRIGGER trg_requisition_status_history_append_only BEFORE UPDATE OR DELETE ON public.requisition_status_history FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();
CREATE TRIGGER trg_requisition_snapshots_append_only BEFORE UPDATE OR DELETE ON public.requisition_snapshots FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();

-- status only moves through the requisition functions
CREATE OR REPLACE FUNCTION public.requisition_guard_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.requisition_fn', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Create requisitions through the requisition form' USING ERRCODE = '42501'; END IF;
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Requisitions are cancelled, never deleted' USING ERRCODE = '42501'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.requisition_number IS DISTINCT FROM OLD.requisition_number OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.round IS DISTINCT FROM OLD.round OR NEW.workflow_instance_id IS DISTINCT FROM OLD.workflow_instance_id THEN
      RAISE EXCEPTION 'A requisition can only be moved on through the workflow' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_requisition_guard_status BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_requisitions FOR EACH ROW EXECUTE FUNCTION public.requisition_guard_status();

-- ---------------------------------------------------------------------------
-- 4. Who can read what (no write policies: all changes go through the functions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_can_view(_user uuid, _req uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions r
     WHERE r.id = _req
       AND (r.requested_by = _user
         OR public.has_org_role(_user, r.organization_id, ARRAY['centre_manager'])
         OR (r.status NOT IN ('draft', 'submitted', 'pending_line_supervisor', 'returned_for_correction', 'not_recommended', 'pending_accountant', 'funding_not_available',
                              'pending_head_finance', 'pending_centre_manager', 'not_approved', 'cancelled')
             AND public.has_org_role(_user, r.organization_id, ARRAY['procurement_officer']))
         OR EXISTS (SELECT 1 FROM public.requisition_decisions d WHERE d.requisition_id = r.id AND d.decided_by = _user)
         OR (r.workflow_instance_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.instance_id = r.workflow_instance_id AND public.workflow_can_act(_user, t.id)))));
$$;
REVOKE ALL ON FUNCTION public.requisition_can_view(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_can_view(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view requisitions in their organization" ON public.purchase_requisitions;
DROP POLICY IF EXISTS "Users can create requisitions" ON public.purchase_requisitions;
DROP POLICY IF EXISTS "Procurement officers and admins can manage requisitions" ON public.purchase_requisitions;
DROP POLICY IF EXISTS "Users can view requisition items" ON public.purchase_requisition_items;
DROP POLICY IF EXISTS "Users can manage requisition items" ON public.purchase_requisition_items;
CREATE POLICY "Requisitions are visible to the people involved" ON public.purchase_requisitions FOR SELECT TO authenticated USING (public.requisition_can_view(auth.uid(), id));
CREATE POLICY "Requisition items follow the requisition" ON public.purchase_requisition_items FOR SELECT TO authenticated USING (public.requisition_can_view(auth.uid(), requisition_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['requisition_decisions', 'requisition_status_history', 'requisition_snapshots'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Visible with the requisition" ON public.%I FOR SELECT TO authenticated USING (public.requisition_can_view(auth.uid(), requisition_id))', t);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (NOT (SELECT public.is_centre_scoped_user()) OR (SELECT r.organization_id FROM public.purchase_requisitions r WHERE r.id = %I.requisition_id) = ANY ((SELECT public.my_centre_ids())::uuid[])) WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR (SELECT r.organization_id FROM public.purchase_requisitions r WHERE r.id = %I.requisition_id) = ANY ((SELECT public.my_centre_ids())::uuid[]))', t, t, t);
  END LOOP;
END $$;
-- the old per-table write grants stay revoked by the absence of policies; make it explicit for the API roles
REVOKE INSERT, UPDATE, DELETE ON public.purchase_requisitions, public.purchase_requisition_items, public.requisition_decisions, public.requisition_status_history, public.requisition_snapshots FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Internal helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.requisition_set_status(_req uuid, _to text, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _from text;
BEGIN
  SELECT status INTO _from FROM public.purchase_requisitions WHERE id = _req;
  PERFORM set_config('app.requisition_fn', 'on', true);
  UPDATE public.purchase_requisitions SET status = _to, updated_at = now() WHERE id = _req;
  PERFORM set_config('app.requisition_fn', 'off', true);
  INSERT INTO public.requisition_status_history (requisition_id, from_status, to_status, reason, changed_by) VALUES (_req, _from, _to, _reason, auth.uid());
END $$;
REVOKE ALL ON FUNCTION private.requisition_set_status(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.requisition_person(_org uuid, _user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('user_id', _user, 'name', coalesce(nullif(trim(p.full_name), ''), p.email, 'Unknown'),
    'role', (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = _user AND ur.organization_id = _org ORDER BY (ur.role::text IN ('centre_manager', 'head_of_finance_admin', 'accountant', 'head_of_training')) DESC LIMIT 1))
  FROM (SELECT 1) x LEFT JOIN public.profiles p ON p.user_id = _user
$$;
REVOKE ALL ON FUNCTION private.requisition_person(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Requester functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_save_draft(_id uuid, _org uuid, _purpose text, _department text, _items jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; _req uuid; it jsonb; n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'Add the items you need'; END IF;
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'A requisition can list at most 100 items'; END IF;
  IF length(coalesce(_purpose, '')) > 4000 OR length(coalesce(_department, '')) > 120 THEN RAISE EXCEPTION 'The purpose or department is too long'; END IF;
  IF _id IS NULL THEN
    IF _org IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant')) THEN
      RAISE EXCEPTION 'Only staff can make a requisition' USING ERRCODE = '42501';
    END IF;
    PERFORM set_config('app.requisition_fn', 'on', true);
    INSERT INTO public.purchase_requisitions (organization_id, requisition_number, requested_by, department, justification, status, requester_role)
      VALUES (_org, 'DRAFT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), auth.uid(), nullif(trim(_department), ''), nullif(trim(_purpose), ''), 'draft',
              private.requisition_person(_org, auth.uid()) ->> 'role')
      RETURNING id INTO _req;
    PERFORM set_config('app.requisition_fn', 'off', true);
    INSERT INTO public.requisition_status_history (requisition_id, from_status, to_status, reason, changed_by) VALUES (_req, NULL, 'draft', 'Draft created', auth.uid());
  ELSE
    SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id FOR UPDATE;
    IF NOT FOUND OR r.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
    IF r.status NOT IN ('draft', 'returned_for_correction') THEN RAISE EXCEPTION 'This requisition can no longer be edited'; END IF;
    UPDATE public.purchase_requisitions SET department = nullif(trim(_department), ''), justification = nullif(trim(_purpose), ''), updated_at = now() WHERE id = _id;
    DELETE FROM public.purchase_requisition_items WHERE requisition_id = _id;
    _req := _id;
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    n := n + 1;
    IF coalesce(trim(it ->> 'description'), '') = '' OR length(it ->> 'description') > 500 THEN RAISE EXCEPTION 'Item %: describe what you need (up to 500 characters)', n; END IF;
    IF coalesce((it ->> 'quantity') ~ '^[0-9]+$', false) = false OR (it ->> 'quantity')::bigint NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Item %: the quantity must be a whole number of at least 1', n; END IF;
    IF length(coalesce(it ->> 'specifications', '')) > 2000 THEN RAISE EXCEPTION 'Item %: the specifications are too long', n; END IF;
    INSERT INTO public.purchase_requisition_items (requisition_id, line_no, item_description, quantity, specifications, estimated_unit_cost)
      VALUES (_req, n, trim(it ->> 'description'), (it ->> 'quantity')::integer, nullif(trim(coalesce(it ->> 'specifications', '')), ''), 0);
  END LOOP;
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.requisition_submit(_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; _sup uuid[]; _inst uuid; _num text; _old uuid; _names text; _items jsonb; _me jsonb;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR r.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  IF r.status NOT IN ('draft', 'returned_for_correction') THEN RAISE EXCEPTION 'This requisition has already been submitted'; END IF;
  IF coalesce(trim(r.justification), '') = '' THEN RAISE EXCEPTION 'State the purpose of the requisition before submitting'; END IF;
  IF coalesce(trim(r.department), '') = '' THEN RAISE EXCEPTION 'Enter your department before submitting'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('no', line_no, 'quantity', quantity, 'description', item_description, 'specifications', specifications) ORDER BY line_no), '[]'::jsonb)
    INTO _items FROM public.purchase_requisition_items WHERE requisition_id = _id;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'List at least one item before submitting'; END IF;

  _sup := array_remove(public.workflow_supervisor_level(r.organization_id, auth.uid(), 1), auth.uid());
  _sup := ARRAY(SELECT u FROM unnest(_sup) u WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u AND (a.banned_until IS NULL OR a.banned_until < now())));
  IF cardinality(_sup) = 0 THEN
    RAISE EXCEPTION 'You do not have a line supervisor configured, so this requisition cannot enter the approval process. Ask your Organisational Admin to set your reporting line, then submit again.' USING ERRCODE = 'P0001';
  END IF;
  SELECT string_agg(private.requisition_person(r.organization_id, u) ->> 'name', ', ') INTO _names FROM unnest(_sup) u;

  _old := r.workflow_instance_id;
  IF _old IS NOT NULL AND EXISTS (SELECT 1 FROM public.workflow_instances WHERE id = _old AND status IN ('awaiting_info', 'in_progress')) THEN
    -- a corrected resubmission starts a new approval round; the earlier round and its decisions stay on record
    UPDATE public.workflow_tasks SET status = 'cancelled' WHERE instance_id = _old AND status IN ('pending', 'info_requested');
    UPDATE public.workflow_instances SET status = 'cancelled', completed_at = now(), outcome_comment = 'Superseded by the corrected resubmission', next_action = 'None: superseded' WHERE id = _old;
    PERFORM public.workflow_log(_old, NULL, 'superseded', auth.uid(), 'app', 'Corrected and resubmitted as a new round');
  END IF;

  _num := r.requisition_number;
  IF _num LIKE 'DRAFT-%' THEN _num := 'REQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.requisition_reference_seq')::text, 6, '0'); END IF;
  _me := private.requisition_person(r.organization_id, auth.uid());
  PERFORM set_config('app.requisition_fn', 'on', true);
  UPDATE public.purchase_requisitions SET requisition_number = _num, round = r.round + 1, submitted_at = now(), requester_role = _me ->> 'role', updated_at = now() WHERE id = _id;
  PERFORM set_config('app.requisition_fn', 'off', true);

  _inst := public.finance_new_request(r.organization_id, 'purchase_requisition', _num || ': ' || left(r.justification, 80),
    jsonb_build_object('Requisition', _num, 'Department', r.department, 'Purpose', left(r.justification, 300), 'Items', jsonb_array_length(_items)), NULL, _id);
  PERFORM set_config('app.requisition_fn', 'on', true);
  UPDATE public.purchase_requisitions SET workflow_instance_id = _inst WHERE id = _id;
  PERFORM set_config('app.requisition_fn', 'off', true);

  INSERT INTO public.requisition_snapshots (requisition_id, round, purpose, department, items, template_version, requester_name, requester_role, supervisor_names)
    VALUES (_id, r.round + 1, r.justification, r.department, _items, r.template_version, _me ->> 'name', _me ->> 'role', _names);
  PERFORM private.requisition_set_status(_id, 'submitted', CASE WHEN r.round = 0 THEN 'Submitted' ELSE 'Resubmitted after correction' END);
  PERFORM public.workflow_submit(_inst);
  PERFORM private.requisition_set_status(_id, 'pending_line_supervisor', 'Sent to ' || _names);
  RETURN jsonb_build_object('requisition_id', _id, 'requisition_number', _num, 'round', r.round + 1, 'supervisor', _names);
END $$;

-- after a negative decision the requester may revise the requisition and send it again (history is kept)
CREATE OR REPLACE FUNCTION public.requisition_reopen(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR r.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  IF r.status NOT IN ('not_recommended', 'funding_not_available') THEN RAISE EXCEPTION 'This requisition cannot be reopened'; END IF;
  PERFORM private.requisition_set_status(_id, 'returned_for_correction', 'Reopened by the requester for revision');
END $$;

CREATE OR REPLACE FUNCTION public.requisition_cancel(_id uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR r.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  IF r.status NOT IN ('draft', 'returned_for_correction', 'pending_line_supervisor', 'pending_accountant', 'pending_head_finance', 'pending_centre_manager',
                      'not_recommended', 'funding_not_available', 'not_approved') THEN RAISE EXCEPTION 'This requisition can no longer be cancelled here'; END IF;
  IF coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Give a reason for cancelling'; END IF;
  IF r.workflow_instance_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workflow_instances WHERE id = r.workflow_instance_id AND status IN ('in_progress', 'awaiting_info')) THEN
    PERFORM set_config('app.requisition_decide', 'on', true);
    PERFORM public.workflow_cancel(r.workflow_instance_id, _reason);
    PERFORM set_config('app.requisition_decide', 'off', true);
  END IF;
  PERFORM private.requisition_set_status(_id, 'cancelled', _reason);
END $$;

-- ---------------------------------------------------------------------------
-- 7. Decisions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_decide(_task uuid, _decision text, _comment text, _gl_code text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.workflow_tasks%ROWTYPE; i public.workflow_instances%ROWTYPE; r public.purchase_requisitions%ROWTYPE; _stage text; _action text; _to text; _res text;
        _me jsonb; _po record;
BEGIN
  SELECT * INTO t FROM public.workflow_tasks WHERE id = _task;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  SELECT * INTO i FROM public.workflow_instances WHERE id = t.instance_id;
  IF i.process_type <> 'purchase_requisition' THEN RAISE EXCEPTION 'This is not a requisition task'; END IF;
  IF t.step_name LIKE 'Higher-level approval%' THEN RAISE EXCEPTION 'This stage is not decided from here'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = i.subject_id FOR UPDATE;
  IF NOT FOUND OR r.workflow_instance_id IS DISTINCT FROM i.id THEN RAISE EXCEPTION 'This requisition has been resubmitted; open the current version'; END IF;
  _stage := public.requisition_stage_key(t.step_no);
  IF NOT ((_stage = 'line_supervisor' AND _decision IN ('recommend', 'not_recommend', 'return'))
       OR (_stage = 'accountant' AND _decision IN ('fund_available', 'fund_not_available', 'return'))
       OR (_stage = 'head_finance' AND _decision IN ('recommend', 'not_recommend', 'return'))
       OR (_stage = 'centre_manager' AND _decision IN ('approve', 'not_approve', 'return'))) THEN
    RAISE EXCEPTION 'That decision is not available at this stage';
  END IF;
  IF _decision = 'fund_available' THEN
    IF coalesce(trim(_gl_code), '') = '' THEN RAISE EXCEPTION 'Enter the GL code the funds will be charged to'; END IF;
    IF trim(_gl_code) !~ '^[A-Za-z0-9][A-Za-z0-9 ./_-]{0,39}$' THEN RAISE EXCEPTION 'The GL code may contain letters, numbers and . / - _ only (up to 40 characters)'; END IF;
  ELSIF _gl_code IS NOT NULL AND trim(_gl_code) <> '' THEN
    RAISE EXCEPTION 'A GL code is recorded only with "Fund available"';
  END IF;

  _action := CASE _decision WHEN 'recommend' THEN 'approve' WHEN 'fund_available' THEN 'approve' WHEN 'approve' THEN 'approve' WHEN 'return' THEN 'request_info' ELSE 'reject' END;
  _me := private.requisition_person(r.organization_id, auth.uid());

  PERFORM set_config('app.requisition_decide', 'on', true);
  _res := public.workflow_act_as(auth.uid(), _task, _action, _comment, 'app');
  PERFORM set_config('app.requisition_decide', 'off', true);

  INSERT INTO public.requisition_decisions (requisition_id, instance_id, task_id, round, stage_no, stage_key, decision, gl_code, comments, decided_by, decided_by_name, decided_by_role)
    VALUES (r.id, i.id, _task, r.round, t.step_no, _stage, _decision, nullif(trim(coalesce(_gl_code, '')), ''), nullif(trim(coalesce(_comment, '')), ''), auth.uid(), _me ->> 'name', _me ->> 'role');

  _to := CASE
    WHEN _decision = 'return' THEN 'returned_for_correction'
    WHEN _decision = 'not_recommend' THEN 'not_recommended'
    WHEN _decision = 'fund_not_available' THEN 'funding_not_available'
    WHEN _decision = 'not_approve' THEN 'not_approved'
    WHEN _stage = 'line_supervisor' THEN 'pending_accountant'
    WHEN _stage = 'accountant' THEN 'pending_head_finance'
    WHEN _stage = 'head_finance' THEN 'pending_centre_manager'
    ELSE 'approved_awaiting_procurement' END;
  PERFORM private.requisition_set_status(r.id, _to, coalesce(nullif(trim(_comment), ''), _decision));

  IF _to = 'approved_awaiting_procurement' THEN
    FOR _po IN SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = r.organization_id AND role::text = 'procurement_officer' LOOP
      PERFORM public.workflow_notify(r.organization_id, _po.user_id, 'task_assigned', 'Approved requisition awaiting procurement: ' || r.requisition_number,
        left(r.justification, 200), '/purchase-requisitions', r.requisition_number || E' has been approved.\n' || left(r.justification, 300));
    END LOOP;
  END IF;
  RETURN _to;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Reading: one requisition, with its stages, people, decisions and history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_view(_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; _stages jsonb := '[]'::jsonb; s record; _people jsonb; _dec record; _task record; _my_task uuid; _can_decide boolean := false;
        _inst public.workflow_instances%ROWTYPE;
BEGIN
  IF NOT public.requisition_can_view(auth.uid(), _id) THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id;
  IF r.workflow_instance_id IS NOT NULL THEN SELECT * INTO _inst FROM public.workflow_instances WHERE id = r.workflow_instance_id; END IF;

  FOR s IN SELECT n AS step_no FROM generate_series(1, 4) n LOOP
    SELECT * INTO _dec FROM public.requisition_decisions d WHERE d.requisition_id = _id AND d.round = r.round AND d.stage_no = s.step_no ORDER BY d.decided_at DESC LIMIT 1;
    SELECT t.id, t.status INTO _task FROM public.workflow_tasks t WHERE t.instance_id = r.workflow_instance_id AND t.step_no = s.step_no AND t.step_name NOT LIKE 'Higher-level approval%' ORDER BY t.created_at DESC LIMIT 1;
    IF _task.id IS NOT NULL AND _task.status = 'pending' THEN
      SELECT coalesce(jsonb_agg(private.requisition_person(r.organization_id, a.user_id)), '[]'::jsonb) INTO _people FROM public.workflow_task_assignees a WHERE a.task_id = _task.id;
      IF public.workflow_can_act(auth.uid(), _task.id) AND auth.uid() IS DISTINCT FROM r.requested_by THEN _can_decide := true; _my_task := _task.id; END IF;
    ELSIF _dec.id IS NOT NULL THEN
      _people := jsonb_build_array(jsonb_build_object('user_id', _dec.decided_by, 'name', _dec.decided_by_name, 'role', _dec.decided_by_role));
    ELSIF s.step_no = 1 THEN
      SELECT coalesce(jsonb_agg(private.requisition_person(r.organization_id, u)), '[]'::jsonb) INTO _people
        FROM unnest(array_remove(public.workflow_supervisor_level(r.organization_id, r.requested_by, 1), r.requested_by)) u;
    ELSE
      SELECT coalesce(jsonb_agg(private.requisition_person(r.organization_id, x.user_id)), '[]'::jsonb) INTO _people
        FROM (SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = r.organization_id
               AND role::text = CASE s.step_no WHEN 2 THEN 'accountant' WHEN 3 THEN 'head_of_finance_admin' ELSE 'centre_manager' END) x;
    END IF;
    _stages := _stages || jsonb_build_object(
      'stage_no', s.step_no, 'stage_key', public.requisition_stage_key(s.step_no),
      'state', CASE WHEN _dec.id IS NOT NULL AND _dec.decision <> 'return' THEN 'decided'
                    WHEN _dec.id IS NOT NULL AND _dec.decision = 'return' THEN 'returned'
                    WHEN _task.id IS NOT NULL AND _task.status = 'pending' THEN 'current' ELSE 'upcoming' END,
      'people', coalesce(_people, '[]'::jsonb),
      'decision', CASE WHEN _dec.id IS NULL THEN NULL ELSE jsonb_build_object('decision', _dec.decision, 'comments', _dec.comments, 'gl_code', _dec.gl_code, 'at', _dec.decided_at,
                   'by', _dec.decided_by_name, 'role', _dec.decided_by_role) END);
  END LOOP;

  RETURN jsonb_build_object(
    'id', r.id, 'organization_id', r.organization_id, 'requisition_number', r.requisition_number, 'status', r.status, 'round', r.round,
    'purpose', r.justification, 'department', r.department, 'template_version', r.template_version,
    'submitted_at', r.submitted_at, 'created_at', r.created_at,
    'requester', private.requisition_person(r.organization_id, r.requested_by), 'is_requester', r.requested_by = auth.uid(),
    'next_action', _inst.next_action,
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('no', line_no, 'quantity', quantity, 'description', item_description, 'specifications', specifications) ORDER BY line_no)
                        FROM public.purchase_requisition_items WHERE requisition_id = r.id), '[]'::jsonb),
    'stages', _stages,
    'can_decide', _can_decide, 'task_id', _my_task,
    'can_edit', r.requested_by = auth.uid() AND r.status IN ('draft', 'returned_for_correction'),
    'can_reopen', r.requested_by = auth.uid() AND r.status IN ('not_recommended', 'funding_not_available'),
    'can_cancel', r.requested_by = auth.uid() AND r.status IN ('draft', 'returned_for_correction', 'pending_line_supervisor', 'pending_accountant', 'pending_head_finance', 'pending_centre_manager', 'not_recommended', 'funding_not_available', 'not_approved'),
    'decisions', coalesce((SELECT jsonb_agg(jsonb_build_object('round', d.round, 'stage_key', d.stage_key, 'stage_no', d.stage_no, 'decision', d.decision, 'gl_code', d.gl_code, 'comments', d.comments,
                   'by', d.decided_by_name, 'role', d.decided_by_role, 'at', d.decided_at) ORDER BY d.decided_at) FROM public.requisition_decisions d WHERE d.requisition_id = r.id), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('from', h.from_status, 'to', h.to_status, 'reason', h.reason, 'at', h.changed_at,
                   'by', (SELECT coalesce(nullif(trim(p.full_name), ''), p.email) FROM public.profiles p WHERE p.user_id = h.changed_by)) ORDER BY h.changed_at, h.id) FROM public.requisition_status_history h WHERE h.requisition_id = r.id), '[]'::jsonb),
    'rounds', coalesce((SELECT jsonb_agg(jsonb_build_object('round', sn.round, 'submitted_at', sn.submitted_at, 'purpose', sn.purpose, 'items', sn.items, 'supervisor', sn.supervisor_names) ORDER BY sn.round)
                          FROM public.requisition_snapshots sn WHERE sn.requisition_id = r.id), '[]'::jsonb));
END $$;

-- ---------------------------------------------------------------------------
-- 9. Lists for the dashboards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_list(_scope text, _status text DEFAULT NULL, _search text DEFAULT NULL, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE (id uuid, requisition_number text, purpose text, department text, status text, requester_name text, submitted_at timestamptz, created_at timestamptz,
               round integer, item_count bigint, next_action text, task_id uuid, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF _scope NOT IN ('mine', 'to_decide', 'procurement', 'centre') THEN RAISE EXCEPTION 'Unknown list'; END IF;
  RETURN QUERY
    WITH base AS (
      SELECT r.*, (SELECT t.id FROM public.workflow_tasks t WHERE t.instance_id = r.workflow_instance_id AND t.status = 'pending' AND public.workflow_can_act(auth.uid(), t.id) LIMIT 1) AS my_task
        FROM public.purchase_requisitions r
       WHERE CASE _scope
               WHEN 'mine' THEN r.requested_by = auth.uid()
               WHEN 'to_decide' THEN r.requested_by <> auth.uid() AND r.status IN ('pending_line_supervisor', 'pending_accountant', 'pending_head_finance', 'pending_centre_manager')
               WHEN 'procurement' THEN public.has_org_role(auth.uid(), r.organization_id, ARRAY['procurement_officer']) AND r.status NOT IN ('draft', 'submitted', 'pending_line_supervisor', 'returned_for_correction', 'not_recommended', 'pending_accountant', 'funding_not_available', 'pending_head_finance', 'pending_centre_manager', 'not_approved', 'cancelled')
               ELSE public.has_org_role(auth.uid(), r.organization_id, ARRAY['centre_manager']) AND r.status <> 'draft' END
         AND (_status IS NULL OR r.status = _status)
         AND (nullif(trim(coalesce(_search, '')), '') IS NULL OR r.requisition_number ILIKE '%' || trim(_search) || '%' OR r.justification ILIKE '%' || trim(_search) || '%')
         AND public.requisition_can_view(auth.uid(), r.id))
    SELECT b.id, b.requisition_number, b.justification, b.department, b.status,
           (SELECT coalesce(nullif(trim(p.full_name), ''), p.email) FROM public.profiles p WHERE p.user_id = b.requested_by), b.submitted_at, b.created_at, b.round,
           (SELECT count(*) FROM public.purchase_requisition_items i WHERE i.requisition_id = b.id),
           (SELECT w.next_action FROM public.workflow_instances w WHERE w.id = b.workflow_instance_id), b.my_task,
           count(*) OVER ()
      FROM base b
     WHERE _scope <> 'to_decide' OR b.my_task IS NOT NULL
     ORDER BY coalesce(b.submitted_at, b.created_at) DESC
     LIMIT greatest(1, least(_limit, 200)) OFFSET greatest(0, _offset);
END $$;

REVOKE ALL ON FUNCTION public.requisition_save_draft(uuid, uuid, text, text, jsonb), public.requisition_submit(uuid), public.requisition_reopen(uuid), public.requisition_cancel(uuid, text),
  public.requisition_decide(uuid, text, text, text), public.requisition_view(uuid), public.requisition_list(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_save_draft(uuid, uuid, text, text, jsonb), public.requisition_submit(uuid), public.requisition_reopen(uuid), public.requisition_cancel(uuid, text),
  public.requisition_decide(uuid, text, text, text), public.requisition_view(uuid), public.requisition_list(text, text, text, integer, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.requisition_stage_key(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_stage_key(integer) TO authenticated, service_role;


-- who a requisition of the caller would go to first (shown on the form before submitting)
CREATE OR REPLACE FUNCTION public.requisition_my_supervisor(_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _sup uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = _org) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  _sup := array_remove(public.workflow_supervisor_level(_org, auth.uid(), 1), auth.uid());
  _sup := ARRAY(SELECT u FROM unnest(_sup) u WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u AND (a.banned_until IS NULL OR a.banned_until < now())));
  RETURN jsonb_build_object('valid', cardinality(_sup) > 0, 'supervisors', coalesce((SELECT jsonb_agg(private.requisition_person(_org, u)) FROM unnest(_sup) u), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.requisition_my_supervisor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_my_supervisor(uuid) TO authenticated, service_role;

-- the centre's letterhead for the printed form (the same settings the proof of registration uses)
CREATE OR REPLACE FUNCTION public.requisition_letterhead(_req uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _name text; s public.proof_of_registration_settings%ROWTYPE;
BEGIN
  IF NOT public.requisition_can_view(auth.uid(), _req) THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  SELECT organization_id INTO _org FROM public.purchase_requisitions WHERE id = _req;
  SELECT name INTO _name FROM public.organizations WHERE id = _org;
  SELECT * INTO s FROM public.proof_of_registration_settings WHERE organization_id = _org;
  RETURN jsonb_build_object('centre_name', coalesce(nullif(trim(s.centre_name), ''), _name), 'configured', s.organization_id IS NOT NULL AND coalesce(trim(s.logo_url), '') <> '',
    'settings', CASE WHEN s.organization_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('logo_url', s.logo_url, 'centre_name', s.centre_name, 'physical_address', s.physical_address,
      'postal_address', s.postal_address, 'telephone', s.telephone, 'fax', s.fax, 'email', s.email, 'website', s.website, 'correspondence_note', s.correspondence_note,
      'primary_color', s.primary_color, 'accent_color', s.accent_color) END);
END $$;
REVOKE ALL ON FUNCTION public.requisition_letterhead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_letterhead(uuid) TO authenticated, service_role;

-- existing centres get the workflow
SELECT public.seed_requisition_workflow(id) FROM public.organizations;
