-- Phase 3: finance and administration core (extends the approval workflow from 20261023090100).
--  * workflow attachments (supporting documents), an optional amount on requests, and per-process approval limits
--    above which an approved request goes on to the next level automatically
--  * supplier invoices (payables) with separate approval and payment stages
--  * journal entries (draft -> approval -> posted, corrected only by reversal)
--  * controlled debtor adjustments (write-off, credit, refund, correction) applied only after approval
--  * asset and maintenance requests
--  * dashboard figures for the Head of Finance and Administration, Accountant and Centre Manager
-- Finalised records are never edited or deleted; all writes go through the functions below, which check the caller's role.

-- ---------------------------------------------------------------------------
-- 1. Workflow additions
-- ---------------------------------------------------------------------------
ALTER TABLE public.workflow_instances ADD COLUMN IF NOT EXISTS amount numeric(14,2) CHECK (amount IS NULL OR amount >= 0);
ALTER TABLE public.workflow_process_types ADD COLUMN IF NOT EXISTS requires_documents boolean NOT NULL DEFAULT false;
UPDATE public.workflow_process_types SET requires_documents = true WHERE code IN ('payment_request', 'debtor_adjustment', 'asset_request', 'loan_request');

CREATE TABLE public.workflow_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflow_attachments_instance ON public.workflow_attachments (instance_id);
ALTER TABLE public.workflow_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Involved users see attachments" ON public.workflow_attachments FOR SELECT TO authenticated
  USING (public.workflow_can_view_instance(auth.uid(), instance_id)
         OR EXISTS (SELECT 1 FROM public.workflow_instances i WHERE i.id = instance_id AND public.has_org_role(auth.uid(), i.organization_id, ARRAY['centre_manager'])));
CREATE POLICY "Submitters attach documents to their open requests" ON public.workflow_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.workflow_instances i WHERE i.id = instance_id AND i.started_by = auth.uid() AND i.status IN ('draft','in_progress','awaiting_info')));
CREATE POLICY "Submitters remove documents from their drafts" ON public.workflow_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflow_instances i WHERE i.id = instance_id AND i.started_by = auth.uid() AND i.status = 'draft'));
CREATE POLICY "Centre isolation" ON public.workflow_attachments AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR (SELECT i.organization_id FROM public.workflow_instances i WHERE i.id = instance_id) = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR (SELECT i.organization_id FROM public.workflow_instances i WHERE i.id = instance_id) = ANY ((SELECT public.my_centre_ids())::uuid[]));

-- Above this amount, an approved request of this kind also needs the approver's own supervisor
CREATE TABLE public.workflow_escalation_limits (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  process_type text NOT NULL REFERENCES public.workflow_process_types(code),
  limit_amount numeric(14,2) NOT NULL CHECK (limit_amount > 0),
  PRIMARY KEY (organization_id, process_type)
);
ALTER TABLE public.workflow_escalation_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read their centre's approval limits" ON public.workflow_escalation_limits FOR SELECT TO authenticated
  USING (organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
CREATE POLICY "Workflow admins manage approval limits" ON public.workflow_escalation_limits FOR ALL TO authenticated
  USING (public.is_workflow_admin(auth.uid(), organization_id)) WITH CHECK (public.is_workflow_admin(auth.uid(), organization_id));
CREATE POLICY "Centre isolation" ON public.workflow_escalation_limits AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));

