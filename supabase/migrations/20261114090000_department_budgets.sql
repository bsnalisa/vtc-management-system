-- Departmental budgets screen.
-- The Head of Finance and Administration proposes a department's budget for a year (or a change to it); the Centre Manager
-- approves or rejects; only the approved figure counts. What a department has committed is not typed in: it is the order
-- value the Procurement Officer records on that department's requisitions for the year (cancelled ones excluded), kept
-- in `spent_amount` by triggers so the Centre Manager dashboard shows real utilisation. The table is changed only through
-- these functions, only finance roles and the Centre Manager can read it, and every step is in an append-only log.

ALTER TABLE public.department_budgets
  ADD COLUMN IF NOT EXISTS proposed_total numeric CHECK (proposed_total IS NULL OR proposed_total >= 0),
  ADD COLUMN IF NOT EXISTS proposal_status text NOT NULL DEFAULT 'none' CHECK (proposal_status IN ('none', 'pending', 'rejected')),
  ADD COLUMN IF NOT EXISTS proposal_reason text,
  ADD COLUMN IF NOT EXISTS proposal_note text,
  ADD COLUMN IF NOT EXISTS proposed_by uuid,
  ADD COLUMN IF NOT EXISTS proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
-- lines that already exist are in force
UPDATE public.department_budgets SET approved_at = created_at WHERE approved_at IS NULL;

CREATE TABLE public.budget_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL,
  line_id uuid, department text NOT NULL, budget_year text NOT NULL,
  event text NOT NULL CHECK (event IN ('proposed', 'withdrawn', 'approved', 'rejected')),
  old_total numeric, new_total numeric, note text,
  actor uuid, actor_name text, actor_role text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_budget_events_org ON public.budget_events (organization_id, at DESC);
CREATE TRIGGER trg_budget_events_append_only BEFORE UPDATE OR DELETE ON public.budget_events FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();
ALTER TABLE public.budget_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance and the Centre Manager read the budget log" ON public.budget_events FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['head_of_finance_admin', 'accountant', 'centre_manager']) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Centre isolation" ON public.budget_events AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.budget_events FROM anon, authenticated;

-- no direct writes; budgets are no longer readable by every member of the centre
DROP POLICY IF EXISTS "Admins and procurement officers can manage budgets" ON public.department_budgets;
DROP POLICY IF EXISTS "Users can view budgets in their organization" ON public.department_budgets;
DROP POLICY IF EXISTS "Finance, procurement and the Centre Manager read budgets" ON public.department_budgets;
CREATE POLICY "Finance, procurement and the Centre Manager read budgets" ON public.department_budgets FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['head_of_finance_admin', 'accountant', 'centre_manager', 'procurement_officer']) OR public.is_super_admin(auth.uid()));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.department_budgets FROM anon;
REVOKE TRUNCATE ON public.department_budgets FROM authenticated;

-- ---------------------------------------------------------------------------
-- Committed = order value recorded on the department's requisitions submitted in the year
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.budget_committed(_org uuid, _department text, _year text) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(p.order_value), 0) FROM public.requisition_procurement p JOIN public.purchase_requisitions r ON r.id = p.requisition_id
   WHERE r.organization_id = _org AND lower(trim(r.department)) = lower(trim(_department)) AND r.status <> 'cancelled' AND to_char(r.submitted_at, 'YYYY') = _year;
