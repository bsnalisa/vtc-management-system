-- Phase 4: loans (Loan Officer). Built on the approval workflow (process type 'loan_request').
--  application -> documents verified -> eligibility assessed -> recommendation (approval) -> disbursement request (approval)
--  -> disbursement recorded (a separate step, never by the approver) -> repayment schedule, repayments, arrears
--  -> restructure / interest waiver / write-off requests (approval, then applied by the officer).
-- Clients can only read these tables; every change is made by the functions below, which check the caller's role.
-- Repayments, finalised applications and loans are never edited or deleted.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.loan_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_interest_rate numeric(6,3) NOT NULL DEFAULT 12 CHECK (default_interest_rate >= 0),
  max_term_months integer NOT NULL DEFAULT 36 CHECK (max_term_months > 0),
  min_amount numeric(14,2) NOT NULL DEFAULT 500 CHECK (min_amount > 0),
  max_amount numeric(14,2) NOT NULL DEFAULT 50000 CHECK (max_amount > 0),
  max_installment_ratio numeric(4,3) NOT NULL DEFAULT 0.400 CHECK (max_installment_ratio > 0 AND max_installment_ratio <= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.loan_borrowers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  borrower_type text NOT NULL DEFAULT 'other' CHECK (borrower_type IN ('trainee','staff','other')),
  trainee_id uuid,
  full_name text NOT NULL,
  national_id text NOT NULL,
  phone text, email text, address text, employer text,
  monthly_income numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_income >= 0),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, national_id)
);
CREATE TABLE public.loan_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_number text NOT NULL,
  borrower_id uuid NOT NULL REFERENCES public.loan_borrowers(id),
  purpose text NOT NULL,
  amount_requested numeric(14,2) NOT NULL CHECK (amount_requested > 0),
  term_months integer NOT NULL CHECK (term_months > 0),
  interest_rate numeric(6,3) NOT NULL CHECK (interest_rate >= 0),
  existing_obligations numeric(14,2) NOT NULL DEFAULT 0 CHECK (existing_obligations >= 0),
  installment numeric(14,2),
  assessment text CHECK (assessment IN ('eligible','not_eligible')),
  assessment_notes text, assessed_by uuid, assessed_at timestamptz,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN
    ('registered','assessed','declined','recommended','approved','rejected','disbursement_requested','disbursement_approved','active','closed','written_off')),
  workflow_instance_id uuid REFERENCES public.workflow_instances(id),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, application_number)
);
CREATE TABLE public.loan_application_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.loan_applications(id),
  doc_type text NOT NULL CHECK (doc_type IN ('identity','proof_of_income','bank_statement','guarantor','other')),
  file_path text NOT NULL, file_name text NOT NULL,
  verified boolean NOT NULL DEFAULT false, verified_by uuid, verified_at timestamptz,
  created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.loans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_number text NOT NULL,
  application_id uuid NOT NULL UNIQUE REFERENCES public.loan_applications(id),
  borrower_id uuid NOT NULL REFERENCES public.loan_borrowers(id),
  principal numeric(14,2) NOT NULL CHECK (principal > 0),
  interest_rate numeric(6,3) NOT NULL,
  term_months integer NOT NULL,
  installment numeric(14,2) NOT NULL,
  disbursed_on date NOT NULL, disbursement_reference text, disbursed_by uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','written_off')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, loan_number)
);
CREATE TABLE public.loan_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id),
  installment_no integer NOT NULL,
  due_date date NOT NULL,
  interest_due numeric(14,2) NOT NULL, principal_due numeric(14,2) NOT NULL,
  amount_due numeric(14,2) NOT NULL,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0, amount_adjusted numeric(14,2) NOT NULL DEFAULT 0,
  superseded boolean NOT NULL DEFAULT false,
  UNIQUE (loan_id, installment_no)
);
CREATE TABLE public.loan_repayments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL, reference text,
  recorded_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.loan_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id),
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('restructure','interest_waiver','write_off')),
  amount numeric(14,2) CHECK (amount IS NULL OR amount > 0),
  new_term_months integer CHECK (new_term_months IS NULL OR new_term_months > 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','applied')),
  requested_by uuid DEFAULT auth.uid(),
  workflow_instance_id uuid REFERENCES public.workflow_instances(id),
  applied_by uuid, applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loan_applications_org ON public.loan_applications (organization_id, status);
CREATE INDEX idx_loan_schedule_loan ON public.loan_schedule (loan_id, due_date);
CREATE INDEX idx_loan_repayments_loan ON public.loan_repayments (loan_id);

DO $$
DECLARE t text; expr text := 'NOT (SELECT public.is_centre_scoped_user()) OR (%1$I.organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['loan_settings','loan_borrowers','loan_applications','loan_application_documents','loans','loan_schedule','loan_repayments','loan_adjustments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Loan staff read" ON public.%I FOR SELECT TO authenticated USING (public.has_org_role(auth.uid(), organization_id, ARRAY[''loan_officer'',''accountant'',''head_of_finance_admin'',''centre_manager'',''organization_admin'',''admin'']))', t);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (' || expr || ') WITH CHECK (' || expr || ')', t, t, t);
  END LOOP;
END $$;
CREATE POLICY "Finance heads manage loan settings" ON public.loan_settings FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['head_of_finance_admin','organization_admin']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['head_of_finance_admin','organization_admin']));

