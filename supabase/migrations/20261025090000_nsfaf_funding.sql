-- Phase 4: NSFAF student funding administration (Loan Officer).
-- The VTC does not issue loans: trainees are funded by the Namibia Students Financial Assistance Fund (NSFAF) and the
-- Loan Officer administers the relationship between trainee, VTC, NSFAF and Finance. Nothing here approves funding or
-- creates a debt owed to the VTC. Application, eligibility, award, payment and registration status are separate fields.
-- Clients can only read these tables; every change goes through the functions below, which check the caller's role at
-- the record's centre. Awards are recorded only as externally confirmed decisions (reference, source and a document),
-- payments are reconciled by Finance (never by the officer who recorded them), and the event log is append-only.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.funding_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id),
  academic_year text NOT NULL,
  intake text,
  funding_category text NOT NULL DEFAULT 'nsfaf_tuition' CHECK (funding_category IN ('nsfaf_tuition','nsfaf_non_tuition_loan','nsfaf_other','other_sponsor','self_funded')),
  nsfaf_reference text,
  application_status text NOT NULL DEFAULT 'not_applied' CHECK (application_status IN
    ('not_applied','in_progress','submitted','pending_decision','more_information','funding_not_confirmed','withdrawn')),
  submission_date date,
  eligibility_status text NOT NULL DEFAULT 'not_assessed' CHECK (eligibility_status IN ('not_assessed','eligible','conditional','not_eligible')),
  last_nsfaf_response text, last_nsfaf_response_at date,
  award_status text NOT NULL DEFAULT 'none' CHECK (award_status IN ('none','confirmed','rejected')),
  award_decision_date date, award_source text, awarded_amount numeric(14,2) CHECK (awarded_amount IS NULL OR awarded_amount >= 0),
  funding_period_start date, funding_period_end date, award_conditions text,
  award_recorded_by uuid, award_recorded_at timestamptz,
  registration_status text NOT NULL DEFAULT 'not_verified' CHECK (registration_status IN ('not_verified','verified','discrepancy')),
  registration_note text, registration_verified_by uuid, registration_verified_at timestamptz,
  next_action text, follow_up_due date, assigned_to uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainee_id, academic_year)
);
-- an NSFAF reference belongs to one record at a centre
CREATE UNIQUE INDEX uq_funding_reference ON public.funding_records (organization_id, lower(nsfaf_reference)) WHERE nsfaf_reference IS NOT NULL;
CREATE INDEX idx_funding_records_org ON public.funding_records (organization_id, academic_year);

CREATE TABLE public.funding_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.funding_records(id),
  doc_type text NOT NULL CHECK (doc_type IN ('application_form','identity_copy','registration_confirmation','award_letter','funding_agreement','payment_evidence','nsfaf_correspondence','other')),
  file_path text NOT NULL, file_name text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','under_review','verified','requires_correction')),
  note text, verified_by uuid, verified_at timestamptz,
  uploaded_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_funding_documents_record ON public.funding_documents (record_id);

CREATE TABLE public.funding_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.funding_records(id),
  payment_type text NOT NULL DEFAULT 'tuition' CHECK (payment_type IN ('tuition','non_tuition','other')),
  funding_period text,
  expected_amount numeric(14,2) CHECK (expected_amount IS NULL OR expected_amount >= 0),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  transaction_reference text,
  recipient text NOT NULL DEFAULT 'institution' CHECK (recipient IN ('institution','trainee','other')),
  recipient_note text,
  reconciliation_status text NOT NULL DEFAULT 'payment_recorded' CHECK (reconciliation_status IN ('payment_recorded','pending_finance','reconciled','discrepancy','follow_up')),
  finance_note text, reconciled_by uuid, reconciled_at timestamptz,
  recorded_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_funding_payment_ref ON public.funding_payments (organization_id, lower(transaction_reference)) WHERE transaction_reference IS NOT NULL;
CREATE INDEX idx_funding_payments_record ON public.funding_payments (record_id);

CREATE TABLE public.funding_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.funding_records(id),
  kind text NOT NULL CHECK (kind IN ('nsfaf_followup','document_chase','enquiry','appeal','discrepancy','other')),
  description text NOT NULL,
  due_date date NOT NULL,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution_note text, resolved_by uuid, resolved_at timestamptz,
  created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_funding_followups_record ON public.funding_followups (record_id, status);

-- the audit trail: one row per significant change, with before/after values (never identity numbers)
CREATE TABLE public.funding_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.funding_records(id),
  event_type text NOT NULL,
  summary text NOT NULL,
  details jsonb,
  created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_funding_events_record ON public.funding_events (record_id, created_at DESC);
CREATE INDEX idx_funding_events_org ON public.funding_events (organization_id, created_at DESC);