$$;
CREATE OR REPLACE FUNCTION private.budget_resync(_org uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.department_budgets b SET spent_amount = private.budget_committed(b.organization_id, b.department, b.budget_year)
   WHERE b.organization_id = _org AND b.spent_amount IS DISTINCT FROM private.budget_committed(b.organization_id, b.department, b.budget_year);
$$;
CREATE OR REPLACE FUNCTION private.budget_resync_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM private.budget_resync(NEW.organization_id); RETURN NULL; END $$;
CREATE TRIGGER trg_budget_resync_order AFTER INSERT OR UPDATE OF order_value ON public.requisition_procurement FOR EACH ROW EXECUTE FUNCTION private.budget_resync_trigger();
CREATE TRIGGER trg_budget_resync_requisition AFTER UPDATE OF status, department, submitted_at ON public.purchase_requisitions FOR EACH ROW EXECUTE FUNCTION private.budget_resync_trigger();
REVOKE ALL ON FUNCTION private.budget_committed(uuid, text, text), private.budget_resync(uuid), private.budget_resync_trigger() FROM PUBLIC, anon, authenticated;
SELECT private.budget_resync(id) FROM public.organizations;

CREATE OR REPLACE FUNCTION private.budget_log(_org uuid, _line uuid, _dept text, _year text, _event text, _old numeric, _new numeric, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p jsonb := private.requisition_person(_org, auth.uid());
BEGIN
  INSERT INTO public.budget_events (organization_id, line_id, department, budget_year, event, old_total, new_total, note, actor, actor_name, actor_role)
    VALUES (_org, _line, _dept, _year, _event, _old, _new, nullif(trim(coalesce(_note, '')), ''), auth.uid(), _p ->> 'name', _p ->> 'role');
END $$;
REVOKE ALL ON FUNCTION private.budget_log(uuid, uuid, text, text, text, numeric, numeric, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Proposing, withdrawing and deciding
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.budget_propose(_org uuid, _department text, _year text, _amount numeric, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.department_budgets%ROWTYPE; _dept text := trim(coalesce(_department, '')); r record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['head_of_finance_admin']) THEN RAISE EXCEPTION 'Only the Head of Finance and Administration proposes budgets' USING ERRCODE = '42501'; END IF;
  IF _dept = '' OR length(_dept) > 120 THEN RAISE EXCEPTION 'Enter the department (up to 120 characters)'; END IF;
  IF _year !~ '^\d{4}$' OR _year::int NOT BETWEEN extract(year FROM current_date)::int - 1 AND extract(year FROM current_date)::int + 3 THEN RAISE EXCEPTION 'Choose a budget year from last year to three years ahead'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 1000000000000 THEN RAISE EXCEPTION 'Enter the budget amount (zero or more)'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'Give the reason for this budget'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('budget:' || _org::text));
  SELECT * INTO b FROM public.department_budgets WHERE organization_id = _org AND budget_year = _year AND lower(trim(department)) = lower(_dept) FOR UPDATE;
  IF FOUND THEN
    IF b.proposal_status = 'pending' THEN RAISE EXCEPTION 'A change to this budget is already waiting for the Centre Manager'; END IF;
    IF b.approved_at IS NOT NULL AND b.total_budget = _amount THEN RAISE EXCEPTION 'That is the budget already in force'; END IF;
    UPDATE public.department_budgets SET proposed_total = _amount, proposal_status = 'pending', proposal_reason = trim(_reason), proposal_note = NULL, proposed_by = auth.uid(), proposed_at = now() WHERE id = b.id;
  ELSE
    INSERT INTO public.department_budgets (organization_id, department, budget_year, total_budget, spent_amount, proposed_total, proposal_status, proposal_reason, proposed_by, proposed_at)
      VALUES (_org, _dept, _year, 0, 0, _amount, 'pending', trim(_reason), auth.uid(), now()) RETURNING * INTO b;
  END IF;
  PERFORM private.budget_log(_org, b.id, b.department, _year, 'proposed', CASE WHEN b.approved_at IS NULL THEN NULL ELSE b.total_budget END, _amount, _reason);
  PERFORM private.budget_resync(_org);
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = _org AND role::text = 'centre_manager' LOOP
    PERFORM public.notify_person(_org, r.user_id, NULL, 'budget', 'Budget for approval: ' || b.department || ' ' || _year,
      'The Head of Finance and Administration proposed N$ ' || to_char(_amount, 'FM999G999G999G990D00') || ' for ' || b.department || ' (' || _year || '). Open Budgets to approve or reject it.', '/budgets');
  END LOOP;
  RETURN b.id;
END $$;

CREATE OR REPLACE FUNCTION public.budget_withdraw(_line uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.department_budgets%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.department_budgets WHERE id = _line FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), b.organization_id, ARRAY['head_of_finance_admin']) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF b.proposal_status NOT IN ('pending', 'rejected') THEN RAISE EXCEPTION 'There is no proposal to withdraw'; END IF;
  PERFORM private.budget_log(b.organization_id, b.id, b.department, b.budget_year, 'withdrawn', CASE WHEN b.approved_at IS NULL THEN NULL ELSE b.total_budget END, b.proposed_total, NULL);
  IF b.approved_at IS NULL THEN DELETE FROM public.department_budgets WHERE id = _line;
  ELSE UPDATE public.department_budgets SET proposal_status = 'none', proposed_total = NULL, proposal_reason = NULL, proposal_note = NULL, proposed_by = NULL, proposed_at = NULL WHERE id = _line; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.budget_decide(_line uuid, _approve boolean, _note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.department_budgets%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.department_budgets WHERE id = _line FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), b.organization_id, ARRAY['centre_manager']) THEN RAISE EXCEPTION 'Only the Centre Manager approves budgets' USING ERRCODE = '42501'; END IF;
  IF b.proposal_status <> 'pending' THEN RAISE EXCEPTION 'This budget is not waiting for approval'; END IF;
  IF NOT _approve AND length(trim(coalesce(_note, ''))) < 5 THEN RAISE EXCEPTION 'Give the reason for rejecting it'; END IF;
  IF _approve THEN
    UPDATE public.department_budgets SET total_budget = b.proposed_total, proposed_total = NULL, proposal_status = 'none', proposal_note = nullif(trim(coalesce(_note, '')), ''), approved_by = auth.uid(), approved_at = now() WHERE id = _line;
  ELSE
    UPDATE public.department_budgets SET proposal_status = 'rejected', proposal_note = trim(_note) WHERE id = _line;
  END IF;
  PERFORM private.budget_log(b.organization_id, b.id, b.department, b.budget_year, CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, CASE WHEN b.approved_at IS NULL THEN NULL ELSE b.total_budget END, b.proposed_total, _note);
  IF b.proposed_by IS NOT NULL THEN
    PERFORM public.notify_person(b.organization_id, b.proposed_by, NULL, 'budget', CASE WHEN _approve THEN 'Budget approved: ' ELSE 'Budget rejected: ' END || b.department || ' ' || b.budget_year,
      CASE WHEN _approve THEN 'The Centre Manager approved the budget for ' || b.department || '.' ELSE 'The Centre Manager rejected the proposal for ' || b.department || ': ' || trim(_note) END, '/budgets');
  END IF;
  RETURN CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
