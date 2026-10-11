-- Centre Manager: the report pages need a few more read-only tables and the certification report functions.

-- Tables with their own centre column that the reports read
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumni', 'internship_placements', 'stock_movements'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Centre managers read their centre" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Centre managers read their centre" ON public.%I FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, ARRAY[''centre_manager'']))', t);
  END LOOP;
END $$;

-- Tables that take their centre from the trainee or fee record they belong to
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('attendance_records',  'SELECT x.organization_id FROM public.trainees x WHERE x.id = attendance_records.trainee_id'),
    ('assessment_results',  'SELECT x.organization_id FROM public.trainees x WHERE x.id = assessment_results.trainee_id'),
    ('trainee_enrollments', 'SELECT x.organization_id FROM public.trainees x WHERE x.id = trainee_enrollments.trainee_id'),
    ('class_enrollments',   'SELECT x.organization_id FROM public.trainees x WHERE x.id = class_enrollments.trainee_id'),
    ('payments',            'SELECT x.organization_id FROM public.fee_records x WHERE x.id = payments.fee_record_id')
  ) AS v(tbl, org_sql) LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Centre managers read their centre" ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY "Centre managers read their centre" ON public.%I FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), (%s), ARRAY[''centre_manager'']))', r.tbl, r.org_sql);
  END LOOP;
END $$;

-- The two certification report functions list the roles that may run them
DO $$
DECLARE r record; def text;
BEGIN
  FOR r IN SELECT p.oid, p.proname FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('certified_trainees_report', 'assessment_certification_summary')
  LOOP
    def := pg_get_functiondef(r.oid);
    IF position('''centre_manager''' IN def) > 0 THEN CONTINUE; END IF;
    IF position('''organization_admin''' IN def) = 0 THEN RAISE EXCEPTION 'Cannot patch %: role list not found', r.proname; END IF;
    EXECUTE replace(def, '''organization_admin''', '''organization_admin'',''centre_manager''');
  END LOOP;
END $$;