DO $$
DECLARE t text; expr text := 'NOT (SELECT public.is_centre_scoped_user()) OR (%1$I.organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['funding_records','funding_documents','funding_payments','funding_followups','funding_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Funding staff read" ON public.%I FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, ARRAY[''loan_officer'',''accountant'',''head_of_finance_admin'',''debtor_officer'',''centre_manager'',''organization_admin'',''admin'']))', t);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (' || expr || ') WITH CHECK (' || expr || ')', t, t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.funding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'funding_events' THEN RAISE EXCEPTION 'The funding audit trail cannot be changed'; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Funding records cannot be deleted'; END IF;
  IF TG_TABLE_NAME = 'funding_payments' AND to_jsonb(OLD)->>'reconciliation_status' = 'reconciled' THEN RAISE EXCEPTION 'A reconciled payment cannot be changed'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['funding_records','funding_documents','funding_payments','funding_followups','funding_events'] LOOP
    EXECUTE format('CREATE TRIGGER trg_funding_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.funding_guard()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.funding_read_roles() RETURNS text[] LANGUAGE sql IMMUTABLE AS
$$ SELECT ARRAY['loan_officer','accountant','head_of_finance_admin','debtor_officer','centre_manager','organization_admin','admin'] $$;
CREATE OR REPLACE FUNCTION public.funding_finance_roles() RETURNS text[] LANGUAGE sql IMMUTABLE AS
$$ SELECT ARRAY['accountant','head_of_finance_admin','debtor_officer'] $$;
REVOKE ALL ON FUNCTION public.funding_read_roles(), public.funding_finance_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.funding_read_roles(), public.funding_finance_roles() TO authenticated;

-- loads a record's centre and checks the caller holds one of the roles there
CREATE OR REPLACE FUNCTION public.funding_assert(_record uuid, _roles text[]) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM public.funding_records WHERE id = _record;
  IF _org IS NULL THEN RAISE EXCEPTION 'Funding record not found'; END IF;
  PERFORM public.finance_assert_role(_org, _roles);
  RETURN _org;
END $$;
REVOKE ALL ON FUNCTION public.funding_assert(uuid, text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.funding_log(_record uuid, _org uuid, _type text, _summary text, _details jsonb DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.funding_events (organization_id, record_id, event_type, summary, details) VALUES (_org, _record, _type, _summary, _details)
$$;
REVOKE ALL ON FUNCTION public.funding_log(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- documents every application needs before it can be followed up with NSFAF
CREATE OR REPLACE FUNCTION public.funding_required_docs() RETURNS text[] LANGUAGE sql IMMUTABLE AS
$$ SELECT ARRAY['application_form','identity_copy','registration_confirmation'] $$;
REVOKE ALL ON FUNCTION public.funding_required_docs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.funding_required_docs() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Writes (Loan Officer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_funding_record(_trainee uuid, _year text DEFAULT NULL, _category text DEFAULT 'nsfaf_tuition', _intake text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _y text; _id uuid;
BEGIN
  SELECT organization_id, coalesce(nullif(trim(_year), ''), academic_year) INTO _org, _y FROM public.trainees WHERE id = _trainee;
  IF _org IS NULL THEN RAISE EXCEPTION 'Trainee not found'; END IF;
  PERFORM public.finance_assert_role(_org, ARRAY['loan_officer']);
  IF EXISTS (SELECT 1 FROM public.funding_records WHERE trainee_id = _trainee AND academic_year = _y) THEN
    RAISE EXCEPTION 'This trainee already has a funding record for %', _y;
  END IF;
  INSERT INTO public.funding_records (organization_id, trainee_id, academic_year, funding_category, intake, assigned_to, next_action)
    VALUES (_org, _trainee, _y, _category, nullif(trim(_intake), ''), auth.uid(), 'Confirm whether the trainee has applied to NSFAF') RETURNING id INTO _id;
  PERFORM public.funding_log(_id, _org, 'created', 'Funding record created for ' || _y);
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_funding_record(uuid, text, text, text) TO authenticated;

-- application details: the application and eligibility statuses as reported by NSFAF; never the award
CREATE OR REPLACE FUNCTION public.update_funding_application(
  _id uuid, _reference text DEFAULT NULL, _status text DEFAULT NULL, _submitted_on date DEFAULT NULL, _eligibility text DEFAULT NULL,
  _response text DEFAULT NULL, _response_on date DEFAULT NULL, _category text DEFAULT NULL, _intake text DEFAULT NULL,
  _next_action text DEFAULT NULL, _due date DEFAULT NULL, _assigned uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _old public.funding_records; _new public.funding_records; _before jsonb := '{}'; _after jsonb := '{}';
BEGIN
  _org := public.funding_assert(_id, ARRAY['loan_officer']);
  SELECT * INTO _old FROM public.funding_records WHERE id = _id FOR UPDATE;
  IF _status IS NOT NULL AND _status NOT IN ('not_applied','in_progress','submitted','pending_decision','more_information','funding_not_confirmed','withdrawn') THEN
    RAISE EXCEPTION 'Unknown application status';
  END IF;
  IF _status IN ('submitted','pending_decision') AND coalesce(_submitted_on, _old.submission_date) IS NULL THEN
    RAISE EXCEPTION 'Record the date the application was submitted';
  END IF;
  IF _status IN ('submitted','pending_decision') AND nullif(trim(coalesce(_reference, _old.nsfaf_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Record the NSFAF application reference once the application is submitted';
  END IF;
  IF _reference IS NOT NULL AND trim(_reference) <> '' AND EXISTS (
       SELECT 1 FROM public.funding_records WHERE organization_id = _org AND lower(nsfaf_reference) = lower(trim(_reference)) AND id <> _id) THEN
    RAISE EXCEPTION 'That NSFAF reference is already recorded for another trainee';
  END IF;
  UPDATE public.funding_records SET
    nsfaf_reference = CASE WHEN _reference IS NULL THEN nsfaf_reference ELSE nullif(trim(_reference), '') END,
    application_status = coalesce(_status, application_status),
    submission_date = coalesce(_submitted_on, submission_date),
    eligibility_status = coalesce(_eligibility, eligibility_status),
    last_nsfaf_response = CASE WHEN _response IS NULL THEN last_nsfaf_response ELSE nullif(trim(_response), '') END,
    last_nsfaf_response_at = coalesce(_response_on, last_nsfaf_response_at),
    funding_category = coalesce(_category, funding_category),
    intake = CASE WHEN _intake IS NULL THEN intake ELSE nullif(trim(_intake), '') END,
    next_action = CASE WHEN _next_action IS NULL THEN next_action ELSE nullif(trim(_next_action), '') END,
    follow_up_due = coalesce(_due, follow_up_due),
    assigned_to = coalesce(_assigned, assigned_to)
  WHERE id = _id RETURNING * INTO _new;
  SELECT coalesce(jsonb_object_agg(o.key, o.value), '{}'), coalesce(jsonb_object_agg(n.key, n.value), '{}') INTO _before, _after
    FROM jsonb_each(to_jsonb(_old)) o JOIN jsonb_each(to_jsonb(_new)) n USING (key)
    WHERE o.value IS DISTINCT FROM n.value AND o.key NOT IN ('updated_at');
  IF _after <> '{}' THEN
    PERFORM public.funding_log(_id, _org, 'application_updated', 'Application details updated', jsonb_build_object('before', _before, 'after', _after));
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.update_funding_application(uuid, text, text, date, text, text, date, text, text, text, date, uuid) TO authenticated;

-- an externally confirmed NSFAF decision: needs the NSFAF reference, where the decision came from, and the letter/correspondence on file
CREATE OR REPLACE FUNCTION public.record_nsfaf_decision(
  _id uuid, _decision text, _decision_date date, _source text, _amount numeric DEFAULT NULL, _start date DEFAULT NULL, _end date DEFAULT NULL, _conditions text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _rec public.funding_records;
BEGIN
  _org := public.funding_assert(_id, ARRAY['loan_officer']);
  IF _decision NOT IN ('confirmed','rejected') THEN RAISE EXCEPTION 'Decision must be confirmed or rejected'; END IF;
  SELECT * INTO _rec FROM public.funding_records WHERE id = _id FOR UPDATE;
  IF nullif(trim(coalesce(_rec.nsfaf_reference, '')), '') IS NULL THEN RAISE EXCEPTION 'Record the NSFAF reference before recording an NSFAF decision'; END IF;
  IF nullif(trim(coalesce(_source, '')), '') IS NULL THEN RAISE EXCEPTION 'State where the NSFAF decision came from (letter, email or portal)'; END IF;
  IF _decision_date IS NULL OR _decision_date > current_date THEN RAISE EXCEPTION 'Enter the date NSFAF issued the decision'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.funding_documents WHERE record_id = _id AND doc_type IN ('award_letter','nsfaf_correspondence') AND status <> 'requires_correction') THEN
    RAISE EXCEPTION 'File the NSFAF award letter or correspondence before recording the decision';
  END IF;
  IF _start IS NOT NULL AND _end IS NOT NULL AND _end < _start THEN RAISE EXCEPTION 'The funding period ends before it starts'; END IF;
  UPDATE public.funding_records SET award_status = _decision, award_decision_date = _decision_date, award_source = trim(_source),
    awarded_amount = CASE WHEN _decision = 'confirmed' THEN _amount END,
    funding_period_start = CASE WHEN _decision = 'confirmed' THEN _start END, funding_period_end = CASE WHEN _decision = 'confirmed' THEN _end END,
    award_conditions = CASE WHEN _decision = 'confirmed' THEN nullif(trim(coalesce(_conditions, '')), '') END,
    award_recorded_by = auth.uid(), award_recorded_at = now(),
    application_status = CASE WHEN _decision = 'rejected' THEN 'funding_not_confirmed' ELSE application_status END
  WHERE id = _id;
  PERFORM public.funding_log(_id, _org, 'award_recorded', 'NSFAF decision recorded: ' || _decision,
    jsonb_build_object('before', jsonb_build_object('award_status', _rec.award_status, 'awarded_amount', _rec.awarded_amount),
                       'after', jsonb_build_object('award_status', _decision, 'awarded_amount', _amount, 'source', _source, 'decision_date', _decision_date)));
END $$;
GRANT EXECUTE ON FUNCTION public.record_nsfaf_decision(uuid, text, date, text, numeric, date, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_funding_document(_id uuid, _type text, _path text, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _doc uuid;
BEGIN
  _org := public.funding_assert(_id, ARRAY['loan_officer']);
  IF _path NOT LIKE _org::text || '/%' THEN RAISE EXCEPTION 'Document must be stored under the centre''s folder'; END IF;
  INSERT INTO public.funding_documents (organization_id, record_id, doc_type, file_path, file_name) VALUES (_org, _id, _type, _path, _name) RETURNING id INTO _doc;
  PERFORM public.funding_log(_id, _org, 'document_received', 'Document received: ' || _name, jsonb_build_object('doc_type', _type));
  RETURN _doc;
END $$;
GRANT EXECUTE ON FUNCTION public.add_funding_document(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_funding_document_status(_doc uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.funding_documents; _org uuid;
BEGIN
  SELECT * INTO _d FROM public.funding_documents WHERE id = _doc;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'Document not found'; END IF;
  _org := public.funding_assert(_d.record_id, ARRAY['loan_officer']);
  IF _status NOT IN ('received','under_review','verified','requires_correction') THEN RAISE EXCEPTION 'Unknown document status'; END IF;
  IF _status = 'requires_correction' AND nullif(trim(coalesce(_note, '')), '') IS NULL THEN RAISE EXCEPTION 'Say what needs to be corrected'; END IF;
  UPDATE public.funding_documents SET status = _status, note = coalesce(nullif(trim(coalesce(_note, '')), ''), note),
    verified_by = CASE WHEN _status = 'verified' THEN auth.uid() END, verified_at = CASE WHEN _status = 'verified' THEN now() END WHERE id = _doc;
  PERFORM public.funding_log(_d.record_id, _org, 'document_' || _status, 'Document ' || replace(_status, '_', ' ') || ': ' || _d.file_name,
    jsonb_build_object('doc_type', _d.doc_type, 'before', _d.status, 'after', _status));
END $$;
GRANT EXECUTE ON FUNCTION public.set_funding_document_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_funding_registration(_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _old text;
BEGIN
  _org := public.funding_assert(_id, ARRAY['loan_officer']);
  IF _status NOT IN ('not_verified','verified','discrepancy') THEN RAISE EXCEPTION 'Unknown registration status'; END IF;
  IF _status = 'discrepancy' AND nullif(trim(coalesce(_note, '')), '') IS NULL THEN RAISE EXCEPTION 'Describe the discrepancy'; END IF;
  SELECT registration_status INTO _old FROM public.funding_records WHERE id = _id;
  UPDATE public.funding_records SET registration_status = _status, registration_note = nullif(trim(coalesce(_note, '')), ''),
    registration_verified_by = CASE WHEN _status = 'verified' THEN auth.uid() END, registration_verified_at = CASE WHEN _status = 'verified' THEN now() END WHERE id = _id;
  PERFORM public.funding_log(_id, _org, 'registration_' || _status, 'Registration ' || replace(_status, '_', ' '),
    jsonb_build_object('before', _old, 'after', _status));
END $$;
GRANT EXECUTE ON FUNCTION public.set_funding_registration(uuid, text, text) TO authenticated;

-- correspondence, enquiries, contacts and notes
CREATE OR REPLACE FUNCTION public.add_funding_note(_id uuid, _type text, _summary text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  _org := public.funding_assert(_id, ARRAY['loan_officer']);
  IF _type NOT IN ('note','nsfaf_correspondence','trainee_communication','progression_note','contact') THEN RAISE EXCEPTION 'Unknown note type'; END IF;
  IF nullif(trim(coalesce(_summary, '')), '') IS NULL THEN RAISE EXCEPTION 'Write the note'; END IF;
  PERFORM public.funding_log(_id, _org, _type, trim(_summary));
  UPDATE public.funding_records SET updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.add_funding_note(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_funding_followup(_id uuid, _kind text, _description text, _due date, _assigned uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _fid uuid;
BEGIN
  _org := public.funding_assert(_id, ARRAY['loan_officer']);
  IF nullif(trim(coalesce(_description, '')), '') IS NULL OR _due IS NULL THEN RAISE EXCEPTION 'Describe the follow-up and give a due date'; END IF;
  INSERT INTO public.funding_followups (organization_id, record_id, kind, description, due_date, assigned_to) VALUES (_org, _id, _kind, trim(_description), _due, coalesce(_assigned, auth.uid())) RETURNING id INTO _fid;
  PERFORM public.funding_log(_id, _org, 'followup_added', 'Follow-up added: ' || trim(_description), jsonb_build_object('kind', _kind, 'due', _due));
  RETURN _fid;
END $$;
GRANT EXECUTE ON FUNCTION public.add_funding_followup(uuid, text, text, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_funding_followup(_fid uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f public.funding_followups; _org uuid;
BEGIN
  SELECT * INTO _f FROM public.funding_followups WHERE id = _fid;
  IF _f.id IS NULL THEN RAISE EXCEPTION 'Follow-up not found'; END IF;
  _org := public.funding_assert(_f.record_id, ARRAY['loan_officer']);
  IF _f.status = 'resolved' THEN RAISE EXCEPTION 'This follow-up is already resolved'; END IF;
  IF nullif(trim(coalesce(_note, '')), '') IS NULL THEN RAISE EXCEPTION 'Add a resolution note'; END IF;
  UPDATE public.funding_followups SET status = 'resolved', resolution_note = trim(_note), resolved_by = auth.uid(), resolved_at = now() WHERE id = _fid;
  PERFORM public.funding_log(_f.record_id, _org, 'followup_resolved', 'Follow-up resolved: ' || _f.description, jsonb_build_object('resolution', trim(_note)));
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_funding_followup(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Payments: recorded by the Loan Officer, reconciled by Finance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_funding_payment(
  _id uuid, _amount numeric, _date date, _reference text, _recipient text DEFAULT 'institution', _recipient_note text DEFAULT NULL,
  _period text DEFAULT NULL, _expected numeric DEFAULT NULL, _type text DEFAULT 'tuition')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _pid uuid; _award text;
BEGIN
  _org := public.funding_assert(_id, ARRAY['loan_officer']);
  SELECT award_status INTO _award FROM public.funding_records WHERE id = _id;
  IF _award <> 'confirmed' THEN RAISE EXCEPTION 'Payments can only be recorded against a confirmed NSFAF award'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'The amount must be greater than zero'; END IF;
  IF _date IS NULL OR _date > current_date THEN RAISE EXCEPTION 'Enter the date the payment was received'; END IF;
  IF nullif(trim(coalesce(_reference, '')), '') IS NULL THEN RAISE EXCEPTION 'Enter the transaction reference'; END IF;
  IF EXISTS (SELECT 1 FROM public.funding_payments WHERE organization_id = _org AND lower(transaction_reference) = lower(trim(_reference))) THEN
    RAISE EXCEPTION 'That transaction reference is already recorded';
  END IF;
  INSERT INTO public.funding_payments (organization_id, record_id, payment_type, funding_period, expected_amount, amount, payment_date, transaction_reference, recipient, recipient_note)
    VALUES (_org, _id, _type, nullif(trim(coalesce(_period, '')), ''), _expected, _amount, _date, trim(_reference), _recipient, nullif(trim(coalesce(_recipient_note, '')), '')) RETURNING id INTO _pid;
  PERFORM public.funding_log(_id, _org, 'payment_recorded', 'Funding payment recorded', jsonb_build_object('amount', _amount, 'reference', trim(_reference), 'recipient', _recipient));
  RETURN _pid;
END $$;
GRANT EXECUTE ON FUNCTION public.record_funding_payment(uuid, numeric, date, text, text, text, text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_payment_to_finance(_pid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.funding_payments; _org uuid;
BEGIN
  SELECT * INTO _p FROM public.funding_payments WHERE id = _pid;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  _org := public.funding_assert(_p.record_id, ARRAY['loan_officer']);
  IF _p.reconciliation_status NOT IN ('payment_recorded','discrepancy','follow_up') THEN RAISE EXCEPTION 'This payment is not waiting to be sent to Finance'; END IF;
  UPDATE public.funding_payments SET reconciliation_status = 'pending_finance' WHERE id = _pid;
  PERFORM public.funding_log(_p.record_id, _org, 'payment_sent_to_finance', 'Payment sent to Finance for verification', jsonb_build_object('reference', _p.transaction_reference));
END $$;
GRANT EXECUTE ON FUNCTION public.send_payment_to_finance(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_funding_payment(_pid uuid, _outcome text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.funding_payments; _org uuid;
BEGIN
  SELECT * INTO _p FROM public.funding_payments WHERE id = _pid;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  _org := public.funding_assert(_p.record_id, public.funding_finance_roles());
  IF _p.recorded_by = auth.uid() THEN RAISE EXCEPTION 'The person who recorded a payment cannot reconcile it'; END IF;
  IF _p.reconciliation_status <> 'pending_finance' THEN RAISE EXCEPTION 'Only payments sent to Finance can be reconciled'; END IF;
  IF _outcome NOT IN ('reconciled','discrepancy','follow_up') THEN RAISE EXCEPTION 'Unknown reconciliation outcome'; END IF;
  IF _outcome <> 'reconciled' AND nullif(trim(coalesce(_note, '')), '') IS NULL THEN RAISE EXCEPTION 'Explain the discrepancy or the follow-up needed'; END IF;
  UPDATE public.funding_payments SET reconciliation_status = _outcome, finance_note = nullif(trim(coalesce(_note, '')), ''),
    reconciled_by = CASE WHEN _outcome = 'reconciled' THEN auth.uid() END, reconciled_at = CASE WHEN _outcome = 'reconciled' THEN now() END WHERE id = _pid;
  PERFORM public.funding_log(_p.record_id, _org, 'payment_' || _outcome, 'Finance marked the payment ' || replace(_outcome, '_', ' '), jsonb_build_object('reference', _p.transaction_reference));
END $$;
GRANT EXECUTE ON FUNCTION public.reconcile_funding_payment(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reads
-- ---------------------------------------------------------------------------
-- Every case with its separate statuses and the reasons it needs attention, for the centres the caller may read.
CREATE OR REPLACE FUNCTION public.funding_cases_base(_year text DEFAULT NULL)
RETURNS TABLE (
  id uuid, organization_id uuid, trainee_uuid uuid, trainee_number text, trainee_name text, programme text, qualification text, level integer,
  intake text, academic_year text, funding_category text, nsfaf_reference text, application_status text, eligibility_status text, award_status text,
  registration_status text, payment_status text, overall_status text, updated_at timestamptz, next_action text, follow_up_due date, assigned_to uuid,
  missing_documents text[], attention text[], open_followups integer, overdue_followups integer, awarded_amount numeric, amount_paid numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.organization_id, t.id, t.trainee_id, t.first_name || ' ' || t.last_name, tr.name, q.qualification_title, t.level,
    r.intake, r.academic_year, r.funding_category, r.nsfaf_reference, r.application_status, r.eligibility_status, r.award_status,
    r.registration_status, p.status, 
    CASE WHEN r.award_status = 'confirmed' THEN 'award_confirmed' WHEN r.award_status = 'rejected' THEN 'rejected' ELSE r.application_status END,
    r.updated_at, r.next_action, r.follow_up_due, r.assigned_to, x.missing, x.reasons, f.open_count, f.overdue_count, r.awarded_amount, p.paid
  FROM public.funding_records r
  JOIN public.trainees t ON t.id = r.trainee_id
  LEFT JOIN public.trades tr ON tr.id = t.trade_id
  LEFT JOIN public.qualifications q ON q.id = t.qualification_id
  CROSS JOIN LATERAL (
    SELECT coalesce(array_agg(DISTINCT d.doc_type) FILTER (WHERE d.status = 'verified'), '{}') AS verified_types,
           bool_or(d.doc_type IN ('award_letter','funding_agreement')) AS has_award_doc
    FROM public.funding_documents d WHERE d.record_id = r.id) d
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS n, coalesce(sum(pp.amount) FILTER (WHERE pp.reconciliation_status = 'reconciled'), 0) AS paid,
      CASE WHEN r.award_status <> 'confirmed' THEN 'not_applicable'
           WHEN count(*) = 0 THEN 'awaiting_payment_info'
           WHEN bool_or(pp.reconciliation_status = 'discrepancy') THEN 'discrepancy'
           WHEN bool_or(pp.reconciliation_status = 'follow_up') THEN 'follow_up'
           WHEN bool_or(pp.reconciliation_status = 'pending_finance') THEN 'pending_finance'
           WHEN bool_or(pp.reconciliation_status = 'payment_recorded') THEN 'payment_recorded'
           ELSE 'reconciled' END AS status
    FROM public.funding_payments pp WHERE pp.record_id = r.id) p
  CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE ff.status = 'open')::int AS open_count,
           count(*) FILTER (WHERE ff.status = 'open' AND ff.due_date < current_date)::int AS overdue_count,
           count(*) FILTER (WHERE ff.status = 'open' AND ff.due_date BETWEEN current_date AND current_date + 3)::int AS soon_count,
           count(*) FILTER (WHERE ff.status = 'open' AND ff.kind = 'enquiry')::int AS enquiries
    FROM public.funding_followups ff WHERE ff.record_id = r.id) f
  CROSS JOIN LATERAL (
    SELECT CASE WHEN r.application_status IN ('in_progress','submitted','pending_decision','more_information')
                THEN ARRAY(SELECT u FROM unnest(public.funding_required_docs()) u WHERE NOT (u = ANY (d.verified_types))) ELSE '{}'::text[] END AS missing,
           array_remove(ARRAY[
             CASE WHEN r.application_status IN ('in_progress','submitted','pending_decision','more_information')
                       AND EXISTS (SELECT 1 FROM unnest(public.funding_required_docs()) u WHERE NOT (u = ANY (d.verified_types))) THEN 'documents_missing' END,
             CASE WHEN r.application_status <> 'withdrawn' AND r.application_status <> 'not_applied' AND r.registration_status = 'not_verified' THEN 'registration_not_verified' END,
             CASE WHEN r.registration_status = 'discrepancy' THEN 'progression_discrepancy' END,
             CASE WHEN r.application_status IN ('submitted','pending_decision') AND coalesce(r.last_nsfaf_response_at, r.submission_date) < current_date - 30 THEN 'no_nsfaf_response' END,
             CASE WHEN r.award_status = 'confirmed' AND NOT coalesce(d.has_award_doc, false) THEN 'award_not_filed' END,
             CASE WHEN p.status IN ('pending_finance','discrepancy','follow_up') THEN 'payment_awaiting_reconciliation' END,
             CASE WHEN p.status = 'awaiting_payment_info' AND r.award_decision_date < current_date - 30 THEN 'payment_info_outstanding' END,
             CASE WHEN f.enquiries > 0 THEN 'enquiry_open' END,
             CASE WHEN f.overdue_count > 0 OR r.follow_up_due < current_date THEN 'followup_overdue'
                  WHEN f.soon_count > 0 OR r.follow_up_due <= current_date + 3 THEN 'followup_due_soon' END
           ], NULL) AS reasons) x
  WHERE (_year IS NULL OR r.academic_year = _year)
    AND public.has_org_role(auth.uid(), r.organization_id, public.funding_read_roles())
$$;
REVOKE ALL ON FUNCTION public.funding_cases_base(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.funding_cases_base(text) TO authenticated; -- rows are already limited to the caller's centres and roles

CREATE OR REPLACE FUNCTION public.funding_register(
  _year text DEFAULT NULL, _search text DEFAULT NULL, _filters jsonb DEFAULT '{}', _sort text DEFAULT 'updated_at', _dir text DEFAULT 'desc',
  _limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _col text; _res jsonb; _s text := '%' || lower(trim(coalesce(_search, ''))) || '%';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorised'; END IF;
  _col := CASE _sort WHEN 'trainee_number' THEN 'trainee_number' WHEN 'trainee_name' THEN 'trainee_name' WHEN 'programme' THEN 'programme'
                     WHEN 'application_status' THEN 'application_status' WHEN 'award_status' THEN 'award_status' ELSE 'updated_at' END;
  EXECUTE format($q$
    WITH c AS (
      SELECT * FROM public.funding_cases_base($1) c
      WHERE ($2 = '%%%%' OR lower(c.trainee_number || ' ' || c.trainee_name || ' ' || coalesce(c.programme, '') || ' ' || coalesce(c.intake, '') || ' ' || coalesce(c.nsfaf_reference, '')) LIKE $2)
        AND ($3->>'programme' IS NULL OR c.programme = $3->>'programme')
        AND ($3->>'level' IS NULL OR c.level::text = $3->>'level')
        AND ($3->>'intake' IS NULL OR c.intake = $3->>'intake')
        AND ($3->>'category' IS NULL OR c.funding_category = $3->>'category')
        AND ($3->>'application_status' IS NULL OR c.application_status = $3->>'application_status')
        AND ($3->>'award_status' IS NULL OR c.award_status = $3->>'award_status')
        AND ($3->>'registration_status' IS NULL OR c.registration_status = $3->>'registration_status')
        AND ($3->>'payment_status' IS NULL OR c.payment_status = $3->>'payment_status')
        AND ($3->>'overall' IS NULL OR c.overall_status = $3->>'overall')
        AND ($3->>'reason' IS NULL OR $3->>'reason' = ANY (c.attention))
        AND (coalesce(($3->>'attention')::boolean, false) = false OR cardinality(c.attention) > 0)
        AND (coalesce(($3->>'overdue')::boolean, false) = false OR 'followup_overdue' = ANY (c.attention))
    )
    SELECT jsonb_build_object('total', (SELECT count(*) FROM c), 'rows', coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (
      SELECT * FROM c ORDER BY %I %s NULLS LAST, id LIMIT $4 OFFSET $5) p), '[]'::jsonb))$q$,
    _col, CASE WHEN lower(_dir) = 'asc' THEN 'ASC' ELSE 'DESC' END)
  INTO _res USING _year, _s, coalesce(_filters, '{}'), greatest(1, least(coalesce(_limit, 20), 5000)), greatest(0, coalesce(_offset, 0));
  RETURN _res;
END $$;
GRANT EXECUTE ON FUNCTION public.funding_register(text, text, jsonb, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.funding_overview(_year text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _prev text; _out jsonb; _tracked int; _total_trainees int; _prev_tracked int; _prev_confirmed int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorised'; END IF;
  _prev := CASE WHEN _year ~ '^\d{4}' THEN regexp_replace(_year, '^\d{4}', (substring(_year from '^\d{4}')::int - 1)::text) END;
  SELECT count(*) INTO _tracked FROM public.funding_cases_base(_year);
  SELECT count(*) INTO _total_trainees FROM public.trainees t
    WHERE (_year IS NULL OR t.academic_year = _year) AND t.status::text NOT IN ('archived','withdrawn','dropped_out')
      AND public.has_org_role(auth.uid(), t.organization_id, public.funding_read_roles());
  IF _prev IS NOT NULL THEN
    SELECT count(*), count(*) FILTER (WHERE award_status = 'confirmed') INTO _prev_tracked, _prev_confirmed FROM public.funding_cases_base(_prev);
  END IF;
  SELECT jsonb_build_object(
    'tracked', _tracked,
    'trainees_total', _total_trainees,
    'pending_applications', (SELECT count(*) FROM public.funding_cases_base(_year) WHERE application_status IN ('in_progress','submitted','pending_decision','more_information') AND award_status = 'none'),
    'needs_attention', (SELECT count(*) FROM public.funding_cases_base(_year) WHERE cardinality(attention) > 0),
    'confirmed', (SELECT count(*) FROM public.funding_cases_base(_year) WHERE award_status = 'confirmed'),
    'awaiting_reconciliation', (SELECT count(*) FROM public.funding_payments p JOIN public.funding_records r ON r.id = p.record_id
        WHERE (_year IS NULL OR r.academic_year = _year) AND p.reconciliation_status IN ('pending_finance','discrepancy','follow_up')
          AND public.has_org_role(auth.uid(), p.organization_id, public.funding_read_roles())),
    'open_followups', (SELECT count(*) FROM public.funding_followups f JOIN public.funding_records r ON r.id = f.record_id
        WHERE (_year IS NULL OR r.academic_year = _year) AND f.status = 'open' AND public.has_org_role(auth.uid(), f.organization_id, public.funding_read_roles())),
    'overdue_followups', (SELECT count(*) FROM public.funding_followups f JOIN public.funding_records r ON r.id = f.record_id
        WHERE (_year IS NULL OR r.academic_year = _year) AND f.status = 'open' AND f.due_date < current_date AND public.has_org_role(auth.uid(), f.organization_id, public.funding_read_roles())),
    'distribution', coalesce((SELECT jsonb_object_agg(overall_status, n) FROM (SELECT overall_status, count(*) n FROM public.funding_cases_base(_year) GROUP BY 1) s), '{}'::jsonb),
    'previous', CASE WHEN _prev IS NULL THEN NULL ELSE jsonb_build_object('year', _prev, 'tracked', _prev_tracked, 'confirmed', _prev_confirmed) END
  ) INTO _out;
  RETURN _out;
END $$;
GRANT EXECUTE ON FUNCTION public.funding_overview(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.funding_filter_options(_year text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'years', coalesce((SELECT jsonb_agg(DISTINCT t.academic_year ORDER BY t.academic_year DESC) FROM public.trainees t WHERE public.has_org_role(auth.uid(), t.organization_id, public.funding_read_roles())), '[]'::jsonb),
    'programmes', coalesce((SELECT jsonb_agg(DISTINCT programme ORDER BY programme) FROM public.funding_cases_base(_year) WHERE programme IS NOT NULL), '[]'::jsonb),
    'levels', coalesce((SELECT jsonb_agg(DISTINCT level ORDER BY level) FROM public.funding_cases_base(_year) WHERE level IS NOT NULL), '[]'::jsonb),
    'intakes', coalesce((SELECT jsonb_agg(DISTINCT intake ORDER BY intake) FROM public.funding_cases_base(_year) WHERE intake IS NOT NULL), '[]'::jsonb))
$$;
GRANT EXECUTE ON FUNCTION public.funding_filter_options(text) TO authenticated;

-- the whole picture for one trainee's funding record
CREATE OR REPLACE FUNCTION public.funding_record_detail(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _out jsonb; _contact boolean;
BEGIN
  _org := public.funding_assert(_id, public.funding_read_roles());
  _contact := public.has_org_role(auth.uid(), _org, ARRAY['loan_officer','centre_manager','head_of_finance_admin','organization_admin','admin']);
  SELECT jsonb_build_object(
    'case', (SELECT to_jsonb(c) FROM public.funding_cases_base(NULL) c WHERE c.id = _id),
    'record', (SELECT to_jsonb(r) FROM public.funding_records r WHERE r.id = _id),
    'trainee', (SELECT jsonb_build_object('status', t.status, 'level', t.level, 'training_mode', t.training_mode, 'academic_year', t.academic_year,
                  'phone', CASE WHEN _contact THEN t.phone END, 'email', CASE WHEN _contact THEN t.email END)
                FROM public.funding_records r JOIN public.trainees t ON t.id = r.trainee_id WHERE r.id = _id),
    'documents', coalesce((SELECT jsonb_agg(to_jsonb(d) || jsonb_build_object('verified_by_name', pv.full_name) ORDER BY d.created_at DESC)
                           FROM public.funding_documents d LEFT JOIN public.profiles pv ON pv.user_id = d.verified_by WHERE d.record_id = _id), '[]'::jsonb),
    'payments', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.payment_date DESC) FROM public.funding_payments p WHERE p.record_id = _id), '[]'::jsonb),
    'followups', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY (f.status = 'open') DESC, f.due_date) FROM public.funding_followups f WHERE f.record_id = _id), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) || jsonb_build_object('actor', pe.full_name) ORDER BY e.created_at DESC)
                        FROM public.funding_events e LEFT JOIN public.profiles pe ON pe.user_id = e.created_by WHERE e.record_id = _id), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $$;
GRANT EXECUTE ON FUNCTION public.funding_record_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.funding_recent_activity(_year text DEFAULT NULL, _limit integer DEFAULT 15)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM (
    SELECT e.id, e.record_id, e.event_type, e.summary, e.created_at, pe.full_name AS actor, t.trainee_id AS trainee_number, t.first_name || ' ' || t.last_name AS trainee_name
    FROM public.funding_events e
    JOIN public.funding_records r ON r.id = e.record_id
    JOIN public.trainees t ON t.id = r.trainee_id
    LEFT JOIN public.profiles pe ON pe.user_id = e.created_by
    WHERE (_year IS NULL OR r.academic_year = _year) AND public.has_org_role(auth.uid(), e.organization_id, public.funding_read_roles())
    ORDER BY e.created_at DESC LIMIT greatest(1, least(coalesce(_limit, 15), 200))) a
$$;
GRANT EXECUTE ON FUNCTION public.funding_recent_activity(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.funding_followup_list(_year text DEFAULT NULL, _status text DEFAULT 'open', _kind text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM (
    SELECT f.id, f.record_id, f.kind, f.description, f.due_date, f.status, f.resolution_note, f.resolved_at, f.created_at,
           t.trainee_id AS trainee_number, t.first_name || ' ' || t.last_name AS trainee_name, pa.full_name AS assigned_name
    FROM public.funding_followups f
    JOIN public.funding_records r ON r.id = f.record_id
    JOIN public.trainees t ON t.id = r.trainee_id
    LEFT JOIN public.profiles pa ON pa.user_id = f.assigned_to
    WHERE (_year IS NULL OR r.academic_year = _year) AND (_status IS NULL OR f.status = _status) AND (_kind IS NULL OR f.kind = _kind)
      AND public.has_org_role(auth.uid(), f.organization_id, public.funding_read_roles())
    ORDER BY f.due_date LIMIT 500) a
$$;
GRANT EXECUTE ON FUNCTION public.funding_followup_list(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.funding_payment_list(_year text DEFAULT NULL, _status text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM (
    SELECT p.id, p.record_id, p.payment_type, p.funding_period, p.expected_amount, p.amount, p.payment_date, p.transaction_reference, p.recipient, p.recipient_note,
           p.reconciliation_status, p.finance_note, p.reconciled_at, p.recorded_by, r.funding_category, r.academic_year,
           t.trainee_id AS trainee_number, t.first_name || ' ' || t.last_name AS trainee_name
    FROM public.funding_payments p
    JOIN public.funding_records r ON r.id = p.record_id
    JOIN public.trainees t ON t.id = r.trainee_id
    WHERE (_year IS NULL OR r.academic_year = _year) AND (_status IS NULL OR p.reconciliation_status = _status)
      AND public.has_org_role(auth.uid(), p.organization_id, public.funding_read_roles())
    ORDER BY p.payment_date DESC LIMIT 1000) a
$$;
GRANT EXECUTE ON FUNCTION public.funding_payment_list(text, text) TO authenticated;

-- funded versus unfunded by programme (trainees with no funding record are shown as unrecorded, never assumed unfunded)
CREATE OR REPLACE FUNCTION public.funding_coverage(_year text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.programme, a.level), '[]'::jsonb) FROM (
    SELECT tr.name AS programme, t.level,
           count(*)::int AS trainees,
           count(r.id)::int AS with_record,
           count(*) FILTER (WHERE r.award_status = 'confirmed')::int AS funded,
           count(*) FILTER (WHERE r.id IS NULL)::int AS no_record
    FROM public.trainees t
    LEFT JOIN public.trades tr ON tr.id = t.trade_id
    LEFT JOIN public.funding_records r ON r.trainee_id = t.id AND r.academic_year = t.academic_year
    WHERE (_year IS NULL OR t.academic_year = _year) AND t.status::text NOT IN ('archived','withdrawn','dropped_out')
      AND public.has_org_role(auth.uid(), t.organization_id, public.funding_read_roles())
    GROUP BY tr.name, t.level) a
$$;
GRANT EXECUTE ON FUNCTION public.funding_coverage(text) TO authenticated;

-- trainee lookup for the global search and for starting a funding record
CREATE OR REPLACE FUNCTION public.funding_search(_q text, _year text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM (
    SELECT t.id AS trainee_uuid, t.trainee_id AS trainee_number, t.first_name || ' ' || t.last_name AS trainee_name, tr.name AS programme, t.level, t.academic_year,
           r.id AS record_id, r.nsfaf_reference, r.academic_year AS record_year
    FROM public.trainees t
    LEFT JOIN public.trades tr ON tr.id = t.trade_id
    LEFT JOIN public.funding_records r ON r.trainee_id = t.id AND r.academic_year = coalesce(_year, t.academic_year)
    WHERE length(trim(coalesce(_q, ''))) >= 2
      AND public.has_org_role(auth.uid(), t.organization_id, public.funding_read_roles())
      AND lower(t.trainee_id || ' ' || t.first_name || ' ' || t.last_name || ' ' || coalesce(tr.name, '') || ' ' || coalesce(r.intake, '') || ' ' || coalesce(r.nsfaf_reference, ''))
          LIKE '%' || lower(trim(_q)) || '%'
    ORDER BY t.last_name, t.first_name LIMIT 15) a
$$;
GRANT EXECUTE ON FUNCTION public.funding_search(text, text) TO authenticated;