END $$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.budget_overview(_org uuid, _year text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year text := coalesce(nullif(trim(coalesce(_year, '')), ''), to_char(current_date, 'YYYY'));
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_org_role(auth.uid(), _org, ARRAY['head_of_finance_admin', 'accountant', 'centre_manager', 'procurement_officer']) OR public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'year', v_year,
    'years', (SELECT coalesce(jsonb_agg(DISTINCT y ORDER BY y DESC), '[]'::jsonb) FROM (SELECT budget_year AS y FROM public.department_budgets WHERE organization_id = _org
               UNION SELECT to_char(current_date, 'YYYY') UNION SELECT to_char(current_date + interval '1 year', 'YYYY')) s),
    'can_propose', public.has_org_role(auth.uid(), _org, ARRAY['head_of_finance_admin']),
    'can_decide', public.has_org_role(auth.uid(), _org, ARRAY['centre_manager']),
    'lines', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'department', b.department, 'total', b.total_budget, 'in_force', b.approved_at IS NOT NULL,
        'committed', private.budget_committed(_org, b.department, b.budget_year),
        'available', b.total_budget - private.budget_committed(_org, b.department, b.budget_year),
        'utilisation', CASE WHEN b.total_budget > 0 THEN round(100.0 * private.budget_committed(_org, b.department, b.budget_year) / b.total_budget, 1) END,
        'requisitions', (SELECT count(*) FROM public.purchase_requisitions r WHERE r.organization_id = _org AND lower(trim(r.department)) = lower(trim(b.department)) AND r.status <> 'cancelled' AND to_char(r.submitted_at, 'YYYY') = b.budget_year),
        'proposal_status', b.proposal_status, 'proposed_total', b.proposed_total, 'proposal_reason', b.proposal_reason, 'proposal_note', b.proposal_note,
        'proposed_by', private.requisition_person(_org, b.proposed_by) ->> 'name', 'proposed_at', b.proposed_at,
        'approved_by', private.requisition_person(_org, b.approved_by) ->> 'name', 'approved_at', b.approved_at) ORDER BY b.department)
      FROM public.department_budgets b WHERE b.organization_id = _org AND b.budget_year = v_year), '[]'::jsonb),
    'unbudgeted', coalesce((SELECT jsonb_agg(jsonb_build_object('department', x.department, 'requisitions', x.n, 'committed', x.c) ORDER BY x.c DESC, x.department)
      FROM (SELECT trim(r.department) AS department, count(*) AS n, coalesce(sum(p.order_value), 0) AS c FROM public.purchase_requisitions r LEFT JOIN public.requisition_procurement p ON p.requisition_id = r.id
             WHERE r.organization_id = _org AND r.status <> 'cancelled' AND r.submitted_at IS NOT NULL AND to_char(r.submitted_at, 'YYYY') = v_year AND coalesce(trim(r.department), '') <> ''
               AND NOT EXISTS (SELECT 1 FROM public.department_budgets b WHERE b.organization_id = _org AND b.budget_year = v_year AND lower(trim(b.department)) = lower(trim(r.department)))
             GROUP BY trim(r.department)) x), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event, 'department', e.department, 'year', e.budget_year, 'old_total', e.old_total, 'new_total', e.new_total, 'note', e.note, 'by', e.actor_name, 'role', e.actor_role, 'at', e.at) ORDER BY e.at DESC)
      FROM (SELECT * FROM public.budget_events WHERE organization_id = _org ORDER BY at DESC LIMIT 60) e), '[]'::jsonb));
