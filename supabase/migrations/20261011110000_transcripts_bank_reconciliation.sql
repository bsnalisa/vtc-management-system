-- Formal transcript (credits and average mark) and bank-statement reconciliation.

-- ---------------------------------------------------------------------------
-- Transcript. Only approved results are included.
--   * final mark of a component = average of its CA and SA marks (whichever exist)
--   * credits of a qualification = sum of the credit values of its unit standards; they count as completed only when
--     every approved component of that qualification and year has passed (results are not stored per unit standard)
--   * average mark = mean of the final marks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transcript_data(_trainee uuid, _academic_year text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trainees%ROWTYPE; _out jsonb;
BEGIN
  SELECT * INTO t FROM public.trainees WHERE id = _trainee;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainee not found'; END IF;
  IF NOT (t.user_id = auth.uid() OR public.has_org_role(auth.uid(), t.organization_id, ARRAY['admin','organization_admin','registration_officer','head_of_training','assessment_coordinator'])) THEN
    RAISE EXCEPTION 'Trainee not found';
  END IF;

  SELECT jsonb_build_object(
    'trainee_number', t.trainee_id, 'first_name', t.first_name, 'last_name', t.last_name, 'national_id', t.national_id,
    'organization', (SELECT o.name FROM public.organizations o WHERE o.id = t.organization_id),
    'blocks', COALESCE(jsonb_agg(b ORDER BY b->>'academic_year', b->>'qualification'), '[]'::jsonb),
    'total_credits', COALESCE(sum((b->>'credits')::int), 0),
    'completed_credits', COALESCE(sum((b->>'completed_credits')::int), 0),
    'average_mark', round(avg(NULLIF(b->>'average_mark', '')::numeric), 1)
  ) INTO _out
  FROM (
    SELECT jsonb_build_object(
      'qualification', q.qualification_title, 'qualification_code', q.qualification_code, 'nqf_level', q.nqf_level,
      'academic_year', r.academic_year,
      'credits', COALESCE((SELECT sum(qus.credit_value) FROM public.qualification_unit_standards qus WHERE qus.qualification_id = q.id), 0),
      'completed_credits', CASE WHEN bool_and(r.result_status IN ('pass','competent'))
                                THEN COALESCE((SELECT sum(qus.credit_value) FROM public.qualification_unit_standards qus WHERE qus.qualification_id = q.id), 0) ELSE 0 END,
      'average_mark', round(avg(CASE WHEN r.ca_mark IS NOT NULL AND r.sa_mark IS NOT NULL THEN (r.ca_mark + r.sa_mark) / 2
                                     ELSE COALESCE(r.ca_mark, r.sa_mark) END), 1)::text,
      'components', jsonb_agg(jsonb_build_object(
        'component', c.component_name, 'ca_mark', r.ca_mark, 'sa_mark', r.sa_mark,
        'final_mark', round(CASE WHEN r.ca_mark IS NOT NULL AND r.sa_mark IS NOT NULL THEN (r.ca_mark + r.sa_mark) / 2
                                 ELSE COALESCE(r.ca_mark, r.sa_mark) END, 1),
        'pass_mark', r.pass_mark, 'status', r.result_status) ORDER BY c.sequence_order, c.component_name)) AS b
    FROM public.qualification_results r
    JOIN public.qualifications q ON q.id = r.qualification_id
    JOIN public.assessment_template_components c ON c.id = r.template_component_id
    WHERE r.trainee_id = t.id AND r.approved_at IS NOT NULL AND (_academic_year IS NULL OR r.academic_year = _academic_year)
    GROUP BY q.id, q.qualification_title, q.qualification_code, q.nqf_level, r.academic_year
  ) s;
  RETURN _out;
END $$;
GRANT EXECUTE ON FUNCTION public.transcript_data(uuid, text) TO authenticated;

-- Staff record an issued transcript (number, credits) so the same document can be reprinted and verified later.
CREATE OR REPLACE FUNCTION public.issue_transcript(_trainee uuid, _academic_year text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trainees%ROWTYPE; d jsonb; _no text; _tries integer := 0; _row public.transcripts%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.trainees WHERE id = _trainee;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainee not found'; END IF;
  IF NOT public.has_org_role(auth.uid(), t.organization_id, ARRAY['admin','organization_admin','registration_officer','head_of_training']) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  d := public.transcript_data(_trainee, _academic_year);
  IF jsonb_array_length(d->'blocks') = 0 THEN RAISE EXCEPTION 'There are no approved results for % to put on a transcript', _academic_year; END IF;

  SELECT * INTO _row FROM public.transcripts WHERE trainee_id = _trainee AND academic_year = _academic_year ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    UPDATE public.transcripts SET total_credits = (d->>'total_credits')::int, completed_credits = (d->>'completed_credits')::int,
           issue_date = CURRENT_DATE WHERE id = _row.id RETURNING * INTO _row;
  ELSE
    LOOP
      _no := 'TR-' || to_char(now(), 'YY') || '-' || lpad(floor(random() * 100000)::int::text, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.transcripts WHERE organization_id = t.organization_id AND transcript_number = _no);
      _tries := _tries + 1;
      IF _tries > 100 THEN RAISE EXCEPTION 'Could not allocate a transcript number'; END IF;
    END LOOP;
    INSERT INTO public.transcripts (organization_id, trainee_id, transcript_number, academic_year, total_credits, completed_credits, status, generated_by)
    VALUES (t.organization_id, t.id, _no, _academic_year, (d->>'total_credits')::int, (d->>'completed_credits')::int, 'issued', auth.uid())
    RETURNING * INTO _row;
  END IF;
  RETURN d || jsonb_build_object('transcript_number', _row.transcript_number, 'issue_date', _row.issue_date);
END $$;
GRANT EXECUTE ON FUNCTION public.issue_transcript(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Bank statement reconciliation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_finance_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['admin','organization_admin','debtor_officer']);
$$;

CREATE TABLE public.bank_statement_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  bank_name text,
  line_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  imported_by uuid DEFAULT auth.uid(),
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bank_statement_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  txn_date date NOT NULL,
  description text,
  reference text,
  amount numeric(12,2) NOT NULL,
  line_hash text NOT NULL,
  status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','applied','ignored')),
  matched_trainee_id uuid REFERENCES public.trainees(id) ON DELETE SET NULL,
  matched_fee_record_id uuid REFERENCES public.fee_records(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  handled_by uuid,
  handled_at timestamptz,
  UNIQUE (organization_id, line_hash)
);
CREATE INDEX idx_bank_lines_import ON public.bank_statement_lines (import_id, status);
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff view bank imports" ON public.bank_statement_imports FOR SELECT USING (public.is_finance_staff(auth.uid(), organization_id));
CREATE POLICY "Finance staff view bank lines" ON public.bank_statement_lines FOR SELECT USING (public.is_finance_staff(auth.uid(), organization_id));

-- Which trainee number is mentioned in a bank reference? Compared without spaces, dashes or case.
CREATE OR REPLACE FUNCTION public.bank_match_line(_line uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.bank_statement_lines%ROWTYPE; _norm text; _t uuid; _n integer; _fee uuid; _fees integer;
BEGIN
  SELECT * INTO l FROM public.bank_statement_lines WHERE id = _line;
  IF NOT FOUND OR l.status NOT IN ('unmatched','matched') OR l.amount <= 0 THEN RETURN; END IF;
  _norm := regexp_replace(lower(COALESCE(l.reference, '') || ' ' || COALESCE(l.description, '')), '[^a-z0-9]', '', 'g');
  SELECT count(*), min(t.id::text)::uuid INTO _n, _t
  FROM public.trainees t
  WHERE t.organization_id = l.organization_id AND length(regexp_replace(lower(t.trainee_id), '[^a-z0-9]', '', 'g')) >= 7
    AND position(regexp_replace(lower(t.trainee_id), '[^a-z0-9]', '', 'g') IN _norm) > 0;
  IF _n <> 1 THEN
    UPDATE public.bank_statement_lines SET status = 'unmatched', matched_trainee_id = NULL, matched_fee_record_id = NULL WHERE id = l.id;
    RETURN;
  END IF;
  SELECT count(*), min(f.id::text)::uuid INTO _fees, _fee FROM public.fee_records f WHERE f.trainee_id = _t AND f.balance > 0;
  UPDATE public.bank_statement_lines SET matched_trainee_id = _t,
         matched_fee_record_id = CASE WHEN _fees = 1 THEN _fee ELSE NULL END,
         status = CASE WHEN _fees = 1 THEN 'matched' ELSE 'unmatched' END
   WHERE id = l.id;
END $$;
REVOKE ALL ON FUNCTION public.bank_match_line(uuid) FROM PUBLIC, anon, authenticated;

-- _lines: [{ date: 'YYYY-MM-DD', description, reference, amount }]. Identical lines already imported are skipped.
CREATE OR REPLACE FUNCTION public.bank_import_lines(_file_name text, _bank text, _lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _imp uuid; e jsonb; _h text; _new integer := 0; _dup integer := 0; _id uuid; _amt numeric; _d date;
BEGIN
  IF _org IS NULL OR NOT public.is_finance_staff(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'The statement has no lines'; END IF;
  IF jsonb_array_length(_lines) > 5000 THEN RAISE EXCEPTION 'Import at most 5000 lines at a time'; END IF;

  INSERT INTO public.bank_statement_imports (organization_id, file_name, bank_name) VALUES (_org, left(COALESCE(_file_name, 'statement'), 200), left(_bank, 100)) RETURNING id INTO _imp;
  FOR e IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    BEGIN
      _d := (e->>'date')::date; _amt := round((e->>'amount')::numeric, 2);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'A line has a date or amount that cannot be read: %', left(e::text, 120);
    END;
    _h := md5(_org::text || '|' || _d || '|' || _amt || '|' || lower(COALESCE(e->>'reference', '')) || '|' || lower(COALESCE(e->>'description', '')));
    -- the same text twice in one statement is two separate payments, so number repeats
    _h := _h || '-' || (SELECT count(*) FROM public.bank_statement_lines x WHERE x.import_id = _imp AND x.line_hash LIKE _h || '%');
    IF EXISTS (SELECT 1 FROM public.bank_statement_lines x WHERE x.organization_id = _org AND x.line_hash = _h AND x.import_id <> _imp) THEN
      _dup := _dup + 1; CONTINUE;
    END IF;
    INSERT INTO public.bank_statement_lines (import_id, organization_id, txn_date, description, reference, amount, line_hash)
    VALUES (_imp, _org, _d, left(e->>'description', 500), left(e->>'reference', 200), _amt, _h) RETURNING id INTO _id;
    PERFORM public.bank_match_line(_id);
    _new := _new + 1;
  END LOOP;
  UPDATE public.bank_statement_imports SET line_count = _new, duplicate_count = _dup WHERE id = _imp;
  RETURN jsonb_build_object('import_id', _imp, 'imported', _new, 'duplicates', _dup,
    'matched', (SELECT count(*) FROM public.bank_statement_lines WHERE import_id = _imp AND status = 'matched'));
END $$;
GRANT EXECUTE ON FUNCTION public.bank_import_lines(text, text, jsonb) TO authenticated;

-- Record the payment against a fee record and update its balance in one step.
CREATE OR REPLACE FUNCTION public.bank_apply_line(_line uuid, _fee_record uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.bank_statement_lines%ROWTYPE; f public.fee_records%ROWTYPE; _fid uuid; _pay uuid;
BEGIN
  SELECT * INTO l FROM public.bank_statement_lines WHERE id = _line FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF NOT public.is_finance_staff(auth.uid(), l.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF l.status IN ('applied','ignored') THEN RAISE EXCEPTION 'This line has already been %', l.status; END IF;
  IF l.amount <= 0 THEN RAISE EXCEPTION 'Only money received can be applied to a fee record'; END IF;
  _fid := COALESCE(_fee_record, l.matched_fee_record_id);
  IF _fid IS NULL THEN RAISE EXCEPTION 'Choose the fee record this payment belongs to'; END IF;
  SELECT * INTO f FROM public.fee_records WHERE id = _fid FOR UPDATE;
  IF NOT FOUND OR f.organization_id IS DISTINCT FROM l.organization_id THEN RAISE EXCEPTION 'Fee record not found'; END IF;
  IF l.amount > f.balance THEN RAISE EXCEPTION 'The payment (%) is more than the balance owing (%)', l.amount, f.balance; END IF;

  INSERT INTO public.payments (fee_record_id, amount, payment_date, payment_method, reference_number, notes, recorded_by)
  VALUES (f.id, l.amount, l.txn_date, 'bank_transfer', left(COALESCE(l.reference, ''), 100), 'Bank statement import', auth.uid()) RETURNING id INTO _pay;
  UPDATE public.fee_records SET amount_paid = amount_paid + l.amount, updated_at = now() WHERE id = f.id;
  UPDATE public.bank_statement_lines SET status = 'applied', payment_id = _pay, matched_fee_record_id = f.id, matched_trainee_id = f.trainee_id,
         handled_by = auth.uid(), handled_at = now() WHERE id = l.id;
  RETURN _pay;
END $$;
GRANT EXECUTE ON FUNCTION public.bank_apply_line(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bank_set_line_status(_line uuid, _ignore boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.bank_statement_lines%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.bank_statement_lines WHERE id = _line FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF NOT public.is_finance_staff(auth.uid(), l.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF l.status = 'applied' THEN RAISE EXCEPTION 'An applied line cannot be changed'; END IF;
  IF _ignore THEN
    UPDATE public.bank_statement_lines SET status = 'ignored', handled_by = auth.uid(), handled_at = now() WHERE id = l.id;
  ELSE
    UPDATE public.bank_statement_lines SET status = 'unmatched', handled_by = NULL, handled_at = NULL WHERE id = l.id;
    PERFORM public.bank_match_line(l.id);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.bank_set_line_status(uuid, boolean) TO authenticated;