CREATE OR REPLACE FUNCTION public.loan_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Loan records cannot be deleted'; END IF;
  IF TG_TABLE_NAME = 'loan_repayments' THEN RAISE EXCEPTION 'A recorded repayment cannot be changed'; END IF;
  IF TG_TABLE_NAME = 'loan_application_documents' AND OLD.verified AND NOT NEW.verified AND OLD.file_path = NEW.file_path THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'loan_applications' AND OLD.status IN ('closed','written_off','declined','rejected') AND NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'rejected' AND NEW.status = 'assessed') THEN
    RAISE EXCEPTION 'A finished application cannot be changed';
  END IF;
  RETURN NEW;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['loan_borrowers','loan_applications','loan_application_documents','loans','loan_schedule','loan_repayments','loan_adjustments'] LOOP
    EXECUTE format('CREATE TRIGGER trg_loan_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.loan_guard()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.loan_installment(_principal numeric, _annual_rate numeric, _months integer)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _months <= 0 THEN 0
              WHEN _annual_rate = 0 THEN round(_principal / _months, 2)
              ELSE round(_principal * (_annual_rate / 1200) / (1 - power(1 + _annual_rate / 1200, -_months)), 2) END;
$$;

CREATE OR REPLACE FUNCTION public.loan_settings_for(_org uuid)
RETURNS public.loan_settings LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT s FROM public.loan_settings s WHERE s.organization_id = _org), ROW(_org, 12, 36, 500, 50000, 0.400, now())::public.loan_settings);
$$;
REVOKE ALL ON FUNCTION public.loan_settings_for(uuid) FROM PUBLIC, anon, authenticated;

-- Writes a reducing-balance schedule for _principal starting the month after _from
CREATE OR REPLACE FUNCTION public.loan_build_schedule(_loan uuid, _org uuid, _principal numeric, _rate numeric, _months integer, _from date, _first_no integer)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inst numeric := public.loan_installment(_principal, _rate, _months); _bal numeric := _principal; _int numeric; _pri numeric; i integer;
BEGIN
  FOR i IN 1.._months LOOP
    _int := round(_bal * _rate / 1200, 2);
    _pri := CASE WHEN i = _months THEN _bal ELSE _inst - _int END;
    INSERT INTO public.loan_schedule (organization_id, loan_id, installment_no, due_date, interest_due, principal_due, amount_due)
    VALUES (_org, _loan, _first_no + i - 1, (_from + make_interval(months => i))::date, _int, _pri, _int + _pri);
    _bal := _bal - _pri;
  END LOOP;
  RETURN _inst;