END $$;

-- the budget behind a requisition, for the Accountant's "Fund available" decision
CREATE OR REPLACE FUNCTION public.budget_for_requisition(_req uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; b public.department_budgets%ROWTYPE; v_year text;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _req;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.requisition_can_view(auth.uid(), _req)
     OR NOT public.has_org_role(auth.uid(), r.organization_id, ARRAY['head_of_finance_admin', 'accountant', 'centre_manager', 'procurement_officer']) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  v_year := to_char(coalesce(r.submitted_at, now()), 'YYYY');
  SELECT * INTO b FROM public.department_budgets WHERE organization_id = r.organization_id AND budget_year = v_year AND lower(trim(department)) = lower(trim(coalesce(r.department, ''))) AND approved_at IS NOT NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('department', r.department, 'year', v_year, 'found', false); END IF;
  RETURN jsonb_build_object('department', b.department, 'year', v_year, 'found', true, 'total', b.total_budget, 'committed', private.budget_committed(r.organization_id, b.department, v_year),
    'available', b.total_budget - private.budget_committed(r.organization_id, b.department, v_year));
END $$;

REVOKE ALL ON FUNCTION public.budget_propose(uuid, text, text, numeric, text), public.budget_withdraw(uuid), public.budget_decide(uuid, boolean, text), public.budget_overview(uuid, text), public.budget_for_requisition(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.budget_propose(uuid, text, text, numeric, text), public.budget_withdraw(uuid), public.budget_decide(uuid, boolean, text), public.budget_overview(uuid, text), public.budget_for_requisition(uuid) TO authenticated, service_role;