-- A draft for a finance-style request; the caller adds documents and then submits it with workflow_submit
CREATE OR REPLACE FUNCTION public.finance_new_request(_org uuid, _process text, _title text, _summary jsonb, _amount numeric, _subject uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.workflow_definitions%ROWTYPE; _id uuid;
BEGIN
  SELECT * INTO d FROM public.workflow_definitions WHERE organization_id = _org AND process_type = _process AND active;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.workflow_steps WHERE definition_id = d.id) THEN
    RAISE EXCEPTION 'No approval workflow is set up for this kind of request yet. Ask an administrator.';
  END IF;
  INSERT INTO public.workflow_instances (organization_id, definition_id, process_type, subject_id, title, summary, started_by, status, amount)
  VALUES (_org, d.id, _process, _subject, _title, COALESCE(_summary, '{}'::jsonb), auth.uid(), 'draft', _amount) RETURNING id INTO _id;
  PERFORM public.workflow_log(_id, NULL, 'draft_saved', auth.uid(), 'app', _title);
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.finance_new_request(uuid, text, text, jsonb, numeric, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finance_assert_role(_org uuid, _roles text[])
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, _roles) THEN RAISE EXCEPTION 'Not authorised'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finance_assert_role(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- Submitting needs the supporting documents for the kinds of request that require them
CREATE OR REPLACE FUNCTION public.workflow_submit(_instance uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE; _first integer;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance FOR UPDATE;
  IF NOT FOUND OR i.started_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who made the request can submit it'; END IF;
  IF i.status <> 'draft' THEN RAISE EXCEPTION 'This request has already been submitted'; END IF;
  IF EXISTS (SELECT 1 FROM public.workflow_process_types p WHERE p.code = i.process_type AND p.requires_documents)
     AND NOT EXISTS (SELECT 1 FROM public.workflow_attachments a WHERE a.instance_id = _instance) THEN
    RAISE EXCEPTION 'Attach the supporting document(s) before submitting';
  END IF;
  SELECT min(step_no) INTO _first FROM public.workflow_steps WHERE definition_id = i.definition_id;
  IF _first IS NULL THEN RAISE EXCEPTION 'This workflow has no steps'; END IF;
  UPDATE public.workflow_instances SET status = 'in_progress', current_step = _first, started_at = now() WHERE id = _instance;
  PERFORM public.workflow_log(_instance, NULL, 'submitted', auth.uid(), 'app', i.title);
  PERFORM public.workflow_open_step(_instance, _first);
END $$;
GRANT EXECUTE ON FUNCTION public.workflow_submit(uuid) TO authenticated;

-- The kinds of request a user can send now, including whether the supporting documents are required
DROP FUNCTION IF EXISTS public.workflow_available_processes();
CREATE FUNCTION public.workflow_available_processes()
RETURNS TABLE (code text, label text, description text, requires_documents boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.code, p.label, p.description, p.requires_documents FROM public.workflow_process_types p
  WHERE auth.uid() IS NOT NULL
    AND p.code NOT IN ('assessment_request', 'delivery_plan')
    AND EXISTS (SELECT 1 FROM public.workflow_definitions d
                WHERE d.organization_id = public.get_user_organization(auth.uid()) AND d.process_type = p.code AND d.active)
  ORDER BY p.label;
$$;
GRANT EXECUTE ON FUNCTION public.workflow_available_processes() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Domain tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.supplier_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL,
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  tax_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(14,2) NOT NULL CHECK (total_amount > 0),
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','verified','requested','approved','rejected','paid')),
  notes text,
  document_path text,
  created_by uuid DEFAULT auth.uid(),
  verified_by uuid, verified_at timestamptz,
  workflow_instance_id uuid REFERENCES public.workflow_instances(id),
  paid_by uuid, paid_at date, payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, supplier_id, invoice_number)
);
CREATE TABLE public.journal_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_number text NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  description text NOT NULL,
  debit_account text NOT NULL,
  credit_account text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','posted','reversed')),
  reversal_of uuid REFERENCES public.journal_entries(id),
  created_by uuid DEFAULT auth.uid(),
  workflow_instance_id uuid REFERENCES public.workflow_instances(id),
  posted_by uuid, posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, entry_number),
  CHECK (debit_account <> credit_account)
);
CREATE TABLE public.debtor_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL,
  fee_record_id uuid NOT NULL REFERENCES public.fee_records(id),
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('write_off','credit_note','refund','charge_correction')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','applied')),
  requested_by uuid DEFAULT auth.uid(),
  workflow_instance_id uuid REFERENCES public.workflow_instances(id),
  applied_by uuid, applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.asset_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('acquisition','transfer','disposal','maintenance_expenditure','repair_quotation')),
  asset_id uuid REFERENCES public.assets(id),
  title text NOT NULL,
  description text,
  estimated_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','completed')),
  requested_by uuid DEFAULT auth.uid(),
  workflow_instance_id uuid REFERENCES public.workflow_instances(id),
  completed_by uuid, completed_at timestamptz, completion_notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_invoices_org ON public.supplier_invoices (organization_id, status, due_date);
CREATE INDEX idx_journal_entries_org ON public.journal_entries (organization_id, status);
CREATE INDEX idx_debtor_adjustments_org ON public.debtor_adjustments (organization_id, status);
CREATE INDEX idx_asset_requests_org ON public.asset_requests (organization_id, status);

-- Read-only to clients; every change is made by the functions below. Finalised rows can never be edited or deleted.
DO $$
DECLARE t text; roles text; expr text := 'NOT (SELECT public.is_centre_scoped_user()) OR (%1$I.organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))';
BEGIN
  FOR t, roles IN SELECT * FROM (VALUES
    ('supplier_invoices', 'creditors_officer,accountant,head_of_finance_admin,procurement_officer,centre_manager,organization_admin,admin'),
    ('journal_entries', 'accountant,head_of_finance_admin,centre_manager,organization_admin,admin'),
    ('debtor_adjustments', 'debtor_officer,accountant,head_of_finance_admin,centre_manager,organization_admin,admin'),
    ('asset_requests', 'asset_maintenance_coordinator,maintenance_coordinator,accountant,head_of_finance_admin,centre_manager,organization_admin,admin')
  ) v(t, r) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Finance staff read" ON public.%I FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, string_to_array(%L, '',''))%s)', t, roles,
                   CASE t WHEN 'asset_requests' THEN ' OR requested_by = auth.uid()' WHEN 'supplier_invoices' THEN ' OR created_by = auth.uid()' ELSE '' END);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (' || expr || ') WITH CHECK (' || expr || ')', t, t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.finance_guard_finalised() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- the only deletion: a request that was cancelled before anyone decided on it
    IF current_setting('app.workflow_apply', true) = 'on' AND TG_TABLE_NAME IN ('debtor_adjustments', 'asset_requests') AND OLD.status = 'requested' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Financial records cannot be deleted; use a reversal or an adjustment';
  END IF;
  IF (TG_TABLE_NAME = 'supplier_invoices' AND OLD.status = 'paid')
     OR (TG_TABLE_NAME = 'journal_entries' AND OLD.status IN ('posted','reversed') AND NOT (OLD.status = 'posted' AND NEW.status = 'reversed' AND to_jsonb(NEW) - 'status' - 'updated_at' = to_jsonb(OLD) - 'status' - 'updated_at'))
     OR (TG_TABLE_NAME = 'debtor_adjustments' AND OLD.status = 'applied')
     OR (TG_TABLE_NAME = 'asset_requests' AND OLD.status = 'completed') THEN
    RAISE EXCEPTION 'Finalised financial records cannot be changed; use a reversal or an adjustment';
  END IF;
  RETURN NEW;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['supplier_invoices','journal_entries','debtor_adjustments','asset_requests'] LOOP
    EXECUTE format('CREATE TRIGGER trg_finance_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_guard_finalised()', t);
  END LOOP;