END $$;
REVOKE ALL ON FUNCTION public.loan_build_schedule(uuid, uuid, numeric, numeric, integer, date, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.loan_outstanding(_loan uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(s.amount_due - s.amount_paid - s.amount_adjusted), 0) FROM public.loan_schedule s JOIN public.loans l ON l.id = s.loan_id
  WHERE s.loan_id = _loan AND NOT s.superseded
    AND public.has_org_role(auth.uid(), l.organization_id, ARRAY['loan_officer','accountant','head_of_finance_admin','centre_manager','organization_admin','admin']);
$$;
GRANT EXECUTE ON FUNCTION public.loan_outstanding(uuid) TO authenticated;

-- Copies the application's documents to a workflow draft so the approver sees them
CREATE OR REPLACE FUNCTION public.loan_attach_documents(_application uuid, _instance uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.workflow_attachments (instance_id, file_path, file_name, uploaded_by)
  SELECT _instance, d.file_path, d.doc_type || ': ' || d.file_name, auth.uid() FROM public.loan_application_documents d WHERE d.application_id = _application;
$$;
REVOKE ALL ON FUNCTION public.loan_attach_documents(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Application, documents, assessment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_loan_borrower(_type text, _trainee uuid, _name text, _national_id text, _phone text, _email text, _address text, _employer text, _income numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _id uuid;
BEGIN
  PERFORM public.finance_assert_role(_org, ARRAY['loan_officer']);
  IF COALESCE(trim(_name), '') = '' OR COALESCE(trim(_national_id), '') = '' THEN RAISE EXCEPTION 'Enter the borrower''s name and ID number'; END IF;
  INSERT INTO public.loan_borrowers (organization_id, borrower_type, trainee_id, full_name, national_id, phone, email, address, employer, monthly_income)
  VALUES (_org, COALESCE(_type, 'other'), _trainee, trim(_name), trim(_national_id), _phone, _email, _address, _employer, COALESCE(_income, 0)) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'A borrower with this ID number is already registered';
END $$;
GRANT EXECUTE ON FUNCTION public.register_loan_borrower(text, uuid, text, text, text, text, text, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_loan_borrower_income(_id uuid, _income numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.loan_borrowers%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.loan_borrowers WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Borrower not found'; END IF;
  PERFORM public.finance_assert_role(b.organization_id, ARRAY['loan_officer']);
  UPDATE public.loan_borrowers SET monthly_income = COALESCE(_income, 0), updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.update_loan_borrower_income(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_loan_application(_borrower uuid, _purpose text, _amount numeric, _term integer, _rate numeric DEFAULT NULL, _obligations numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.loan_borrowers%ROWTYPE; s public.loan_settings; _id uuid;
BEGIN
  SELECT * INTO b FROM public.loan_borrowers WHERE id = _borrower;
  IF NOT FOUND THEN RAISE EXCEPTION 'Borrower not found'; END IF;
  PERFORM public.finance_assert_role(b.organization_id, ARRAY['loan_officer']);
  s := public.loan_settings_for(b.organization_id);
  IF COALESCE(trim(_purpose), '') = '' THEN RAISE EXCEPTION 'State the purpose of the loan'; END IF;
  IF _amount < s.min_amount OR _amount > s.max_amount THEN RAISE EXCEPTION 'The amount must be between N$ % and N$ %', s.min_amount, s.max_amount; END IF;
  IF _term < 1 OR _term > s.max_term_months THEN RAISE EXCEPTION 'The term must be between 1 and % months', s.max_term_months; END IF;
  INSERT INTO public.loan_applications (organization_id, application_number, borrower_id, purpose, amount_requested, term_months, interest_rate, existing_obligations)
  VALUES (b.organization_id, 'LA-' || to_char(now(), 'YYYY') || '-' || lpad((SELECT count(*) + 1 FROM public.loan_applications WHERE organization_id = b.organization_id)::text, 4, '0'),
          _borrower, trim(_purpose), _amount, _term, COALESCE(_rate, s.default_interest_rate), COALESCE(_obligations, 0)) RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.register_loan_application(uuid, text, numeric, integer, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_loan_document(_application uuid, _type text, _path text, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.loan_applications%ROWTYPE; _id uuid;
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = _application;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  PERFORM public.finance_assert_role(a.organization_id, ARRAY['loan_officer']);
  IF a.status NOT IN ('registered','assessed','rejected') THEN RAISE EXCEPTION 'Documents can only be added before the application goes for approval'; END IF;
  INSERT INTO public.loan_application_documents (organization_id, application_id, doc_type, file_path, file_name)
  VALUES (a.organization_id, _application, _type, _path, _name) RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.add_loan_document(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_loan_document(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.loan_application_documents%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.loan_application_documents WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
  PERFORM public.finance_assert_role(d.organization_id, ARRAY['loan_officer']);
  UPDATE public.loan_application_documents SET verified = true, verified_by = auth.uid(), verified_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.verify_loan_document(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assess_loan_application(_id uuid, _obligations numeric, _notes text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.loan_applications%ROWTYPE; b public.loan_borrowers%ROWTYPE; s public.loan_settings; _inst numeric; _ok boolean; _why text;
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  PERFORM public.finance_assert_role(a.organization_id, ARRAY['loan_officer']);
  IF a.status NOT IN ('registered','assessed','rejected') THEN RAISE EXCEPTION 'This application can no longer be assessed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.loan_application_documents WHERE application_id = _id AND doc_type = 'identity' AND verified)
     OR NOT EXISTS (SELECT 1 FROM public.loan_application_documents WHERE application_id = _id AND doc_type = 'proof_of_income' AND verified) THEN
    RAISE EXCEPTION 'Verify the borrower''s identity document and proof of income before assessing';
  END IF;
  SELECT * INTO b FROM public.loan_borrowers WHERE id = a.borrower_id;
  s := public.loan_settings_for(a.organization_id);
  _inst := public.loan_installment(a.amount_requested, a.interest_rate, a.term_months);
  _ok := _inst <= s.max_installment_ratio * GREATEST(b.monthly_income - COALESCE(_obligations, 0), 0);
  _why := CASE WHEN _ok THEN 'The installment of N$ ' || _inst || ' is within ' || round(s.max_installment_ratio * 100) || '% of the income left after existing obligations.'
               ELSE 'The installment of N$ ' || _inst || ' is above ' || round(s.max_installment_ratio * 100) || '% of the income left after existing obligations.' END;
  UPDATE public.loan_applications SET existing_obligations = COALESCE(_obligations, 0), installment = _inst, assessment = CASE WHEN _ok THEN 'eligible' ELSE 'not_eligible' END,
         assessment_notes = trim(both E' \\n' FROM _why || ' ' || COALESCE(_notes, '')), assessed_by = auth.uid(), assessed_at = now(), status = 'assessed', updated_at = now() WHERE id = _id;
  RETURN CASE WHEN _ok THEN 'eligible' ELSE 'not_eligible' END;
END $$;
GRANT EXECUTE ON FUNCTION public.assess_loan_application(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_loan_application(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.loan_applications%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  PERFORM public.finance_assert_role(a.organization_id, ARRAY['loan_officer']);
  IF a.status NOT IN ('registered','assessed') THEN RAISE EXCEPTION 'Only an application that has not gone for approval can be declined'; END IF;
  IF COALESCE(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Give the reason'; END IF;
  UPDATE public.loan_applications SET status = 'declined', assessment_notes = trim(COALESCE(assessment_notes, '') || ' Declined: ' || trim(_reason)), updated_at = now() WHERE id = _id;
END $$;
GRANT EXECUTE ON FUNCTION public.decline_loan_application(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Approvals: recommendation and disbursement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recommend_loan_application(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.loan_applications%ROWTYPE; b public.loan_borrowers%ROWTYPE; _wf uuid;
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  PERFORM public.finance_assert_role(a.organization_id, ARRAY['loan_officer']);
  IF a.status <> 'assessed' OR a.assessment IS DISTINCT FROM 'eligible' THEN RAISE EXCEPTION 'Only an assessed, eligible application can be recommended'; END IF;
  SELECT * INTO b FROM public.loan_borrowers WHERE id = a.borrower_id;
  _wf := public.finance_new_request(a.organization_id, 'loan_request', 'Loan recommendation ' || a.application_number || ': ' || b.full_name,
    jsonb_build_object('Application', a.application_number, 'Borrower', b.full_name, 'Purpose', a.purpose, 'Amount', 'N$ ' || to_char(a.amount_requested, 'FM999,999,990.00'),
                       'Term', a.term_months || ' months', 'Interest rate', a.interest_rate || '% a year', 'Installment', 'N$ ' || to_char(a.installment, 'FM999,999,990.00'),
                       'Monthly income', 'N$ ' || to_char(b.monthly_income, 'FM999,999,990.00'), 'Assessment', COALESCE(a.assessment_notes, '')),
    a.amount_requested, a.id);
  PERFORM public.loan_attach_documents(a.id, _wf);
  UPDATE public.loan_applications SET status = 'recommended', workflow_instance_id = _wf, updated_at = now() WHERE id = _id;
  RETURN _wf;
END $$;
GRANT EXECUTE ON FUNCTION public.recommend_loan_application(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_loan_disbursement(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.loan_applications%ROWTYPE; b public.loan_borrowers%ROWTYPE; _wf uuid;
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  PERFORM public.finance_assert_role(a.organization_id, ARRAY['loan_officer']);
  IF a.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved loan can be sent for disbursement'; END IF;
  SELECT * INTO b FROM public.loan_borrowers WHERE id = a.borrower_id;
  _wf := public.finance_new_request(a.organization_id, 'loan_request', 'Loan disbursement ' || a.application_number || ': ' || b.full_name,
    jsonb_build_object('Application', a.application_number, 'Borrower', b.full_name, 'Amount to disburse', 'N$ ' || to_char(a.amount_requested, 'FM999,999,990.00'),
                       'Term', a.term_months || ' months', 'Installment', 'N$ ' || to_char(a.installment, 'FM999,999,990.00')),
    a.amount_requested, a.id);
  PERFORM public.loan_attach_documents(a.id, _wf);
  UPDATE public.loan_applications SET status = 'disbursement_requested', workflow_instance_id = _wf, updated_at = now() WHERE id = _id;
  RETURN _wf;
END $$;
GRANT EXECUTE ON FUNCTION public.request_loan_disbursement(uuid) TO authenticated;

-- Disbursement is a separate stage from its approval: the approver cannot also record it
CREATE OR REPLACE FUNCTION public.record_loan_disbursement(_id uuid, _reference text, _on date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.loan_applications%ROWTYPE; _loan uuid := gen_random_uuid(); _inst numeric; _on2 date := COALESCE(_on, current_date);
BEGIN
  SELECT * INTO a FROM public.loan_applications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  PERFORM public.finance_assert_role(a.organization_id, ARRAY['loan_officer','accountant']);
  IF a.status <> 'disbursement_approved' THEN RAISE EXCEPTION 'Only an approved disbursement can be recorded'; END IF;
  IF EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.instance_id = a.workflow_instance_id AND t.acted_by = auth.uid() AND t.status = 'approved') THEN
    RAISE EXCEPTION 'The person who approved a disbursement cannot also record it';
  END IF;
  IF COALESCE(trim(_reference), '') = '' THEN RAISE EXCEPTION 'Enter the payment reference'; END IF;
  _inst := public.loan_installment(a.amount_requested, a.interest_rate, a.term_months);
  INSERT INTO public.loans (id, organization_id, loan_number, application_id, borrower_id, principal, interest_rate, term_months, installment, disbursed_on, disbursement_reference, disbursed_by)
  VALUES (_loan, a.organization_id, 'LN-' || to_char(now(), 'YYYY') || '-' || lpad((SELECT count(*) + 1 FROM public.loans WHERE organization_id = a.organization_id)::text, 4, '0'),
          a.id, a.borrower_id, a.amount_requested, a.interest_rate, a.term_months, _inst, _on2, trim(_reference), auth.uid());
  PERFORM public.loan_build_schedule(_loan, a.organization_id, a.amount_requested, a.interest_rate, a.term_months, _on2, 1);
  UPDATE public.loan_applications SET status = 'active', updated_at = now() WHERE id = _id;
  PERFORM public.workflow_finish_internal(a.workflow_instance_id, auth.uid(), 'Disbursed, reference ' || trim(_reference));
  RETURN _loan;
END $$;
GRANT EXECUTE ON FUNCTION public.record_loan_disbursement(uuid, text, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Repayments (applied to the oldest unpaid installments first)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_loan_repayment(_loan uuid, _amount numeric, _paid_on date DEFAULT current_date, _reference text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.loans%ROWTYPE; r record; _left numeric := _amount; _pay numeric;
BEGIN
  SELECT * INTO l FROM public.loans WHERE id = _loan FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  PERFORM public.finance_assert_role(l.organization_id, ARRAY['loan_officer','accountant']);
  IF l.status <> 'active' THEN RAISE EXCEPTION 'This loan is not active'; END IF;
  IF COALESCE(_amount, 0) <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero'; END IF;
  IF _amount > public.loan_outstanding(_loan) THEN RAISE EXCEPTION 'The payment is more than the outstanding balance of N$ %', public.loan_outstanding(_loan); END IF;
  INSERT INTO public.loan_repayments (organization_id, loan_id, amount, paid_on, reference) VALUES (l.organization_id, _loan, _amount, COALESCE(_paid_on, current_date), _reference);
  FOR r IN SELECT id, amount_due - amount_paid - amount_adjusted AS owed FROM public.loan_schedule
           WHERE loan_id = _loan AND NOT superseded AND amount_due - amount_paid - amount_adjusted > 0 ORDER BY installment_no LOOP
    EXIT WHEN _left <= 0;
    _pay := LEAST(_left, r.owed);
    UPDATE public.loan_schedule SET amount_paid = amount_paid + _pay WHERE id = r.id;
    _left := _left - _pay;
  END LOOP;
  IF public.loan_outstanding(_loan) = 0 THEN
    UPDATE public.loans SET status = 'closed', updated_at = now() WHERE id = _loan;
    UPDATE public.loan_applications SET status = 'closed', updated_at = now() WHERE id = l.application_id;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.record_loan_repayment(uuid, numeric, date, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Restructure, interest waiver, write-off
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_loan_adjustment(_loan uuid, _type text, _amount numeric, _new_term integer, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.loans%ROWTYPE; b public.loan_borrowers%ROWTYPE; _id uuid := gen_random_uuid(); _wf uuid; _out numeric; _unpaid_int numeric; _amt numeric;
BEGIN
  SELECT * INTO l FROM public.loans WHERE id = _loan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  PERFORM public.finance_assert_role(l.organization_id, ARRAY['loan_officer']);
  IF l.status <> 'active' THEN RAISE EXCEPTION 'This loan is not active'; END IF;
  IF _type NOT IN ('restructure','interest_waiver','write_off') THEN RAISE EXCEPTION 'Unknown adjustment type'; END IF;
  IF COALESCE(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Give the reason'; END IF;
  IF EXISTS (SELECT 1 FROM public.loan_adjustments WHERE loan_id = _loan AND status IN ('requested','approved')) THEN RAISE EXCEPTION 'Another adjustment on this loan is still in progress'; END IF;
  _out := public.loan_outstanding(_loan);
  SELECT COALESCE(sum(GREATEST(interest_due - amount_paid - amount_adjusted, 0)), 0) INTO _unpaid_int FROM public.loan_schedule WHERE loan_id = _loan AND NOT superseded;
  IF _type = 'restructure' THEN
    IF COALESCE(_new_term, 0) < 1 THEN RAISE EXCEPTION 'Enter the new term in months'; END IF;
    _amt := _out;
  ELSIF _type = 'interest_waiver' THEN
    IF COALESCE(_amount, 0) <= 0 OR _amount > _unpaid_int THEN RAISE EXCEPTION 'The waiver must be above zero and no more than the unpaid interest of N$ %', _unpaid_int; END IF;
    _amt := _amount;
  ELSE
    IF COALESCE(_amount, 0) <= 0 OR _amount > _out THEN RAISE EXCEPTION 'The write-off must be above zero and no more than the outstanding balance of N$ %', _out; END IF;
    _amt := _amount;
  END IF;
  SELECT * INTO b FROM public.loan_borrowers WHERE id = l.borrower_id;
  _wf := public.finance_new_request(l.organization_id, 'loan_request', initcap(replace(_type, '_', ' ')) || ' for loan ' || l.loan_number || ': ' || b.full_name,
    jsonb_build_object('Loan', l.loan_number, 'Borrower', b.full_name, 'Type', initcap(replace(_type, '_', ' ')), 'Amount', 'N$ ' || to_char(_amt, 'FM999,999,990.00'),
                       'Outstanding now', 'N$ ' || to_char(_out, 'FM999,999,990.00'), 'New term', COALESCE(_new_term::text || ' months', ''), 'Reason', trim(_reason)),
    _amt, _id);
  INSERT INTO public.loan_adjustments (id, organization_id, loan_id, adjustment_type, amount, new_term_months, reason, workflow_instance_id)
  VALUES (_id, l.organization_id, _loan, _type, CASE WHEN _type = 'restructure' THEN NULL ELSE _amount END, CASE WHEN _type = 'restructure' THEN _new_term END, trim(_reason), _wf);
  RETURN _wf;
END $$;
GRANT EXECUTE ON FUNCTION public.request_loan_adjustment(uuid, text, numeric, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_loan_adjustment(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE x public.loan_adjustments%ROWTYPE; l public.loans%ROWTYPE; r record; _left numeric; _take numeric; _P numeric; _first integer;
BEGIN
  SELECT * INTO x FROM public.loan_adjustments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Adjustment not found'; END IF;
  PERFORM public.finance_assert_role(x.organization_id, ARRAY['loan_officer']);
  IF x.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved adjustment can be applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.instance_id = x.workflow_instance_id AND t.acted_by = auth.uid() AND t.status = 'approved') THEN
    RAISE EXCEPTION 'The person who approved an adjustment cannot also apply it';
  END IF;
  SELECT * INTO l FROM public.loans WHERE id = x.loan_id FOR UPDATE;
  IF x.adjustment_type = 'restructure' THEN
    -- principal still owed: what each unpaid row owes after payments and adjustments went to interest first
    SELECT COALESCE(sum(principal_due - GREATEST(amount_paid + amount_adjusted - interest_due, 0)), 0) INTO _P FROM public.loan_schedule WHERE loan_id = l.id AND NOT superseded;
    IF _P <= 0 THEN RAISE EXCEPTION 'Nothing is left to restructure'; END IF;
    SELECT COALESCE(max(installment_no), 0) + 1 INTO _first FROM public.loan_schedule WHERE loan_id = l.id;
    UPDATE public.loan_schedule SET superseded = true WHERE loan_id = l.id AND NOT superseded AND amount_due - amount_paid - amount_adjusted > 0;
    PERFORM public.loan_build_schedule(l.id, l.organization_id, _P, l.interest_rate, x.new_term_months, current_date, _first);
    UPDATE public.loans SET term_months = x.new_term_months, installment = public.loan_installment(_P, l.interest_rate, x.new_term_months), updated_at = now() WHERE id = l.id;
  ELSE
    _left := x.amount;
    FOR r IN SELECT id, amount_due - amount_paid - amount_adjusted AS owed, GREATEST(interest_due - amount_paid - amount_adjusted, 0) AS owed_interest FROM public.loan_schedule
             WHERE loan_id = l.id AND NOT superseded AND amount_due - amount_paid - amount_adjusted > 0 ORDER BY installment_no LOOP
      EXIT WHEN _left <= 0;
      _take := LEAST(_left, CASE WHEN x.adjustment_type = 'interest_waiver' THEN r.owed_interest ELSE r.owed END);
      IF _take > 0 THEN UPDATE public.loan_schedule SET amount_adjusted = amount_adjusted + _take WHERE id = r.id; _left := _left - _take; END IF;
    END LOOP;
    IF _left > 0 THEN RAISE EXCEPTION 'The balance has changed since approval; request a new adjustment'; END IF;
    IF public.loan_outstanding(l.id) = 0 THEN
      UPDATE public.loans SET status = CASE WHEN x.adjustment_type = 'write_off' THEN 'written_off' ELSE 'closed' END, updated_at = now() WHERE id = l.id;
      UPDATE public.loan_applications SET status = CASE WHEN x.adjustment_type = 'write_off' THEN 'written_off' ELSE 'closed' END, updated_at = now() WHERE id = l.application_id;
    END IF;
  END IF;
  UPDATE public.loan_adjustments SET status = 'applied', applied_by = auth.uid(), applied_at = now(), updated_at = now() WHERE id = _id;
  PERFORM public.workflow_finish_internal(x.workflow_instance_id, auth.uid(), 'Applied to the loan');
END $$;
GRANT EXECUTE ON FUNCTION public.apply_loan_adjustment(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Outcomes of loan approvals are written back to the records
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workflow_apply_result(_instance uuid, _outcome text, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.workflow_instances%ROWTYPE; _status text;
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
      DELETE FROM public.debtor_adjustments WHERE id = i.subject_id AND status = 'requested' AND workflow_instance_id = i.id;
    ELSE
      UPDATE public.debtor_adjustments SET status = _outcome, updated_at = now() WHERE id = i.subject_id AND status = 'requested';
    END IF;
  ELSIF i.process_type = 'asset_request' AND i.subject_id IS NOT NULL THEN
    IF _outcome = 'cancelled' THEN
      DELETE FROM public.asset_requests WHERE id = i.subject_id AND status = 'requested' AND workflow_instance_id = i.id;
    ELSE
      UPDATE public.asset_requests SET status = _outcome, updated_at = now() WHERE id = i.subject_id AND status = 'requested';
    END IF;
  ELSIF i.process_type = 'loan_request' AND i.subject_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.loan_applications WHERE id = i.subject_id) THEN
      SELECT status INTO _status FROM public.loan_applications WHERE id = i.subject_id;
      IF _status = 'recommended' THEN
        UPDATE public.loan_applications SET status = CASE _outcome WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'assessed' END, updated_at = now() WHERE id = i.subject_id;
      ELSIF _status = 'disbursement_requested' THEN
        UPDATE public.loan_applications SET status = CASE _outcome WHEN 'approved' THEN 'disbursement_approved' ELSE 'approved' END, updated_at = now() WHERE id = i.subject_id;
      END IF;
    ELSIF EXISTS (SELECT 1 FROM public.loan_adjustments WHERE id = i.subject_id) THEN
      IF _outcome = 'cancelled' THEN
        DELETE FROM public.loan_adjustments WHERE id = i.subject_id AND status = 'requested';
      ELSE
        UPDATE public.loan_adjustments SET status = _outcome, updated_at = now() WHERE id = i.subject_id AND status = 'requested';
      END IF;
    END IF;
  END IF;
  PERFORM set_config('app.workflow_apply', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.workflow_apply_result(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- loan_guard allows removing a cancelled adjustment request, nothing else
CREATE OR REPLACE FUNCTION public.loan_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'loan_adjustments' AND current_setting('app.workflow_apply', true) = 'on' AND to_jsonb(OLD)->>'status' = 'requested' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Loan records cannot be deleted';
  END IF;
  IF TG_TABLE_NAME = 'loan_repayments' THEN RAISE EXCEPTION 'A recorded repayment cannot be changed'; END IF;
  IF TG_TABLE_NAME = 'loan_applications' AND to_jsonb(OLD)->>'status' IN ('closed','written_off','declined') AND to_jsonb(NEW)->>'status' IS DISTINCT FROM to_jsonb(OLD)->>'status' THEN
    RAISE EXCEPTION 'A finished application cannot be changed';
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Dashboard figures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.loan_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _res jsonb;
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['loan_officer','accountant','head_of_finance_admin','centre_manager','organization_admin','admin']) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT jsonb_build_object(
    'applications', jsonb_build_object(
      'registered', (SELECT count(*) FROM public.loan_applications WHERE organization_id = _org AND status = 'registered'),
      'assessed', (SELECT count(*) FROM public.loan_applications WHERE organization_id = _org AND status = 'assessed'),
      'with_approver', (SELECT count(*) FROM public.loan_applications WHERE organization_id = _org AND status IN ('recommended','disbursement_requested')),
      'approved', (SELECT count(*) FROM public.loan_applications WHERE organization_id = _org AND status = 'approved'),
      'ready_to_disburse', (SELECT count(*) FROM public.loan_applications WHERE organization_id = _org AND status = 'disbursement_approved'),
      'adjustments_open', (SELECT count(*) FROM public.loan_adjustments WHERE organization_id = _org AND status IN ('requested','approved'))),
    'portfolio', jsonb_build_object(
      'active_loans', (SELECT count(*) FROM public.loans WHERE organization_id = _org AND status = 'active'),
      'disbursed_total', COALESCE((SELECT sum(principal) FROM public.loans WHERE organization_id = _org), 0),
      'outstanding', COALESCE((SELECT sum(s.amount_due - s.amount_paid - s.amount_adjusted) FROM public.loan_schedule s JOIN public.loans l ON l.id = s.loan_id WHERE l.organization_id = _org AND l.status = 'active' AND NOT s.superseded), 0),
      'collected_30d', COALESCE((SELECT sum(amount) FROM public.loan_repayments WHERE organization_id = _org AND paid_on > current_date - 30), 0),
      'due_7d', COALESCE((SELECT sum(s.amount_due - s.amount_paid - s.amount_adjusted) FROM public.loan_schedule s JOIN public.loans l ON l.id = s.loan_id WHERE l.organization_id = _org AND l.status = 'active' AND NOT s.superseded AND s.due_date BETWEEN current_date AND current_date + 7), 0)),
    'arrears', jsonb_build_object(
      'loans', (SELECT count(DISTINCT s.loan_id) FROM public.loan_schedule s JOIN public.loans l ON l.id = s.loan_id WHERE l.organization_id = _org AND l.status = 'active' AND NOT s.superseded AND s.due_date < current_date AND s.amount_due - s.amount_paid - s.amount_adjusted > 0),
      'amount', COALESCE((SELECT sum(s.amount_due - s.amount_paid - s.amount_adjusted) FROM public.loan_schedule s JOIN public.loans l ON l.id = s.loan_id WHERE l.organization_id = _org AND l.status = 'active' AND NOT s.superseded AND s.due_date < current_date AND s.amount_due - s.amount_paid - s.amount_adjusted > 0), 0))
  ) INTO _res;
  RETURN _res;
END $$;
GRANT EXECUTE ON FUNCTION public.loan_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.loan_arrears()
RETURNS TABLE (loan_id uuid, loan_number text, borrower text, phone text, days_overdue integer, installments_overdue integer, amount_overdue numeric, outstanding numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['loan_officer','accountant','head_of_finance_admin','centre_manager','organization_admin','admin']) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
  SELECT l.id, l.loan_number, b.full_name, b.phone,
         (current_date - min(s.due_date))::integer, count(*)::integer, sum(s.amount_due - s.amount_paid - s.amount_adjusted), public.loan_outstanding(l.id)
  FROM public.loan_schedule s JOIN public.loans l ON l.id = s.loan_id JOIN public.loan_borrowers b ON b.id = l.borrower_id
  WHERE l.organization_id = _org AND l.status = 'active' AND NOT s.superseded AND s.due_date < current_date AND s.amount_due - s.amount_paid - s.amount_adjusted > 0
  GROUP BY l.id, l.loan_number, b.full_name, b.phone
  ORDER BY min(s.due_date);
END $$;
GRANT EXECUTE ON FUNCTION public.loan_arrears() TO authenticated;
