-- Centre Manager dashboard review (against the NTA Centre Manager job description):
--  1. Access: the dashboard's data functions admit the Centre Manager (and platform staff) only; the Organization Admin is the IT administrator and
--     has no business reading academic or finance figures. Fee figures on the main dashboard are for the latest academic year, not all years mixed.
--  2. Finance: fees by academic year, budget against actual per department, NSFAF funding allocations, and the requisition pipeline with ordered value.
--  3. Quality of training: qualification approval, certification backlog, completion and dropout, delivery plans, assessment cycles.
--  4. Staffing: trainer-to-trainee ratio, approved posts against filled (vacancies), appraisals, leave, contracts ending.
--  5. Stakeholders and administration: open correspondence, reports and reviews due (kept in the PA's task register), meetings.
--  6. Targets for the main indicators, kept by the PA so the Centre Manager stays read-only; every figure is read from live records.

-- ---------------------------------------------------------------------------
-- 1. Access and fee year
-- ---------------------------------------------------------------------------
DO $$
DECLARE _def text; _old text;
BEGIN
  _def := pg_get_functiondef('public.centre_manager_overview(uuid)'::regprocedure);
  _old := 'ARRAY[''centre_manager'', ''organization_admin'', ''admin'']';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'centre_manager_overview: role list not found'; END IF;
  _def := replace(_def, _old, 'ARRAY[''centre_manager'']');
  _old := 'FROM fee_records WHERE organization_id = v_org;';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'centre_manager_overview: fee query not found'; END IF;
  _def := replace(_def, _old, 'FROM fee_records WHERE organization_id = v_org AND academic_year = (SELECT max(f2.academic_year) FROM fee_records f2 WHERE f2.organization_id = v_org);');
  EXECUTE _def;

  _def := pg_get_functiondef('public.centre_manager_executive(uuid)'::regprocedure);
  _old := 'ARRAY[''centre_manager'',''organization_admin'',''admin'']';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'centre_manager_executive: role list not found'; END IF;
  _def := replace(_def, _old, 'ARRAY[''centre_manager'']');
  EXECUTE _def;
END $$;

CREATE OR REPLACE FUNCTION private.cm_assert(_org uuid) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := COALESCE(_org, public.get_user_organization(auth.uid()));
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT (public.is_platform_user() OR public.has_org_role(auth.uid(), v_org, ARRAY['centre_manager'])) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN v_org;
END $$;
REVOKE ALL ON FUNCTION private.cm_assert(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ordered value on a requisition (recorded by the Procurement Officer) and the finance panel
-- ---------------------------------------------------------------------------
ALTER TABLE public.requisition_procurement ADD COLUMN IF NOT EXISTS order_value numeric(14,2) CHECK (order_value IS NULL OR order_value >= 0);

CREATE OR REPLACE FUNCTION public.requisition_set_order_value(_id uuid, _value numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  r := private.requisition_lock(_id, ARRAY['procurement_officer'], ARRAY['approved_awaiting_procurement', 'procurement_in_progress', 'order_placed', 'delivery_outstanding', 'partially_received'], 'record the order value');
  IF _value IS NULL OR _value < 0 OR _value > 1000000000 THEN RAISE EXCEPTION 'Enter the order value as an amount of zero or more'; END IF;
  INSERT INTO public.requisition_procurement (requisition_id, organization_id, order_value, updated_by) VALUES (_id, r.organization_id, _value, auth.uid())
    ON CONFLICT (requisition_id) DO UPDATE SET order_value = EXCLUDED.order_value, updated_by = auth.uid(), updated_at = now();
  PERFORM private.requisition_log(_id, 'note', 'Order value recorded', jsonb_build_object('order_value', _value));
END $$;
REVOKE ALL ON FUNCTION public.requisition_set_order_value(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_set_order_value(uuid, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.centre_manager_finance(_org uuid DEFAULT NULL, _year text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := private.cm_assert(_org); v_year text; v_billed numeric; v_paid numeric; v_bal numeric; v_debtors integer;
BEGIN
  v_year := coalesce(nullif(trim(coalesce(_year, '')), ''), (SELECT max(academic_year) FROM fee_records WHERE organization_id = v_org));
  SELECT coalesce(sum(total_fee), 0), coalesce(sum(amount_paid), 0), coalesce(sum(balance), 0), count(*) FILTER (WHERE balance > 0)
    INTO v_billed, v_paid, v_bal, v_debtors FROM fee_records WHERE organization_id = v_org AND academic_year = v_year;
  RETURN jsonb_build_object(
    'year', v_year,
    'years', coalesce((SELECT jsonb_agg(DISTINCT y ORDER BY y DESC) FROM (SELECT academic_year AS y FROM fee_records WHERE organization_id = v_org UNION SELECT budget_year FROM department_budgets WHERE organization_id = v_org) s WHERE y IS NOT NULL), '[]'::jsonb),
    'fees', jsonb_build_object('billed', v_billed, 'collected', v_paid, 'outstanding', v_bal, 'debtors', v_debtors, 'collection_rate', CASE WHEN v_billed > 0 THEN round(100.0 * v_paid / v_billed, 1) END),
    'budgets', coalesce((SELECT jsonb_agg(jsonb_build_object('department', b.department, 'total', b.total_budget, 'spent', b.spent_amount, 'remaining', b.remaining_amount,
        'utilisation', CASE WHEN b.total_budget > 0 THEN round(100.0 * b.spent_amount / b.total_budget, 1) END,
        'committed', (SELECT coalesce(sum(p.order_value), 0) FROM requisition_procurement p JOIN purchase_requisitions r ON r.id = p.requisition_id
                       WHERE r.organization_id = v_org AND lower(trim(r.department)) = lower(trim(b.department)) AND r.status NOT IN ('cancelled') AND to_char(r.submitted_at, 'YYYY') = b.budget_year)) ORDER BY b.department)
        FROM department_budgets b WHERE b.organization_id = v_org AND b.budget_year = v_year), '[]'::jsonb),
    'funding', jsonb_build_object(
      'cases', (SELECT count(*) FROM funding_records WHERE organization_id = v_org AND academic_year = v_year),
      'by_award_status', coalesce((SELECT jsonb_agg(jsonb_build_object('status', s, 'count', n) ORDER BY n DESC) FROM (SELECT coalesce(award_status, 'not recorded') s, count(*) n FROM funding_records WHERE organization_id = v_org AND academic_year = v_year GROUP BY 1) q), '[]'::jsonb),
      'awarded', (SELECT coalesce(sum(awarded_amount), 0) FROM funding_records WHERE organization_id = v_org AND academic_year = v_year),
      'received', (SELECT coalesce(sum(p.amount), 0) FROM funding_payments p JOIN funding_records f ON f.id = p.record_id WHERE p.organization_id = v_org AND f.academic_year = v_year),
      'payments_awaiting_reconciliation', (SELECT count(*) FROM funding_payments WHERE organization_id = v_org AND reconciliation_status IN ('pending_finance', 'discrepancy', 'follow_up'))),
    'requisitions', jsonb_build_object(
      'awaiting_decision', (SELECT count(*) FROM purchase_requisitions WHERE organization_id = v_org AND status IN ('pending_line_supervisor', 'pending_accountant', 'pending_head_finance', 'pending_centre_manager')),
      'awaiting_my_decision', (SELECT count(*) FROM purchase_requisitions WHERE organization_id = v_org AND status = 'pending_centre_manager'),
      'approved_awaiting_procurement', (SELECT count(*) FROM purchase_requisitions WHERE organization_id = v_org AND status IN ('approved_awaiting_procurement', 'procurement_in_progress')),
      'on_order', (SELECT count(*) FROM purchase_requisitions WHERE organization_id = v_org AND status IN ('order_placed', 'delivery_outstanding', 'partially_received')),
      'overdue_deliveries', (SELECT count(*) FROM purchase_requisitions r JOIN requisition_procurement p ON p.requisition_id = r.id WHERE r.organization_id = v_org AND r.status IN ('order_placed', 'delivery_outstanding', 'partially_received') AND p.expected_delivery < current_date),
      'closed_last_30_days', (SELECT count(*) FROM purchase_requisitions WHERE organization_id = v_org AND status = 'closed' AND closed_at > now() - interval '30 days'),
      'ordered_value', (SELECT coalesce(sum(p.order_value), 0) FROM requisition_procurement p JOIN purchase_requisitions r ON r.id = p.requisition_id WHERE r.organization_id = v_org AND r.status NOT IN ('cancelled') AND to_char(r.submitted_at, 'YYYY') = v_year),
      'orders_without_value', (SELECT count(*) FROM requisition_procurement p JOIN purchase_requisitions r ON r.id = p.requisition_id WHERE r.organization_id = v_org AND r.status IN ('order_placed', 'delivery_outstanding', 'partially_received', 'fully_received') AND p.order_value IS NULL)));
END $$;

-- ---------------------------------------------------------------------------
-- 3. Quality of training
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.centre_manager_quality(_org uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := private.cm_assert(_org); _decided bigint; _passed bigint; _total bigint; _withdrawn bigint; _completed bigint;
BEGIN
  SELECT count(*) FILTER (WHERE result_status IS NOT NULL AND result_status NOT IN ('pending')), count(*) FILTER (WHERE result_status IN ('pass', 'passed', 'competent'))
    INTO _decided, _passed FROM qualification_results WHERE organization_id = v_org AND approved_by IS NOT NULL;
  SELECT count(*), count(*) FILTER (WHERE status::text = 'withdrawn'), count(*) FILTER (WHERE status::text = 'completed') INTO _total, _withdrawn, _completed FROM trainees WHERE organization_id = v_org;
  RETURN jsonb_build_object(
    'qualifications', jsonb_build_object(
      'approved', (SELECT count(*) FROM qualifications WHERE organization_id = v_org AND status::text = 'approved' AND active),
      'pending_approval', (SELECT count(*) FROM qualifications WHERE organization_id = v_org AND status::text = 'pending_approval'),
      'draft', (SELECT count(*) FROM qualifications WHERE organization_id = v_org AND status::text = 'draft'),
      'rejected', (SELECT count(*) FROM qualifications WHERE organization_id = v_org AND status::text = 'rejected'),
      'trades_without_approved_qualification', (SELECT count(*) FROM trades t WHERE t.organization_id = v_org AND NOT EXISTS (SELECT 1 FROM qualifications q WHERE q.trade_id = t.id AND q.status::text = 'approved' AND q.active))),
    'results', jsonb_build_object('awaiting_approval', (SELECT count(*) FROM qualification_results WHERE organization_id = v_org AND approved_by IS NULL), 'decided', _decided, 'passed', _passed,
      'pass_rate', CASE WHEN _decided > 0 THEN round(100.0 * _passed / _decided, 1) END),
    'progression', jsonb_build_object('registered', _total, 'completed', _completed, 'withdrawn', _withdrawn,
      'dropout_rate', CASE WHEN _total > 0 THEN round(100.0 * _withdrawn / _total, 1) END,
      'completion_rate', CASE WHEN _completed + _withdrawn > 0 THEN round(100.0 * _completed / (_completed + _withdrawn), 1) END,
      'by_status', coalesce((SELECT jsonb_agg(jsonb_build_object('status', s, 'count', n) ORDER BY n DESC) FROM (SELECT status::text s, count(*) n FROM trainees WHERE organization_id = v_org GROUP BY 1) q), '[]'::jsonb)),
    'delivery_plans', coalesce((SELECT jsonb_agg(jsonb_build_object('status', s, 'count', n) ORDER BY n DESC) FROM (SELECT status s, count(*) n FROM delivery_plans WHERE organization_id = v_org GROUP BY 1) q), '[]'::jsonb),
    'assessment_cycles', jsonb_build_object('open', (SELECT count(*) FROM assessment_cycles WHERE organization_id = v_org AND status <> 'locked'), 'locked', (SELECT count(*) FROM assessment_cycles WHERE organization_id = v_org AND status = 'locked')),
    'attendance', jsonb_build_object('rate_30_days', (SELECT round(100.0 * count(*) FILTER (WHERE ar.present) / NULLIF(count(*), 0), 1) FROM attendance_records ar JOIN attendance_registers rg ON rg.id = ar.register_id
        WHERE rg.organization_id = v_org AND ar.attendance_date > current_date - 30 AND ar.attendance_date <= current_date)));
END $$;

-- ---------------------------------------------------------------------------
-- 4. Staffing: approved posts (kept by the HR officer) against who actually holds the role
-- ---------------------------------------------------------------------------
CREATE TABLE public.staff_establishment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL, post_title text NOT NULL, approved_posts integer NOT NULL CHECK (approved_posts >= 0 AND approved_posts <= 500), notes text,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, role)
);
ALTER TABLE public.staff_establishment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR and the Centre Manager read the establishment" ON public.staff_establishment FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['hr_officer', 'centre_manager']));
CREATE POLICY "Centre isolation" ON public.staff_establishment AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
REVOKE INSERT, UPDATE, DELETE ON public.staff_establishment FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_staff_establishment(_org uuid, _role text, _post_title text, _approved integer, _notes text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['hr_officer']) THEN RAISE EXCEPTION 'Only the HR officer keeps the staff establishment' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.custom_roles r WHERE r.role_code = _role AND r.active) THEN RAISE EXCEPTION 'Unknown role'; END IF;
  IF coalesce(trim(_post_title), '') = '' THEN RAISE EXCEPTION 'Give the post a title'; END IF;
  IF _approved IS NULL OR _approved < 0 OR _approved > 500 THEN RAISE EXCEPTION 'Enter the number of approved posts'; END IF;
  INSERT INTO public.staff_establishment (organization_id, role, post_title, approved_posts, notes, updated_by) VALUES (_org, _role, trim(_post_title), _approved, nullif(trim(coalesce(_notes, '')), ''), auth.uid())
    ON CONFLICT (organization_id, role) DO UPDATE SET post_title = EXCLUDED.post_title, approved_posts = EXCLUDED.approved_posts, notes = EXCLUDED.notes, updated_by = auth.uid(), updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.save_staff_establishment(uuid, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_staff_establishment(uuid, text, text, integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.centre_manager_staffing(_org uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := private.cm_assert(_org); _tr bigint; _act bigint; _year text := to_char(current_date, 'YYYY');
BEGIN
  SELECT count(*) INTO _tr FROM trainers WHERE organization_id = v_org AND active;
  SELECT count(*) INTO _act FROM trainees WHERE organization_id = v_org AND status::text = 'active';
  RETURN jsonb_build_object(
    'trainers', _tr, 'active_trainees', _act, 'trainees_per_trainer', CASE WHEN _tr > 0 THEN round(_act::numeric / _tr, 1) END,
    'staff', (SELECT count(DISTINCT user_id) FROM user_roles WHERE organization_id = v_org AND role::text NOT IN ('trainee', 'applicant')),
    'establishment', coalesce((SELECT jsonb_agg(jsonb_build_object('role', e.role, 'post', e.post_title, 'approved', e.approved_posts,
        'filled', (SELECT count(DISTINCT user_id) FROM user_roles WHERE organization_id = v_org AND role::text = e.role),
        'vacant', greatest(e.approved_posts - (SELECT count(DISTINCT user_id) FROM user_roles WHERE organization_id = v_org AND role::text = e.role), 0)) ORDER BY e.post_title)
        FROM staff_establishment e WHERE e.organization_id = v_org), '[]'::jsonb),
    'appraisals', jsonb_build_object(
      'open', (SELECT count(*) FROM performance_reviews WHERE organization_id = v_org AND status NOT IN ('acknowledged', 'completed', 'closed')),
      'staff_without_review_this_year', (SELECT count(DISTINCT ur.user_id) FROM user_roles ur WHERE ur.organization_id = v_org AND ur.role::text NOT IN ('trainee', 'applicant')
          AND NOT EXISTS (SELECT 1 FROM performance_reviews p WHERE p.organization_id = v_org AND p.employee_user_id = ur.user_id AND p.period LIKE _year || '%'))),
    'leave', jsonb_build_object('pending', (SELECT count(*) FROM leave_requests WHERE organization_id = v_org AND status = 'pending'),
      'on_leave_today', (SELECT count(*) FROM leave_requests WHERE organization_id = v_org AND status = 'approved' AND current_date BETWEEN start_date AND end_date),
      'days_this_month', (SELECT coalesce(sum(days), 0) FROM leave_requests WHERE organization_id = v_org AND status = 'approved' AND start_date >= date_trunc('month', current_date)::date AND start_date < (date_trunc('month', current_date) + interval '1 month')::date)),
    'contracts_ending_90_days', coalesce((SELECT jsonb_agg(jsonb_build_object('name', coalesce(nullif(trim(p.full_name), ''), p.email), 'job_title', s.job_title, 'end_date', s.end_date) ORDER BY s.end_date)
        FROM staff_records s LEFT JOIN profiles p ON p.user_id = s.user_id WHERE s.organization_id = v_org AND s.end_date BETWEEN current_date AND current_date + 90 AND coalesce(s.employment_status, 'active') NOT IN ('terminated', 'resigned')), '[]'::jsonb));
END $$;

-- ---------------------------------------------------------------------------
-- 5. Stakeholders and administration (the PA's registers; reports and reviews are tasks of kind report/review)
-- ---------------------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.office_tasks'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%source%' LOOP
    EXECUTE format('ALTER TABLE public.office_tasks DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE public.office_tasks ADD CONSTRAINT office_tasks_source_check CHECK (source IN ('centre_manager', 'self', 'meeting', 'correspondence', 'report', 'review'));
END $$;

CREATE OR REPLACE FUNCTION public.centre_manager_stakeholders(_org uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := private.cm_assert(_org);
BEGIN
  RETURN jsonb_build_object(
    'correspondence', jsonb_build_object(
      'open', (SELECT count(*) FROM office_correspondence WHERE organization_id = v_org AND status NOT IN ('replied', 'filed', 'closed')),
      'overdue', (SELECT count(*) FROM office_correspondence WHERE organization_id = v_org AND status NOT IN ('replied', 'filed', 'closed') AND due_on < current_date),
      'items', coalesce((SELECT jsonb_agg(jsonb_build_object('reference', reference, 'subject', subject, 'party', party, 'direction', direction, 'due_on', due_on, 'status', status, 'overdue', due_on < current_date) ORDER BY due_on NULLS LAST)
          FROM (SELECT * FROM office_correspondence WHERE organization_id = v_org AND status NOT IN ('replied', 'filed', 'closed') ORDER BY due_on NULLS LAST LIMIT 8) c), '[]'::jsonb)),
    'reports_and_reviews', jsonb_build_object(
      'open', (SELECT count(*) FROM office_tasks WHERE organization_id = v_org AND status = 'open' AND source IN ('report', 'review')),
      'overdue', (SELECT count(*) FROM office_tasks WHERE organization_id = v_org AND status = 'open' AND source IN ('report', 'review') AND due_on < current_date),
      'items', coalesce((SELECT jsonb_agg(jsonb_build_object('title', title, 'kind', source, 'due_on', due_on, 'overdue', due_on < current_date) ORDER BY due_on NULLS LAST)
          FROM (SELECT * FROM office_tasks WHERE organization_id = v_org AND status = 'open' AND source IN ('report', 'review') ORDER BY due_on NULLS LAST LIMIT 10) t), '[]'::jsonb),
      'done_last_90_days', (SELECT count(*) FROM office_tasks WHERE organization_id = v_org AND status = 'done' AND source IN ('report', 'review') AND completed_at > now() - interval '90 days')),
    'meetings_next_14_days', coalesce((SELECT jsonb_agg(jsonb_build_object('title', title, 'on', meeting_date) ORDER BY meeting_date) FROM (SELECT * FROM office_meetings WHERE organization_id = v_org AND status = 'scheduled' AND meeting_date BETWEEN current_date AND current_date + 14 ORDER BY meeting_date LIMIT 8) m), '[]'::jsonb),
    'placements', jsonb_build_object('total', (SELECT count(*) FROM internship_placements WHERE organization_id = v_org)));
END $$;

-- ---------------------------------------------------------------------------
-- 6. Targets (set by the PA on the Centre Manager's instruction; the Centre Manager reads them)
-- ---------------------------------------------------------------------------
CREATE TABLE public.centre_targets (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  indicator text NOT NULL CHECK (indicator IN ('collection_rate', 'attendance_rate', 'pass_rate', 'completion_rate', 'dropout_rate', 'trainees_per_trainer', 'budget_utilisation')),
  target numeric NOT NULL CHECK (target >= 0 AND target <= 100000),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, indicator)
);
ALTER TABLE public.centre_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "The Centre Manager and the PA read the targets" ON public.centre_targets FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['centre_manager', 'pa_to_centre_manager']));
CREATE POLICY "Centre isolation" ON public.centre_targets AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
REVOKE INSERT, UPDATE, DELETE ON public.centre_targets FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_centre_target(_org uuid, _indicator text, _target numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['pa_to_centre_manager']) THEN RAISE EXCEPTION 'Only the PA to the Centre Manager sets the targets' USING ERRCODE = '42501'; END IF;
  IF _target IS NULL THEN
    DELETE FROM public.centre_targets WHERE organization_id = _org AND indicator = _indicator;
  ELSE
    INSERT INTO public.centre_targets (organization_id, indicator, target, updated_by) VALUES (_org, _indicator, _target, auth.uid())
      ON CONFLICT (organization_id, indicator) DO UPDATE SET target = EXCLUDED.target, updated_by = auth.uid(), updated_at = now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.centre_targets_list(_org uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := COALESCE(_org, public.get_user_organization(auth.uid()));
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL OR NOT (public.is_platform_user() OR public.has_org_role(auth.uid(), v_org, ARRAY['centre_manager', 'pa_to_centre_manager'])) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_object_agg(indicator, target) FROM centre_targets WHERE organization_id = v_org), '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.save_centre_target(uuid, text, numeric), public.centre_targets_list(uuid), public.centre_manager_finance(uuid, text), public.centre_manager_quality(uuid),
  public.centre_manager_staffing(uuid), public.centre_manager_stakeholders(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_centre_target(uuid, text, numeric), public.centre_targets_list(uuid), public.centre_manager_finance(uuid, text), public.centre_manager_quality(uuid),
  public.centre_manager_staffing(uuid), public.centre_manager_stakeholders(uuid) TO authenticated, service_role;

-- the requisition page shows the recorded order value
DO $$
DECLARE _def text; _old text;
BEGIN
  _def := pg_get_functiondef('public.requisition_fulfilment(uuid)'::regprocedure);
  _old := '''order_reference'', p.order_reference,';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'requisition_fulfilment: order reference not found'; END IF;
  EXECUTE replace(_def, _old, _old || ' ''order_value'', p.order_value,');
END $$;
