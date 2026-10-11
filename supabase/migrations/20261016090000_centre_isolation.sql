-- Centre isolation for staff and trainees.
--
-- Many older policies grant access with global role checks (has_role(auth.uid(), 'trainer'), is_admin(...)) and never
-- ask which centre a row belongs to, so a trainer or officer at one centre could read or change another centre's rows.
-- Instead of rewriting each policy, one RESTRICTIVE "Centre isolation" policy is added per table. It is ANDed with the
-- existing policies and only ever narrows access: a user who belongs to one or more centres can only touch rows that
-- belong to one of their centres. Rows with no centre (shared reference data) stay as the existing policies decide.
--
-- Not affected: anonymous visitors and applicants (no centre role), service-role code, super admins and platform staff.

-- ---------------------------------------------------------------------------
-- 1. Helpers (evaluated once per statement through scalar sub-selects, not per row)
-- ---------------------------------------------------------------------------
-- Does the signed-in user belong to a centre and not to the platform team?
CREATE OR REPLACE FUNCTION public.is_centre_scoped_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text IN ('super_admin', 'vms_developer', 'vms_support'));
$$;

-- Every centre the signed-in user belongs to
CREATE OR REPLACE FUNCTION public.my_centre_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT ur.organization_id), ARRAY[]::uuid[])
  FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id IS NOT NULL;
$$;

-- Is this user (a profile owner, a log author) a member of one of my centres, or of no centre at all (an applicant)?
CREATE OR REPLACE FUNCTION public.user_visible_to_my_centres(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
      OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.organization_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.organization_id = ANY (public.my_centre_ids()));
$$;

-- ---------------------------------------------------------------------------
-- 2. One policy per table
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  expr text;
  scoped text := 'NOT (SELECT public.is_centre_scoped_user()) OR ';
BEGIN
  -- (a) Every table that carries its own centre column
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema = 'public' AND k.table_name = c.relname AND k.column_name = 'organization_id' AND k.data_type = 'uuid')
  LOOP
    expr := format('%1$s(%2$I.organization_id IS NULL OR %2$I.organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))', scoped, r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Centre isolation" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (%s) WITH CHECK (%s)', r.tbl, expr, expr);
  END LOOP;

  -- (b) Tables with no centre column: take the centre from the row they belong to. {t} is the table name, which keeps
  --     outer columns unambiguous (trainees has its own trainee_id column).
  FOR r IN SELECT * FROM (VALUES
    ('assessment_results',        '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('attendance_records',        '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('documents',                 '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('marks',                     '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('trainee_enrollments',       '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('trainee_update_requests',   '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('class_enrollments',         '(SELECT x.organization_id FROM public.classes x WHERE x.id = {t}.class_id)'),
    ('timetable_slots',           '(SELECT x.organization_id FROM public.classes x WHERE x.id = {t}.class_id)'),
    ('payments',                  '(SELECT x.organization_id FROM public.fee_records x WHERE x.id = {t}.fee_record_id)'),
    ('invoice_items',             '(SELECT x.organization_id FROM public.invoices x WHERE x.id = {t}.invoice_id)'),
    ('qualification_approvals',   '(SELECT x.organization_id FROM public.qualifications x WHERE x.id = {t}.qualification_id)'),
    ('qualification_unit_standards','(SELECT x.organization_id FROM public.qualifications x WHERE x.id = {t}.qualification_id)'),
    ('delivery_plan_weeks',       '(SELECT x.organization_id FROM public.delivery_plans x WHERE x.id = {t}.plan_id)'),
    ('gradebook_audit_logs',      '(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('gradebook_ca_scores',       '(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('gradebook_component_groups','(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('gradebook_components',      '(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('gradebook_feedback',        '(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('gradebook_mark_queries',    '(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('gradebook_marks',           '(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('gradebook_trainees',        '(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('mark_queries',              '(SELECT x.organization_id FROM public.gradebooks x WHERE x.id = {t}.gradebook_id)'),
    ('gradebook_component_units', '(SELECT g.organization_id FROM public.gradebook_components c JOIN public.gradebooks g ON g.id = c.gradebook_id WHERE c.id = {t}.component_id)'),
    ('purchase_order_items',      '(SELECT x.organization_id FROM public.purchase_orders x WHERE x.id = {t}.purchase_order_id)'),
    ('purchase_requisition_items','(SELECT x.organization_id FROM public.purchase_requisitions x WHERE x.id = {t}.requisition_id)'),
    ('receiving_report_items',    '(SELECT x.organization_id FROM public.receiving_reports x WHERE x.id = {t}.receiving_report_id)'),
    ('maintenance_costs',         '(SELECT x.organization_id FROM public.maintenance_tasks x WHERE x.id = {t}.task_id)'),
    ('maintenance_materials',     '(SELECT x.organization_id FROM public.maintenance_tasks x WHERE x.id = {t}.task_id)'),
    ('trainer_trades',            '(SELECT x.organization_id FROM public.trainers x WHERE x.id = {t}.trainer_id)'),
    ('workflow_tasks',            '(SELECT x.organization_id FROM public.workflow_instances x WHERE x.id = {t}.instance_id)'),
    ('workflow_events',           '(SELECT x.organization_id FROM public.workflow_instances x WHERE x.id = {t}.instance_id)'),
    ('workflow_task_assignees',   '(SELECT i.organization_id FROM public.workflow_tasks k JOIN public.workflow_instances i ON i.id = k.instance_id WHERE k.id = {t}.task_id)'),
    ('workflow_action_tokens',    '(SELECT i.organization_id FROM public.workflow_tasks k JOIN public.workflow_instances i ON i.id = k.instance_id WHERE k.id = {t}.task_id)'),
    ('assessment_template_components','(SELECT x.organization_id FROM public.assessment_templates x WHERE x.id = {t}.template_id)'),
    ('question_paper_items',      '(SELECT x.organization_id FROM public.question_papers x WHERE x.id = {t}.paper_id)'),
    ('assessments',               '(SELECT x.organization_id FROM public.user_roles x WHERE x.user_id = {t}.created_by LIMIT 1)')
  ) AS v(tbl, org_expr) LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN CONTINUE; END IF;
    BEGIN
      expr := format('%s((%s) IS NULL OR (%s) = ANY ((SELECT public.my_centre_ids())::uuid[]))', scoped, replace(r.org_expr, '{t}', r.tbl), replace(r.org_expr, '{t}', r.tbl));
      EXECUTE format('DROP POLICY IF EXISTS "Centre isolation" ON public.%I', r.tbl);
      EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (%s) WITH CHECK (%s)', r.tbl, expr, expr);
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      RAISE NOTICE 'Centre isolation skipped for % (a linked column or table is missing here)', r.tbl;
    END;
  END LOOP;

  -- (c) Tables keyed by the person: people are visible to the centres they belong to (applicants have no centre)
  FOR r IN SELECT * FROM (VALUES ('profiles'), ('role_activity_logs')) AS v(tbl) LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN CONTINUE; END IF;
    expr := format('%s public.user_visible_to_my_centres(%I.user_id)', scoped, r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Centre isolation" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (%s) WITH CHECK (%s)', r.tbl, expr, expr);
  END LOOP;
END $$;