END $$;

-- The Creditor's Officer keeps the supplier records
CREATE POLICY "Creditors officers manage suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['creditors_officer']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['creditors_officer']));

-- ---------------------------------------------------------------------------
-- 3. Engine: outcomes written back to these records, completion, approval limits
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workflow_apply_result(_instance uuid, _outcome text, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  IF _outcome = 'cancelled' AND i.process_type IN ('assessment_request', 'delivery_plan') THEN RETURN; END IF;
  PERFORM set_config('app.workflow_apply', 'on', true);
  IF i.process_type = 'assessment_request' AND i.subject_id IS NOT NULL THEN
    UPDATE public.assessment_requests SET status = _outcome, decision_notes = COALESCE(NULLIF(_comment, ''), decision_notes)
    WHERE id = i.subject_id AND status NOT IN ('approved','rejected');
  ELSIF i.process_type = 'delivery_plan' AND i.subject_id IS NOT NULL THEN
    UPDATE public.delivery_plans SET status = _outcome, review_notes = COALESCE(NULLIF(_comment, ''), review_notes)
    WHERE id = i.subject_id AND status = 'submitted';
  ELSIF i.process_type = 'payment_request' AND i.subject_id IS NOT NULL THEN
    UPDATE public.supplier_invoices SET status = CASE _outcome WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'verified' END, updated_at = now()
    WHERE id = i.subject_id AND status = 'requested';
  ELSIF i.process_type = 'finance_submission' AND i.subject_id IS NOT NULL THEN
    UPDATE public.journal_entries SET status = CASE _outcome WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'draft' END, updated_at = now()
    WHERE id = i.subject_id AND status = 'submitted';
  ELSIF i.process_type = 'debtor_adjustment' AND i.subject_id IS NOT NULL THEN
    IF _outcome = 'cancelled' THEN
      DELETE FROM public.debtor_adjustments WHERE id = i.subject_id AND status = 'requested' AND workflow_instance_id = i.id; -- nothing was ever decided or applied
    ELSE
      UPDATE public.debtor_adjustments SET status = _outcome, updated_at = now() WHERE id = i.subject_id AND status = 'requested';
    END IF;
  ELSIF i.process_type = 'asset_request' AND i.subject_id IS NOT NULL THEN
    IF _outcome = 'cancelled' THEN
      DELETE FROM public.asset_requests WHERE id = i.subject_id AND status = 'requested' AND workflow_instance_id = i.id;
    ELSE
      UPDATE public.asset_requests SET status = _outcome, updated_at = now() WHERE id = i.subject_id AND status = 'requested';
    END IF;
  END IF;
  PERFORM set_config('app.workflow_apply', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.workflow_apply_result(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.workflow_complete(_instance uuid, _outcome text, _comment text, _actor uuid, _via text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  UPDATE public.workflow_instances SET status = _outcome, completed_at = now(), outcome_comment = _comment, escalated = false, resubmitted = false,
         next_action = CASE _outcome WHEN 'approved' THEN 'Approved: any further processing is recorded separately' WHEN 'rejected' THEN 'None: rejected' ELSE 'None: cancelled' END
   WHERE id = _instance RETURNING * INTO i;
  UPDATE public.workflow_tasks SET status = 'cancelled' WHERE instance_id = _instance AND status IN ('pending','info_requested');
  PERFORM public.workflow_log(_instance, NULL, 'completed_' || _outcome, _actor, _via, _comment);
  PERFORM public.workflow_apply_result(_instance, _outcome, _comment);
  IF _outcome <> 'cancelled' OR i.status <> 'draft' THEN
    PERFORM public.workflow_notify(i.organization_id, i.started_by, 'completed',
      CASE _outcome WHEN 'approved' THEN 'Approved: ' WHEN 'rejected' THEN 'Rejected: ' ELSE 'Cancelled: ' END || i.reference || ' ' || i.title,
      COALESCE(_comment, 'The approval process has finished.'), '/my-approvals',
      i.reference || ' ' || i.title || E'\nOutcome: ' || _outcome || COALESCE(E'\nComment: ' || _comment, ''));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.workflow_complete(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- Used by the functions that carry out an approved request (payment made, entry posted, adjustment applied, ...)
CREATE OR REPLACE FUNCTION public.workflow_finish_internal(_instance uuid, _actor uuid, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance FOR UPDATE;
  IF NOT FOUND OR i.status <> 'approved' THEN RETURN; END IF;
  UPDATE public.workflow_instances SET status = 'completed', completed_at = now(), next_action = 'None: completed' WHERE id = _instance;
  PERFORM public.workflow_log(_instance, NULL, 'completed', _actor, 'app', _comment);
  PERFORM public.workflow_notify(i.organization_id, i.started_by, 'completed', 'Completed: ' || i.reference || ' ' || i.title,
    COALESCE(_comment, 'Processing of the approved request is complete.'), '/my-approvals', i.reference || ' ' || i.title || ' is complete.');
END $$;
REVOKE ALL ON FUNCTION public.workflow_finish_internal(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Decisions, with automatic higher-level approval above a configured amount
CREATE OR REPLACE FUNCTION public.workflow_act_as(_actor uuid, _task uuid, _action text, _comment text, _via text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    _targets := array_remove(public.workflow_supervisor_level(i.organization_id, _actor, 1), i.started_by);
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
    -- over the approver's authority? then the next level must approve too
    IF NOT i.escalated AND i.amount IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.workflow_escalation_limits l WHERE l.organization_id = i.organization_id AND l.process_type = i.process_type AND i.amount > l.limit_amount) THEN
      _targets := array_remove(public.workflow_supervisor_level(i.organization_id, _actor, 1), i.started_by);
      IF cardinality(_targets) > 0 THEN
        INSERT INTO public.workflow_tasks (instance_id, step_no, step_name, escalated_at)
        VALUES (i.id, t.step_no, 'Higher-level approval: amount above the approval limit', now()) RETURNING id INTO _new;
        INSERT INTO public.workflow_task_assignees (task_id, user_id, reason) SELECT _new, u, 'escalation' FROM unnest(_targets) u ON CONFLICT DO NOTHING;
        UPDATE public.workflow_instances SET escalated = true, resubmitted = false,
               next_action = 'Higher-level approval (amount above the limit): waiting for ' || public.workflow_people_names(_targets) WHERE id = i.id;
        PERFORM public.workflow_log(i.id, _new, 'escalated_over_limit', _actor, _via, 'Amount ' || i.amount || ' is above the approval limit');
        FOR a IN SELECT user_id FROM public.workflow_task_assignees WHERE task_id = _new LOOP
          PERFORM public.workflow_announce_task(_new, a.user_id, 'task_escalated', 'Escalated for your approval');
        END LOOP;
        PERFORM public.workflow_notify(i.organization_id, i.started_by, 'task_escalated', 'Escalated: ' || i.reference || ' ' || i.title,
          'The amount is above the approval limit, so it needs higher-level approval.', '/my-approvals',
          i.reference || ' ' || i.title || E'\nApproved at the first level; it needs higher-level approval because of its amount.');
        RETURN 'escalated';
      END IF;
    END IF;
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

-- ---------------------------------------------------------------------------
-- 4. Supplier invoices: record -> verify -> request payment -> (approval) -> record payment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_supplier_invoice(
  _supplier uuid, _number text, _invoice_date date, _due_date date, _subtotal numeric, _tax numeric, _notes text DEFAULT NULL, _document text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _id uuid;
BEGIN
  SELECT organization_id INTO _org FROM public.suppliers WHERE id = _supplier;
  IF _org IS NULL THEN RAISE EXCEPTION 'Supplier not found'; END IF;
  PERFORM public.finance_assert_role(_org, ARRAY['creditors_officer','accountant']);
  IF COALESCE(trim(_number), '') = '' THEN RAISE EXCEPTION 'Enter the supplier''s invoice number'; END IF;
  IF _due_date < _invoice_date THEN RAISE EXCEPTION 'The due date cannot be before the invoice date'; END IF;
  INSERT INTO public.supplier_invoices (organization_id, supplier_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, notes, document_path)
  VALUES (_org, _supplier, trim(_number), COALESCE(_invoice_date, current_date), _due_date, _subtotal, COALESCE(_tax, 0), _subtotal + COALESCE(_tax, 0), _notes, _document)
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This supplier invoice has already been recorded';
END $$;
GRANT EXECUTE ON FUNCTION public.record_supplier_invoice(uuid, text, date, date, numeric, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_supplier_invoice(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.supplier_invoices%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.supplier_invoices WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['creditors_officer','accountant']);
  IF r.status <> 'recorded' THEN RAISE EXCEPTION 'Only a newly recorded invoice can be verified'; END IF;
  UPDATE public.supplier_invoices SET status = 'verified', verified_by = auth.uid(), verified_at = now(), updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.verify_supplier_invoice(uuid) TO authenticated;

-- Corrections are allowed until the invoice is with an approver, or while it has been returned for correction
CREATE OR REPLACE FUNCTION public.update_supplier_invoice(_id uuid, _due_date date, _subtotal numeric, _tax numeric, _notes text, _document text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.supplier_invoices%ROWTYPE; _wf text;
BEGIN
  SELECT * INTO r FROM public.supplier_invoices WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['creditors_officer','accountant']);
  SELECT status INTO _wf FROM public.workflow_instances WHERE id = r.workflow_instance_id;
  IF NOT (r.status IN ('recorded','verified') OR (r.status = 'requested' AND _wf IN ('draft','awaiting_info'))) THEN
    RAISE EXCEPTION 'This invoice can no longer be changed';
  END IF;
  UPDATE public.supplier_invoices SET due_date = _due_date, subtotal = _subtotal, tax_amount = COALESCE(_tax, 0), total_amount = _subtotal + COALESCE(_tax, 0),
         notes = _notes, document_path = COALESCE(_document, document_path), updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.update_supplier_invoice(uuid, date, numeric, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_invoice_payment(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.supplier_invoices%ROWTYPE; _sup text; _wf uuid;
BEGIN
  SELECT * INTO r FROM public.supplier_invoices WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['creditors_officer','accountant']);
  IF r.status <> 'verified' THEN RAISE EXCEPTION 'Verify the invoice before requesting payment'; END IF;
  SELECT name INTO _sup FROM public.suppliers WHERE id = r.supplier_id;
  _wf := public.finance_new_request(r.organization_id, 'payment_request', 'Pay ' || _sup || ' invoice ' || r.invoice_number,
    jsonb_build_object('Supplier', _sup, 'Invoice number', r.invoice_number, 'Invoice date', r.invoice_date, 'Due date', r.due_date,
                       'Amount', 'N$ ' || to_char(r.total_amount, 'FM999,999,990.00'), 'Notes', COALESCE(r.notes, '')),
    r.total_amount, r.id);
  UPDATE public.supplier_invoices SET status = 'requested', workflow_instance_id = _wf, updated_at = now() WHERE id = _id;
  RETURN _wf;
END $$;
GRANT EXECUTE ON FUNCTION public.request_invoice_payment(uuid) TO authenticated;

-- Approval and payment are separate stages: whoever approved cannot also record the payment
CREATE OR REPLACE FUNCTION public.record_supplier_payment(_id uuid, _reference text, _paid_on date DEFAULT current_date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.supplier_invoices%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.supplier_invoices WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['creditors_officer','accountant']);
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved payment request can be paid'; END IF;
  IF EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.instance_id = r.workflow_instance_id AND t.acted_by = auth.uid() AND t.status = 'approved') THEN
    RAISE EXCEPTION 'The person who approved a payment cannot also record it';
  END IF;
  IF COALESCE(trim(_reference), '') = '' THEN RAISE EXCEPTION 'Enter the payment reference'; END IF;
  UPDATE public.supplier_invoices SET status = 'paid', paid_by = auth.uid(), paid_at = COALESCE(_paid_on, current_date), payment_reference = trim(_reference), updated_at = now() WHERE id = _id;
  PERFORM public.workflow_finish_internal(r.workflow_instance_id, auth.uid(), 'Paid, reference ' || trim(_reference));
END $$;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment(uuid, text, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Journal entries: draft -> approval -> posted; corrected by a reversing entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_journal_entry(_date date, _description text, _debit text, _credit text, _amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _id uuid;
BEGIN
  PERFORM public.finance_assert_role(_org, ARRAY['accountant']);
  IF COALESCE(trim(_description), '') = '' OR COALESCE(trim(_debit), '') = '' OR COALESCE(trim(_credit), '') = '' THEN RAISE EXCEPTION 'Describe the entry and name both accounts'; END IF;
  INSERT INTO public.journal_entries (organization_id, entry_number, entry_date, description, debit_account, credit_account, amount)
  VALUES (_org, 'JE-' || lpad((SELECT count(*) + 1 FROM public.journal_entries WHERE organization_id = _org)::text, 5, '0'),
          COALESCE(_date, current_date), trim(_description), trim(_debit), trim(_credit), _amount) RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_journal_entry(date, text, text, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_journal_entry(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.journal_entries%ROWTYPE; _wf uuid;
BEGIN
  SELECT * INTO r FROM public.journal_entries WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['accountant']);
  IF r.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Only a draft entry can be submitted'; END IF;
  _wf := public.finance_new_request(r.organization_id, 'finance_submission', 'Journal entry ' || r.entry_number || ': ' || r.description,
    jsonb_build_object('Entry', r.entry_number, 'Date', r.entry_date, 'Debit', r.debit_account, 'Credit', r.credit_account,
                       'Amount', 'N$ ' || to_char(r.amount, 'FM999,999,990.00'), 'Description', r.description,
                       'Reverses', COALESCE((SELECT x.entry_number FROM public.journal_entries x WHERE x.id = r.reversal_of), '')),
    r.amount, r.id);
  UPDATE public.journal_entries SET status = 'submitted', workflow_instance_id = _wf, updated_at = now() WHERE id = _id;
  RETURN _wf;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_journal_entry(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_journal_entry(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.journal_entries%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.journal_entries WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['accountant']);
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved entry can be posted'; END IF;
  UPDATE public.journal_entries SET status = 'posted', posted_by = auth.uid(), posted_at = now(), updated_at = now() WHERE id = _id;
  IF r.reversal_of IS NOT NULL THEN UPDATE public.journal_entries SET status = 'reversed', updated_at = now() WHERE id = r.reversal_of AND status = 'posted'; END IF;
  PERFORM public.workflow_finish_internal(r.workflow_instance_id, auth.uid(), 'Posted as ' || r.entry_number);
END $$;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(uuid) TO authenticated;

-- A posted entry is never changed: a reversing entry (accounts swapped) goes through the same approval
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.journal_entries%ROWTYPE; _new uuid;
BEGIN
  SELECT * INTO r FROM public.journal_entries WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['accountant']);
  IF r.status <> 'posted' THEN RAISE EXCEPTION 'Only a posted entry can be reversed'; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries x WHERE x.reversal_of = r.id AND x.status <> 'rejected') THEN RAISE EXCEPTION 'A reversal of this entry already exists'; END IF;
  IF COALESCE(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Give the reason for the reversal'; END IF;
  INSERT INTO public.journal_entries (organization_id, entry_number, entry_date, description, debit_account, credit_account, amount, reversal_of)
  VALUES (r.organization_id, 'JE-' || lpad((SELECT count(*) + 1 FROM public.journal_entries WHERE organization_id = r.organization_id)::text, 5, '0'),
          current_date, 'Reversal of ' || r.entry_number || ': ' || trim(_reason), r.credit_account, r.debit_account, r.amount, r.id) RETURNING id INTO _new;
  RETURN _new;
END $$;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Debtor adjustments: requested -> approval -> applied (never edited directly on the fee record)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_debtor_adjustment(_fee_record uuid, _type text, _amount numeric, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.fee_records%ROWTYPE; _id uuid := gen_random_uuid(); _wf uuid; _name text;
BEGIN
  SELECT * INTO f FROM public.fee_records WHERE id = _fee_record;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fee record not found'; END IF;
  PERFORM public.finance_assert_role(f.organization_id, ARRAY['debtor_officer']);
  IF _type NOT IN ('write_off','credit_note','refund','charge_correction') THEN RAISE EXCEPTION 'Unknown adjustment type'; END IF;
  IF COALESCE(_amount, 0) <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero'; END IF;
  IF COALESCE(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Give the reason for the adjustment'; END IF;
  IF _type IN ('write_off','credit_note') AND _amount > f.balance THEN RAISE EXCEPTION 'The amount is more than the outstanding balance'; END IF;
  IF _type = 'refund' AND _amount > f.amount_paid THEN RAISE EXCEPTION 'The refund is more than what was paid'; END IF;
  SELECT trim(first_name || ' ' || last_name) INTO _name FROM public.trainees WHERE id = f.trainee_id;
  _wf := public.finance_new_request(f.organization_id, 'debtor_adjustment',
    initcap(replace(_type, '_', ' ')) || ' for ' || COALESCE(_name, 'trainee'),
    jsonb_build_object('Trainee', COALESCE(_name, ''), 'Type', initcap(replace(_type, '_', ' ')), 'Amount', 'N$ ' || to_char(_amount, 'FM999,999,990.00'),
                       'Balance before', 'N$ ' || to_char(f.balance, 'FM999,999,990.00'), 'Reason', trim(_reason)),
    _amount, _id);
  INSERT INTO public.debtor_adjustments (id, organization_id, trainee_id, fee_record_id, adjustment_type, amount, reason, workflow_instance_id)
  VALUES (_id, f.organization_id, f.trainee_id, f.id, _type, _amount, trim(_reason), _wf);
  RETURN _wf;
END $$;
GRANT EXECUTE ON FUNCTION public.request_debtor_adjustment(uuid, text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_debtor_adjustment(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.debtor_adjustments%ROWTYPE; f public.fee_records%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.debtor_adjustments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Adjustment not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['debtor_officer']);
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved adjustment can be applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.instance_id = r.workflow_instance_id AND t.acted_by = auth.uid() AND t.status = 'approved') THEN
    RAISE EXCEPTION 'The person who approved an adjustment cannot also apply it';
  END IF;
  SELECT * INTO f FROM public.fee_records WHERE id = r.fee_record_id FOR UPDATE;
  IF r.adjustment_type IN ('write_off','credit_note') THEN
    IF r.amount > f.balance THEN RAISE EXCEPTION 'The balance is now lower than the approved amount; request a new adjustment'; END IF;
    UPDATE public.fee_records SET total_fee = total_fee - r.amount WHERE id = f.id;
  ELSIF r.adjustment_type = 'refund' THEN
    IF r.amount > f.amount_paid THEN RAISE EXCEPTION 'The refund is now more than what was paid; request a new adjustment'; END IF;
    UPDATE public.fee_records SET amount_paid = amount_paid - r.amount WHERE id = f.id;
  ELSE
    UPDATE public.fee_records SET total_fee = total_fee + r.amount WHERE id = f.id;
  END IF;
  UPDATE public.debtor_adjustments SET status = 'applied', applied_by = auth.uid(), applied_at = now(), updated_at = now() WHERE id = _id;
  PERFORM public.workflow_finish_internal(r.workflow_instance_id, auth.uid(), 'Applied to the fee record');
END $$;
GRANT EXECUTE ON FUNCTION public.apply_debtor_adjustment(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Asset and maintenance requests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_asset_approval(_kind text, _asset uuid, _title text, _description text, _cost numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _id uuid := gen_random_uuid(); _wf uuid; _aname text;
BEGIN
  PERFORM public.finance_assert_role(_org, ARRAY['asset_maintenance_coordinator','maintenance_coordinator']);
  IF _kind NOT IN ('acquisition','transfer','disposal','maintenance_expenditure','repair_quotation') THEN RAISE EXCEPTION 'Unknown request type'; END IF;
  IF COALESCE(trim(_title), '') = '' THEN RAISE EXCEPTION 'Give the request a title'; END IF;
  IF _asset IS NOT NULL THEN
    SELECT asset_name INTO _aname FROM public.assets WHERE id = _asset AND organization_id = _org;
    IF _aname IS NULL THEN RAISE EXCEPTION 'Asset not found'; END IF;
  ELSIF _kind IN ('transfer','disposal','maintenance_expenditure','repair_quotation') THEN RAISE EXCEPTION 'Choose the asset this concerns';
  END IF;
  _wf := public.finance_new_request(_org, 'asset_request', initcap(replace(_kind, '_', ' ')) || ': ' || trim(_title),
    jsonb_build_object('Type', initcap(replace(_kind, '_', ' ')), 'Asset', COALESCE(_aname, ''), 'Estimated cost', 'N$ ' || to_char(COALESCE(_cost, 0), 'FM999,999,990.00'), 'Details', COALESCE(_description, '')),
    COALESCE(_cost, 0), _id);
  INSERT INTO public.asset_requests (id, organization_id, kind, asset_id, title, description, estimated_cost, workflow_instance_id)
  VALUES (_id, _org, _kind, _asset, trim(_title), _description, COALESCE(_cost, 0), _wf);
  RETURN _wf;
END $$;
GRANT EXECUTE ON FUNCTION public.request_asset_approval(text, uuid, text, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_asset_request(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.asset_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.asset_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  PERFORM public.finance_assert_role(r.organization_id, ARRAY['asset_maintenance_coordinator','maintenance_coordinator']);
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved request can be completed'; END IF;
  UPDATE public.asset_requests SET status = 'completed', completed_by = auth.uid(), completed_at = now(), completion_notes = _notes, updated_at = now() WHERE id = _id;
  PERFORM public.workflow_finish_internal(r.workflow_instance_id, auth.uid(), COALESCE(_notes, 'Carried out'));
END $$;
GRANT EXECUTE ON FUNCTION public.complete_asset_request(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Dashboard figures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _res jsonb;
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['head_of_finance_admin','accountant','centre_manager','organization_admin','admin']) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT jsonb_build_object(
    'approvals', jsonb_build_object(
      'pending', (SELECT count(DISTINCT t.id) FROM public.workflow_tasks t JOIN public.workflow_instances i ON i.id = t.instance_id
                   WHERE i.organization_id = _org AND t.status = 'pending' AND i.status = 'in_progress' AND EXISTS (SELECT 1 FROM public.workflow_task_assignees a WHERE a.task_id = t.id AND a.user_id = auth.uid())),
      'overdue', (SELECT count(DISTINCT t.id) FROM public.workflow_tasks t JOIN public.workflow_instances i ON i.id = t.instance_id
                   WHERE i.organization_id = _org AND t.status = 'pending' AND i.status = 'in_progress' AND t.due_at < now() AND EXISTS (SELECT 1 FROM public.workflow_task_assignees a WHERE a.task_id = t.id AND a.user_id = auth.uid())),
      'returned', (SELECT count(DISTINCT i.id) FROM public.workflow_instances i JOIN public.workflow_tasks t ON t.instance_id = i.id AND t.status = 'info_requested' AND t.acted_by = auth.uid() WHERE i.organization_id = _org AND i.status = 'awaiting_info'),
      'approved_30d', (SELECT count(*) FROM public.workflow_events e JOIN public.workflow_instances i ON i.id = e.instance_id WHERE i.organization_id = _org AND e.event = 'approved' AND e.actor = auth.uid() AND e.created_at > now() - interval '30 days'),
      'rejected_30d', (SELECT count(*) FROM public.workflow_events e JOIN public.workflow_instances i ON i.id = e.instance_id WHERE i.organization_id = _org AND e.event = 'rejected' AND e.actor = auth.uid() AND e.created_at > now() - interval '30 days'),
      'by_originator', COALESCE((SELECT jsonb_agg(x ORDER BY (x->>'count')::int DESC) FROM (
          SELECT jsonb_build_object('user_id', i.started_by, 'name', COALESCE(p.full_name, 'Unknown'), 'role', i.submitter_role, 'count', count(DISTINCT t.id)) x
          FROM public.workflow_tasks t JOIN public.workflow_instances i ON i.id = t.instance_id LEFT JOIN public.profiles p ON p.user_id = i.started_by
          WHERE i.organization_id = _org AND t.status = 'pending' AND i.status = 'in_progress' AND EXISTS (SELECT 1 FROM public.workflow_task_assignees a WHERE a.task_id = t.id AND a.user_id = auth.uid())
          GROUP BY i.started_by, p.full_name, i.submitter_role) s), '[]'::jsonb),
      'by_type', COALESCE((SELECT jsonb_agg(x) FROM (
          SELECT jsonb_build_object('process_type', i.process_type, 'count', count(DISTINCT t.id)) x
          FROM public.workflow_tasks t JOIN public.workflow_instances i ON i.id = t.instance_id
          WHERE i.organization_id = _org AND t.status = 'pending' AND i.status = 'in_progress' AND EXISTS (SELECT 1 FROM public.workflow_task_assignees a WHERE a.task_id = t.id AND a.user_id = auth.uid())
          GROUP BY i.process_type) s), '[]'::jsonb)),
    'budgets', COALESCE((SELECT jsonb_agg(jsonb_build_object('department', department, 'year', budget_year, 'total', total_budget, 'spent', spent_amount) ORDER BY department)
                         FROM public.department_budgets WHERE organization_id = _org AND budget_year = to_char(current_date, 'YYYY')), '[]'::jsonb),
    'payables', jsonb_build_object(
      'outstanding', COALESCE((SELECT sum(total_amount) FROM public.supplier_invoices WHERE organization_id = _org AND status <> 'paid'), 0),
      'overdue_total', COALESCE((SELECT sum(total_amount) FROM public.supplier_invoices WHERE organization_id = _org AND status <> 'paid' AND due_date < current_date), 0),
      'overdue_count', (SELECT count(*) FROM public.supplier_invoices WHERE organization_id = _org AND status <> 'paid' AND due_date < current_date),
      'due_7d_count', (SELECT count(*) FROM public.supplier_invoices WHERE organization_id = _org AND status <> 'paid' AND due_date BETWEEN current_date AND current_date + 7),
      'awaiting_approval', (SELECT count(*) FROM public.supplier_invoices WHERE organization_id = _org AND status = 'requested'),
      'approved_unpaid', (SELECT count(*) FROM public.supplier_invoices WHERE organization_id = _org AND status = 'approved')),
    'receivables', jsonb_build_object(
      'billed', COALESCE((SELECT sum(total_fee) FROM public.fee_records WHERE organization_id = _org), 0),
      'collected', COALESCE((SELECT sum(amount_paid) FROM public.fee_records WHERE organization_id = _org), 0),
      'outstanding', COALESCE((SELECT sum(balance) FROM public.fee_records WHERE organization_id = _org AND balance > 0), 0),
      'debtors', (SELECT count(*) FROM public.fee_records WHERE organization_id = _org AND balance > 0),
      'aged_30', COALESCE((SELECT sum(balance) FROM public.fee_records WHERE organization_id = _org AND balance > 0 AND created_at > now() - interval '30 days'), 0),
      'aged_60', COALESCE((SELECT sum(balance) FROM public.fee_records WHERE organization_id = _org AND balance > 0 AND created_at <= now() - interval '30 days' AND created_at > now() - interval '60 days'), 0),
      'aged_90', COALESCE((SELECT sum(balance) FROM public.fee_records WHERE organization_id = _org AND balance > 0 AND created_at <= now() - interval '60 days' AND created_at > now() - interval '90 days'), 0),
      'aged_over_90', COALESCE((SELECT sum(balance) FROM public.fee_records WHERE organization_id = _org AND balance > 0 AND created_at <= now() - interval '90 days'), 0),
      'adjustments_pending', (SELECT count(*) FROM public.debtor_adjustments WHERE organization_id = _org AND status IN ('requested','approved'))),
    'assets', jsonb_build_object(
      'count', (SELECT count(*) FROM public.assets WHERE organization_id = _org AND COALESCE(active, true)),
      'requests_pending', (SELECT count(*) FROM public.asset_requests WHERE organization_id = _org AND status = 'requested'),
      'open_maintenance', (SELECT count(*) FROM public.maintenance_tasks WHERE organization_id = _org AND status::text NOT IN ('completed','cancelled')),
      'maintenance_spend', COALESCE((SELECT sum(estimated_cost) FROM public.asset_requests WHERE organization_id = _org AND kind = 'maintenance_expenditure' AND status = 'completed'), 0)),
    'journals', jsonb_build_object(
      'draft', (SELECT count(*) FROM public.journal_entries WHERE organization_id = _org AND status = 'draft'),
      'submitted', (SELECT count(*) FROM public.journal_entries WHERE organization_id = _org AND status = 'submitted'),
      'approved_unposted', (SELECT count(*) FROM public.journal_entries WHERE organization_id = _org AND status = 'approved'),
      'posted', (SELECT count(*) FROM public.journal_entries WHERE organization_id = _org AND status = 'posted')),
    'reconciliation', jsonb_build_object(
      'unmatched_lines', (SELECT count(*) FROM public.bank_statement_lines WHERE organization_id = _org AND status NOT IN ('matched','ignored','allocated','handled')))
  ) INTO _res;
  RETURN _res;
END $$;
GRANT EXECUTE ON FUNCTION public.finance_overview() TO authenticated;

-- Income (payments received) and expenditure (supplier invoices paid) by month
CREATE OR REPLACE FUNCTION public.finance_monthly(_months integer DEFAULT 12)
RETURNS TABLE (month text, income numeric, expenditure numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['head_of_finance_admin','accountant','centre_manager','organization_admin','admin']) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
  SELECT to_char(m, 'YYYY-MM'),
         COALESCE((SELECT sum(p.amount) FROM public.payments p JOIN public.fee_records f ON f.id = p.fee_record_id
                    WHERE f.organization_id = _org AND date_trunc('month', p.payment_date) = m), 0),
         COALESCE((SELECT sum(s.total_amount) FROM public.supplier_invoices s WHERE s.organization_id = _org AND s.status = 'paid' AND date_trunc('month', s.paid_at) = m), 0)
  FROM generate_series(date_trunc('month', current_date) - make_interval(months => GREATEST(_months, 1) - 1), date_trunc('month', current_date), interval '1 month') m
  ORDER BY m;
END $$;
GRANT EXECUTE ON FUNCTION public.finance_monthly(integer) TO authenticated;
