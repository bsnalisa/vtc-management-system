-- Printable trainee documents (portal rows 9.2-9.4): proof of registration and statement of results.
-- Both are issued by functions so that (a) a proof only exists for a completed registration and gets one stable
-- reference number, and (b) a trainee can only ever see results that have been approved.

CREATE OR REPLACE FUNCTION public.issue_proof_of_registration(_registration uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reg public.registrations%ROWTYPE; t public.trainees%ROWTYPE; _ref text; _tries integer := 0; _proof public.proof_of_registrations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO reg FROM public.registrations WHERE id = _registration;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  SELECT * INTO t FROM public.trainees WHERE id = reg.trainee_id;
  IF NOT (t.user_id = auth.uid() OR public.has_org_role(auth.uid(), reg.organization_id, ARRAY['registration_officer','admin','organization_admin'])) THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;
  IF reg.registration_status <> 'registered' THEN
    RAISE EXCEPTION 'Your registration is not complete yet (%). A proof of registration can be printed once it is.', replace(reg.registration_status, '_', ' ');
  END IF;

  SELECT * INTO _proof FROM public.proof_of_registrations
    WHERE trainee_id = reg.trainee_id AND academic_year = reg.academic_year
      AND qualification_id IS NOT DISTINCT FROM reg.qualification_id
    ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN
    LOOP
      _ref := 'POR-' || to_char(now(), 'YY') || '-' || lpad(floor(random() * 100000)::int::text, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.proof_of_registrations WHERE reference_number = _ref);
      _tries := _tries + 1;
      IF _tries > 100 THEN RAISE EXCEPTION 'Could not allocate a reference number'; END IF;
    END LOOP;
    -- the table requires a qualification; use the registration's, else the trainee's
    INSERT INTO public.proof_of_registrations (organization_id, trainee_id, qualification_id, reference_number, academic_year, registration_date, generated_by)
    VALUES (reg.organization_id, reg.trainee_id, COALESCE(reg.qualification_id, t.qualification_id), _ref, reg.academic_year,
            COALESCE(reg.registered_at::date, CURRENT_DATE), auth.uid())
    RETURNING * INTO _proof;
  END IF;

  RETURN jsonb_build_object(
    'reference_number', _proof.reference_number,
    'issued_on', _proof.created_at,
    'first_name', t.first_name, 'last_name', t.last_name, 'trainee_number', t.trainee_id, 'national_id', t.national_id,
    'trade', (SELECT name FROM public.trades WHERE id = t.trade_id),
    'level', t.level, 'training_mode', t.training_mode,
    'qualification', (SELECT qualification_title FROM public.qualifications WHERE id = _proof.qualification_id),
    'qualification_code', (SELECT qualification_code FROM public.qualifications WHERE id = _proof.qualification_id),
    'academic_year', reg.academic_year, 'registered_on', COALESCE(reg.registered_at, reg.created_at),
    'hostel_required', reg.hostel_required);
END $$;
GRANT EXECUTE ON FUNCTION public.issue_proof_of_registration(uuid) TO authenticated;

-- Approved results only, grouped by qualification and academic year, for the signed-in trainee.
CREATE OR REPLACE FUNCTION public.my_statement_of_results()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(g ORDER BY g->>'academic_year' DESC, g->>'qualification'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'qualification', q.qualification_title, 'qualification_code', q.qualification_code, 'nqf_level', q.nqf_level,
      'academic_year', r.academic_year,
      'trainee_number', t.trainee_id, 'first_name', t.first_name, 'last_name', t.last_name, 'national_id', t.national_id,
      'last_approved', max(r.approved_at),
      'results', jsonb_agg(jsonb_build_object(
        'component', c.component_name, 'ca_mark', r.ca_mark, 'sa_mark', r.sa_mark, 'pass_mark', r.pass_mark, 'status', r.result_status
      ) ORDER BY c.component_name)) AS g
    FROM public.qualification_results r
    JOIN public.trainees t ON t.id = r.trainee_id
    JOIN public.qualifications q ON q.id = r.qualification_id
    JOIN public.assessment_template_components c ON c.id = r.template_component_id
    WHERE t.user_id = auth.uid() AND r.approved_at IS NOT NULL
    GROUP BY q.id, q.qualification_title, q.qualification_code, q.nqf_level, r.academic_year, t.id
  ) s;
$$;
GRANT EXECUTE ON FUNCTION public.my_statement_of_results() TO authenticated;
