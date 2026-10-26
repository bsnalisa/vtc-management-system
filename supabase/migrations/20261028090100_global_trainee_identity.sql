-- Global trainee identity, permanent trainee numbers and VTC transfers.
--
--  * trainee_identities is the one registry of people. Every trainees row (a person's registration at one VTC) belongs to
--    exactly one identity and carries that identity's permanent number in trainees.trainee_id (enforced by trigger).
--  * New numbers are YYYYRRRRR: the first-registration year and five cryptographically random digits. Uniqueness is enforced
--    by the database (number ledger primary key + identity unique key); collisions retry a bounded number of times.
--    Numbers are never reissued: the ledger keeps every number ever issued, including legacy aliases and merged identities.
--  * A person has at most one active (or deferred) registration across all VTCs, enforced by a partial unique index and a
--    trigger. Moving between VTCs happens only through trainee_transfers: the trainee asks, the Head of Training and then a
--    different Head of Trainee Support approve, and a backend function executes it transactionally.
--  * Existing trainees keep their current numbers (flagged 'legacy'); the migration report is stored in
--    identity_migration_report. Possible duplicates are queued for review, never merged automatically.

-- ---------------------------------------------------------------------------
-- 1. Registry, ledger, review queue and audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE public.trainee_identities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainee_number text NOT NULL,
  number_format text NOT NULL CHECK (number_format IN ('global9', 'legacy')),
  first_registration_year integer NOT NULL CHECK (first_registration_year BETWEEN 1990 AND 2200),
  first_year_source text NOT NULL DEFAULT 'registration' CHECK (first_year_source IN ('registration', 'record_created', 'needs_review')),
  national_id_normalised text,
  identity_verified boolean NOT NULL DEFAULT true,
  verification_method text NOT NULL DEFAULT 'national_id' CHECK (verification_method IN ('national_id', 'manual', 'legacy_unverified')),
  first_name text, last_name text, date_of_birth date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_review', 'merged')),
  merged_into uuid REFERENCES public.trainee_identities(id),
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainee_identities_trainee_number_key UNIQUE (trainee_number),
  CONSTRAINT trainee_identities_number_format_ck CHECK (
    number_format = 'legacy'
    OR (trainee_number ~ '^[0-9]{9}$' AND left(trainee_number, 4)::integer = first_registration_year))
);
CREATE UNIQUE INDEX uq_identity_national_id ON public.trainee_identities (national_id_normalised)
  WHERE national_id_normalised IS NOT NULL AND status <> 'merged';

-- every number ever issued; the primary key is what makes reissuing impossible
CREATE TABLE public.trainee_number_ledger (
  number text NOT NULL,
  identity_id uuid NOT NULL REFERENCES public.trainee_identities(id),
  kind text NOT NULL CHECK (kind IN ('canonical', 'legacy_alias', 'retired')),
  issued_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz, reason text,
  CONSTRAINT trainee_number_ledger_pkey PRIMARY KEY (number)
);
CREATE INDEX idx_number_ledger_identity ON public.trainee_number_ledger (identity_id);

CREATE TABLE public.identity_review_cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('possible_duplicate', 'manual_verification', 'identity_conflict')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'same_person', 'different_people', 'verified', 'dismissed')),
  organization_id uuid REFERENCES public.organizations(id),
  application_id uuid REFERENCES public.trainee_applications(id),
  identity_a uuid REFERENCES public.trainee_identities(id), identity_b uuid REFERENCES public.trainee_identities(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), resolved_by uuid, resolved_at timestamptz, resolution_reason text
);
CREATE INDEX idx_identity_review_open ON public.identity_review_cases (status, kind);
CREATE UNIQUE INDEX uq_identity_review_application ON public.identity_review_cases (application_id, kind) WHERE application_id IS NOT NULL AND status = 'open';

CREATE TABLE public.identity_audit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  identity_id uuid, trainee_id uuid, transfer_id uuid, organization_id uuid,
  actor_id uuid DEFAULT auth.uid(), actor_role text,
  outcome text NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'blocked', 'failed')),
  reason text, details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_identity_audit_identity ON public.identity_audit_events (identity_id, created_at DESC);
CREATE INDEX idx_identity_audit_transfer ON public.identity_audit_events (transfer_id, created_at);
CREATE OR REPLACE FUNCTION public.identity_tables_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% cannot be changed or deleted', TG_TABLE_NAME; END $$;
CREATE TRIGGER trg_identity_audit_append_only BEFORE UPDATE OR DELETE ON public.identity_audit_events FOR EACH ROW EXECUTE FUNCTION public.identity_tables_append_only();
-- the ledger can only gain rows or have a number retired; numbers and owners never change and rows are never deleted
CREATE OR REPLACE FUNCTION public.number_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Issued trainee numbers can never be removed'; END IF;
  IF NEW.number <> OLD.number OR NEW.identity_id <> OLD.identity_id THEN RAISE EXCEPTION 'An issued trainee number cannot be reassigned'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_number_ledger_guard BEFORE UPDATE OR DELETE ON public.trainee_number_ledger FOR EACH ROW EXECUTE FUNCTION public.number_ledger_guard();

CREATE TABLE public.identity_migration_report (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, generated_at timestamptz NOT NULL DEFAULT now(), report jsonb NOT NULL
);

-- ---------------------------------------------------------------------------
-- 2. Link registrations (trainees rows) to identities
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainees ADD COLUMN identity_id uuid REFERENCES public.trainee_identities(id);
ALTER TABLE public.trainees ADD COLUMN identity_conflict boolean NOT NULL DEFAULT false;
CREATE INDEX idx_trainees_identity ON public.trainees (identity_id);

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
-- a verified identifier only counts when it looks like a real document number; placeholders never merge people
CREATE OR REPLACE FUNCTION public.normalise_national_id(_id text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN n IS NULL OR length(n) < 8 OR n ~ '^(.)\1+$' OR n IN ('NOTAVAILABLE', 'UNKNOWN', 'NONE', 'PENDING', 'TESTTEST', 'XXXXXXXX') OR n LIKE 'TEST%' OR n LIKE 'SAMPLE%' THEN NULL
    ELSE n END
  FROM (SELECT upper(regexp_replace(coalesce(_id, ''), '[^0-9A-Za-z]', '', 'g')) AS n) s
$$;

-- five uniformly distributed digits from the database's cryptographic generator (gen_random_uuid uses the strong RNG);
-- rejection sampling removes modulo bias. The test hook only works for the database owner, never for API roles.
CREATE OR REPLACE FUNCTION public.secure_digits5() RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE _hook text := current_setting('app.test_suffixes', true); _v bigint; _i integer := 0;
BEGIN
  IF coalesce(_hook, '') <> '' AND current_setting('role') IN ('none', 'postgres') THEN
    PERFORM set_config('app.test_suffixes', coalesce(nullif(substr(_hook, position(',' IN _hook || ',') + 1), ''), ''), true);
    RETURN lpad(split_part(_hook, ',', 1), 5, '0');
  END IF;
  LOOP
    _v := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint & 4294967295;  -- 0 .. 2^32-1
    EXIT WHEN _v < 4294900000;            -- largest multiple of 100000 below 2^32
    _i := _i + 1;
    IF _i > 50 THEN RAISE EXCEPTION 'Random source unavailable'; END IF;
  END LOOP;
  RETURN lpad((_v % 100000)::text, 5, '0');
END $$;
REVOKE ALL ON FUNCTION public.secure_digits5() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.identity_actor_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = auth.uid() ORDER BY ur.created_at LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.identity_actor_role() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.identity_log(_event text, _identity uuid, _trainee uuid, _transfer uuid, _org uuid, _outcome text, _reason text, _details jsonb DEFAULT '{}')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.identity_audit_events (event_type, identity_id, trainee_id, transfer_id, organization_id, actor_id, actor_role, outcome, reason, details)
  VALUES (_event, _identity, _trainee, _transfer, _org, auth.uid(), public.identity_actor_role(), _outcome, _reason, coalesce(_details, '{}'))
$$;
REVOKE ALL ON FUNCTION public.identity_log(text, uuid, uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_identity_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_platform_user() OR public.is_super_admin(auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.is_identity_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_identity_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.org_role_users(_org uuid, _roles text[]) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = _org AND role::text = ANY (_roles)
$$;
REVOKE ALL ON FUNCTION public.org_role_users(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- 'active' registrations: the statuses in which a person occupies a place at a VTC
CREATE OR REPLACE FUNCTION public.registration_is_active(_status text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT _status IN ('active', 'deferred') $$;

-- Can this person register at _org? Returns {ok, code, message}. Does not change anything.
CREATE OR REPLACE FUNCTION public.registration_eligibility(_identity uuid, _org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _other uuid; _same uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.trainee_identities WHERE id = _identity AND status = 'merged') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IDENTITY_MERGED', 'message', 'This identity was merged into another record. Use the current record.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.trainee_transfers WHERE identity_id = _identity AND status IN ('PENDING_TRAINING', 'PENDING_SUPPORT', 'APPROVED', 'FAILED')) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TRANSFER_PENDING', 'message', 'A transfer request for this trainee is still being processed. Registration at another VTC is blocked until it is completed, rejected or cancelled.');
  END IF;
  SELECT id INTO _same FROM public.trainees WHERE identity_id = _identity AND organization_id = _org AND status IN ('active', 'deferred') LIMIT 1;
  IF _same IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REGISTERED_HERE', 'message', 'This trainee already has an active registration at this VTC.');
  END IF;
  SELECT id INTO _other FROM public.trainees WHERE identity_id = _identity AND organization_id <> _org AND status IN ('active', 'deferred') LIMIT 1;
  IF _other IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACTIVE_REGISTRATION_ELSEWHERE',
      'message', 'This trainee is already registered at another VTC. They must request a transfer from their trainee portal before they can register here.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.registration_eligibility(uuid, uuid) FROM PUBLIC, anon, authenticated;
-- the same answer for staff, who may only ask about their own VTC
CREATE OR REPLACE FUNCTION public.check_registration_eligibility(_identity uuid, _org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.centre_access_ok(_org) THEN RAISE EXCEPTION 'Not authorised for this centre' USING ERRCODE = '42501'; END IF;
  RETURN public.registration_eligibility(_identity, _org);
END $$;
REVOKE ALL ON FUNCTION public.check_registration_eligibility(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_registration_eligibility(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Transfers (table first: the eligibility check above reads it)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.trainee_transfer_seq;
CREATE TABLE public.trainee_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  identity_id uuid NOT NULL REFERENCES public.trainee_identities(id),
  source_trainee_id uuid NOT NULL REFERENCES public.trainees(id),
  source_org uuid NOT NULL REFERENCES public.organizations(id),
  destination_org uuid NOT NULL REFERENCES public.organizations(id),
  requested_by uuid NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 10),
  status text NOT NULL DEFAULT 'PENDING_TRAINING' CHECK (status IN ('PENDING_TRAINING', 'PENDING_SUPPORT', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED')),
  training_decision text CHECK (training_decision IN ('approved', 'rejected')), training_decided_by uuid, training_decided_role text, training_decided_at timestamptz, training_comment text,
  support_decision text CHECK (support_decision IN ('approved', 'rejected')), support_decided_by uuid, support_decided_role text, support_decided_at timestamptz, support_comment text,
  destination_trainee_id uuid REFERENCES public.trainees(id),
  completed_at timestamptz, failure_reason text, failed_at timestamptz, attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_org <> destination_org)
);
-- one unresolved transfer per person (a FAILED one still holds the slot until retried or resolved)
CREATE UNIQUE INDEX uq_transfer_unresolved ON public.trainee_transfers (identity_id) WHERE status IN ('PENDING_TRAINING', 'PENDING_SUPPORT', 'APPROVED', 'FAILED');
CREATE INDEX idx_transfers_source ON public.trainee_transfers (source_org, status);
CREATE INDEX idx_transfers_requested_by ON public.trainee_transfers (requested_by);
-- statuses only move forward, only through the transfer functions
CREATE OR REPLACE FUNCTION public.transfer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Transfer requests cannot be deleted'; END IF;
  IF coalesce(current_setting('app.transfer_fn', true), '') <> 'on' THEN RAISE EXCEPTION 'Transfers can only be changed through the transfer workflow'; END IF;
  IF OLD.status IN ('COMPLETED', 'REJECTED', 'CANCELLED') AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'A finished transfer cannot be reopened'; END IF;
  IF NEW.status = 'COMPLETED' AND (NEW.training_decision IS DISTINCT FROM 'approved' OR NEW.support_decision IS DISTINCT FROM 'approved'
       OR NEW.training_decided_by IS NULL OR NEW.support_decided_by IS NULL OR NEW.training_decided_by = NEW.support_decided_by) THEN
    RAISE EXCEPTION 'A transfer needs two approvals from different people before it can complete';
  END IF;
  IF NEW.identity_id <> OLD.identity_id OR NEW.source_org <> OLD.source_org OR NEW.destination_org <> OLD.destination_org OR NEW.requested_by <> OLD.requested_by OR NEW.source_trainee_id <> OLD.source_trainee_id THEN
    RAISE EXCEPTION 'The parties of a transfer cannot be changed';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_transfer_guard BEFORE UPDATE OR DELETE ON public.trainee_transfers FOR EACH ROW EXECUTE FUNCTION public.transfer_guard();
-- an insert cannot skip the approvals either
CREATE OR REPLACE FUNCTION public.transfer_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.transfer_fn', true), '') <> 'on' THEN RAISE EXCEPTION 'Transfers can only be created through the transfer workflow'; END IF;
  IF NEW.status <> 'PENDING_TRAINING' OR NEW.training_decision IS NOT NULL OR NEW.support_decision IS NOT NULL THEN RAISE EXCEPTION 'A new transfer request always starts awaiting the Head of Training'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_transfer_insert_guard BEFORE INSERT ON public.trainee_transfers FOR EACH ROW EXECUTE FUNCTION public.transfer_insert_guard();

-- ---------------------------------------------------------------------------
-- 5. Identity resolution and number allocation (the only way a number is issued)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.identity_create(_first text, _last text, _dob date, _norm text, _verified boolean, _method text, _created_for uuid DEFAULT NULL)
RETURNS public.trainee_identities LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _year integer := extract(year FROM now())::integer; _num text; _id public.trainee_identities; _cn text; _try integer := 0;
BEGIN
  LOOP
    _try := _try + 1;
    _num := _year::text || public.secure_digits5();
    BEGIN
      INSERT INTO public.trainee_identities (trainee_number, number_format, first_registration_year, first_year_source, national_id_normalised, identity_verified, verification_method, first_name, last_name, date_of_birth, created_by)
      VALUES (_num, 'global9', _year, 'registration', _norm, _verified, _method, _first, _last, _dob, auth.uid()) RETURNING * INTO _id;
      INSERT INTO public.trainee_number_ledger (number, identity_id, kind) VALUES (_num, _id.id, 'canonical');
      RETURN _id;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS _cn = CONSTRAINT_NAME;
      IF _cn NOT IN ('trainee_identities_trainee_number_key', 'trainee_number_ledger_pkey') THEN RAISE; END IF;
      IF _try >= 25 THEN
        RAISE EXCEPTION 'NUMBER_ALLOCATION_FAILED: could not allocate a unique trainee number after % attempts', _try USING ERRCODE = 'P0001';
      END IF;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.identity_create(text, text, date, text, boolean, text, uuid) FROM PUBLIC, anon, authenticated;

-- Finds the person or creates them. Never merges on fuzzy evidence: a possible match opens a review case and stops.
CREATE OR REPLACE FUNCTION public.identity_resolve(_first text, _last text, _dob date, _national text, _org uuid, _application uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _norm text := public.normalise_national_id(_national); i public.trainee_identities; _elig jsonb; _case uuid; _match record; _resolved record; _created boolean := false;
BEGIN
  IF _norm IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('identity:' || _norm));
    SELECT * INTO i FROM public.trainee_identities WHERE national_id_normalised = _norm AND status <> 'merged' FOR UPDATE;
  ELSE
    -- no usable identifier: only a manually verified case lets the person in
    SELECT * INTO _resolved FROM public.identity_review_cases WHERE kind = 'manual_verification' AND application_id = _application AND status = 'verified' ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.identity_review_cases (kind, organization_id, application_id, details)
      VALUES ('manual_verification', _org, _application, jsonb_build_object('first_name', _first, 'last_name', _last, 'reason', 'No usable national identifier'))
      ON CONFLICT (application_id, kind) WHERE application_id IS NOT NULL AND status = 'open' DO NOTHING RETURNING id INTO _case;
      PERFORM public.identity_log('manual_verification_required', NULL, NULL, NULL, _org, 'blocked', 'No usable national identifier', jsonb_build_object('application_id', _application));
      RETURN jsonb_build_object('ok', false, 'code', 'MANUAL_VERIFICATION_REQUIRED', 'case_id', _case,
        'message', 'This applicant has no usable identity document number. Ask the platform team to verify the identity manually before registration can continue.');
    END IF;
  END IF;

  IF FOUND AND i.id IS NOT NULL THEN
    _elig := public.registration_eligibility(i.id, _org);
    IF NOT (_elig->>'ok')::boolean THEN
      PERFORM public.identity_log('registration_blocked', i.id, NULL, NULL, _org, 'blocked', _elig->>'code', jsonb_build_object('application_id', _application));
      RETURN _elig || jsonb_build_object('identity_id', i.id);
    END IF;
    PERFORM public.identity_log('identity_reused', i.id, NULL, NULL, _org, 'success', NULL, jsonb_build_object('application_id', _application));
    RETURN jsonb_build_object('ok', true, 'identity_id', i.id, 'trainee_number', i.trainee_number, 'created', false);
  END IF;

  -- unknown by identifier: look for the same person under different details (name + date of birth)
  IF _dob IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.identity_review_cases WHERE application_id = _application AND kind = 'possible_duplicate' AND status = 'different_people') THEN
    SELECT id, trainee_number INTO _match FROM public.trainee_identities
      WHERE status <> 'merged' AND date_of_birth = _dob AND lower(first_name) = lower(_first) AND lower(last_name) = lower(_last) LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.identity_review_cases (kind, organization_id, application_id, identity_a, details)
      VALUES ('possible_duplicate', _org, _application, _match.id, jsonb_build_object('first_name', _first, 'last_name', _last, 'reason', 'Same name and date of birth as an existing identity'))
      ON CONFLICT (application_id, kind) WHERE application_id IS NOT NULL AND status = 'open' DO NOTHING RETURNING id INTO _case;
      PERFORM public.identity_log('duplicate_suspected', _match.id, NULL, NULL, _org, 'blocked', 'Same name and date of birth', jsonb_build_object('application_id', _application, 'case_id', _case));
      RETURN jsonb_build_object('ok', false, 'code', 'POSSIBLE_DUPLICATE', 'case_id', _case,
        'message', 'This applicant may already be known to the system. The case was sent for identity review; registration continues once it is resolved.');
    END IF;
  END IF;
  -- a review that decided "same person" tells us which identity to reuse
  SELECT * INTO _resolved FROM public.identity_review_cases WHERE application_id = _application AND kind = 'possible_duplicate' AND status = 'same_person' ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND _resolved.identity_a IS NOT NULL THEN
    SELECT * INTO i FROM public.trainee_identities WHERE id = _resolved.identity_a;
    _elig := public.registration_eligibility(i.id, _org);
    IF NOT (_elig->>'ok')::boolean THEN
      PERFORM public.identity_log('registration_blocked', i.id, NULL, NULL, _org, 'blocked', _elig->>'code', jsonb_build_object('application_id', _application));
      RETURN _elig || jsonb_build_object('identity_id', i.id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'identity_id', i.id, 'trainee_number', i.trainee_number, 'created', false);
  END IF;

  i := public.identity_create(_first, _last, _dob, _norm, _norm IS NOT NULL, CASE WHEN _norm IS NULL THEN 'manual' ELSE 'national_id' END);
  PERFORM public.identity_log('identity_created', i.id, NULL, NULL, _org, 'success', NULL, jsonb_build_object('application_id', _application));
  PERFORM public.identity_log('number_allocated', i.id, NULL, NULL, _org, 'success', NULL, jsonb_build_object('format', 'global9', 'year', i.first_registration_year));
  RETURN jsonb_build_object('ok', true, 'identity_id', i.id, 'trainee_number', i.trainee_number, 'created', true);
END $$;
REVOKE ALL ON FUNCTION public.identity_resolve(text, text, date, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- The entry point used when an applicant becomes a registered trainee (application fee cleared).
CREATE OR REPLACE FUNCTION public.allocate_trainee_identity(_application uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.trainee_applications%ROWTYPE; _existing record; r jsonb;
BEGIN
  SELECT * INTO a FROM public.trainee_applications WHERE id = _application;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.has_org_role(auth.uid(), a.organization_id, ARRAY['registration_officer', 'debtor_officer', 'head_of_trainee_support', 'organization_admin', 'admin']) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  -- retry-safe: an application that already has a number keeps it
  IF a.trainee_number IS NOT NULL THEN
    SELECT i.id AS identity_id, i.trainee_number INTO _existing FROM public.trainee_number_ledger l JOIN public.trainee_identities i ON i.id = coalesce((SELECT m.merged_into FROM public.trainee_identities m WHERE m.id = l.identity_id), l.identity_id) WHERE l.number = a.trainee_number;
    IF FOUND THEN RETURN jsonb_build_object('ok', true, 'identity_id', _existing.identity_id, 'trainee_number', _existing.trainee_number, 'created', false); END IF;
  END IF;
  r := public.identity_resolve(a.first_name, a.last_name, a.date_of_birth, a.national_id, a.organization_id, a.id);
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.allocate_trainee_identity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_trainee_identity(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Backfill: one identity per existing trainee record, existing numbers kept as they are
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record; i public.trainee_identities; _norm text; _first_year integer; _src text; _format text; _linked integer := 0; _created integer := 0; _unverified integer := 0;
  _aliases integer := 0; _conflicts integer := 0; _dups integer := 0; _legacy integer := 0; _global9 integer := 0; _needs_review integer := 0;
BEGIN
  FOR r IN SELECT t.*, (SELECT min(coalesce(g.registered_at, g.created_at)) FROM public.registrations g WHERE g.trainee_id = t.id) AS first_registration
           FROM public.trainees t ORDER BY t.created_at, t.id LOOP
    _norm := public.normalise_national_id(r.national_id);
    i := NULL;
    IF _norm IS NOT NULL THEN SELECT * INTO i FROM public.trainee_identities WHERE national_id_normalised = _norm AND status <> 'merged'; END IF;
    IF i.id IS NULL THEN
      _first_year := extract(year FROM coalesce(r.first_registration, r.created_at))::integer;
      _src := CASE WHEN r.first_registration IS NOT NULL THEN 'registration' ELSE 'record_created' END;
      IF _src = 'record_created' THEN _needs_review := _needs_review + 1; END IF;
      _format := CASE WHEN r.trainee_id ~ '^[0-9]{9}$' AND left(r.trainee_id, 4)::integer = _first_year THEN 'global9' ELSE 'legacy' END;
      INSERT INTO public.trainee_identities (trainee_number, number_format, first_registration_year, first_year_source, national_id_normalised, identity_verified, verification_method, first_name, last_name, date_of_birth, status)
      VALUES (r.trainee_id, _format, _first_year, _src, _norm, _norm IS NOT NULL, CASE WHEN _norm IS NULL THEN 'legacy_unverified' ELSE 'national_id' END, r.first_name, r.last_name, r.date_of_birth, 'active') RETURNING * INTO i;
      INSERT INTO public.trainee_number_ledger (number, identity_id, kind) VALUES (r.trainee_id, i.id, 'canonical');
      _created := _created + 1;
      IF _norm IS NULL THEN _unverified := _unverified + 1; END IF;
      IF _format = 'legacy' THEN _legacy := _legacy + 1; ELSE _global9 := _global9 + 1; END IF;
    ELSE
      -- the same document number on another record: same identity, the record's own number becomes an alias
      IF r.trainee_id <> i.trainee_number AND NOT EXISTS (SELECT 1 FROM public.trainee_number_ledger WHERE number = r.trainee_id) THEN
        INSERT INTO public.trainee_number_ledger (number, identity_id, kind, reason) VALUES (r.trainee_id, i.id, 'legacy_alias', 'Migrated: second record for the same identity');
        _aliases := _aliases + 1;
      END IF;
    END IF;
    UPDATE public.trainees SET identity_id = i.id WHERE id = r.id;
    _linked := _linked + 1;
  END LOOP;

  -- identities with more than one active registration need a decision before the one-active rule can protect them
  UPDATE public.trainees t SET identity_conflict = true
   WHERE public.registration_is_active(t.status::text) AND t.identity_id IN
     (SELECT identity_id FROM public.trainees WHERE public.registration_is_active(status::text) GROUP BY identity_id HAVING count(*) > 1);
  GET DIAGNOSTICS _conflicts = ROW_COUNT;
  INSERT INTO public.identity_review_cases (kind, organization_id, identity_a, details)
  SELECT 'identity_conflict', (array_agg(t.organization_id ORDER BY t.created_at))[1], t.identity_id, jsonb_build_object('active_registrations', count(*))
    FROM public.trainees t WHERE t.identity_conflict GROUP BY t.identity_id;

  -- possible duplicates under different identifiers: queued, never merged
  INSERT INTO public.identity_review_cases (kind, identity_a, identity_b, details)
  SELECT 'possible_duplicate', a.id, b.id, jsonb_build_object('reason', 'Same name and date of birth, different identifiers')
    FROM public.trainee_identities a JOIN public.trainee_identities b ON a.id < b.id AND a.date_of_birth = b.date_of_birth
     AND lower(a.first_name) = lower(b.first_name) AND lower(a.last_name) = lower(b.last_name) AND a.date_of_birth IS NOT NULL;
  GET DIAGNOSTICS _dups = ROW_COUNT;

  INSERT INTO public.identity_migration_report (report) VALUES (jsonb_build_object(
    'trainee_records', _linked, 'identities_created', _created, 'kept_legacy_format', _legacy, 'already_nine_digit', _global9,
    'unverified_identities', _unverified, 'number_aliases_recorded', _aliases, 'first_year_needs_review', _needs_review,
    'active_records_in_conflict', _conflicts, 'possible_duplicate_pairs_queued', _dups,
    'note', 'Existing numbers were kept as canonical. Records whose first registration year could not be derived from registration history use the record creation year and are flagged first_year_source = record_created.'));
  INSERT INTO public.identity_audit_events (event_type, outcome, reason, details)
  SELECT 'migration_backfill', 'success', 'Initial identity backfill', report FROM public.identity_migration_report ORDER BY generated_at DESC LIMIT 1;
END $$;

ALTER TABLE public.trainees ALTER COLUMN identity_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. Database rules on trainees: number comes from the identity, one active registration per person
-- ---------------------------------------------------------------------------
-- one registration record per person per VTC (returning to a VTC reactivates it); numbers repeat across VTCs by design
ALTER TABLE public.trainees DROP CONSTRAINT IF EXISTS trainees_trainee_id_key;
ALTER TABLE public.trainees DROP CONSTRAINT IF EXISTS trainees_national_id_unique;
CREATE UNIQUE INDEX uq_trainee_identity_org ON public.trainees (identity_id, organization_id);
CREATE UNIQUE INDEX uq_trainee_number_org ON public.trainees (trainee_id, organization_id);
CREATE UNIQUE INDEX uq_one_active_registration ON public.trainees (identity_id) WHERE status IN ('active', 'deferred') AND NOT identity_conflict;
CREATE UNIQUE INDEX uq_trainee_national_id_active ON public.trainees (national_id) WHERE status IN ('active', 'deferred') AND NOT identity_conflict;

DROP TRIGGER IF EXISTS auto_set_trainee_id ON public.trainees;
DROP FUNCTION IF EXISTS public.set_trainee_id();

CREATE OR REPLACE FUNCTION public.trainees_enforce_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i public.trainee_identities; _legacy boolean; _elig jsonb; _res jsonb; _norm text; _executing boolean;
BEGIN
  _executing := coalesce(current_setting('app.transfer_execution', true), '') = 'on';
  _legacy := coalesce(current_setting('app.legacy_import', true), '') = 'on' AND current_setting('role') IN ('none', 'postgres');
  IF TG_OP = 'INSERT' THEN
    IF NEW.identity_id IS NULL THEN
      SELECT i2.* INTO i FROM public.trainee_number_ledger l JOIN public.trainee_identities i2 ON i2.id = coalesce((SELECT m.merged_into FROM public.trainee_identities m WHERE m.id = l.identity_id), l.identity_id) WHERE l.number = NEW.trainee_id;
      IF NOT FOUND THEN
        IF _legacy THEN
          -- database-owner import of historical records only: keeps the supplied number as a legacy identity
          _norm := public.normalise_national_id(NEW.national_id);
          INSERT INTO public.trainee_identities (trainee_number, number_format, first_registration_year, first_year_source, national_id_normalised, identity_verified, verification_method, first_name, last_name, date_of_birth)
          VALUES (NEW.trainee_id, 'legacy', extract(year FROM now())::integer, 'record_created', _norm, _norm IS NOT NULL, CASE WHEN _norm IS NULL THEN 'legacy_unverified' ELSE 'national_id' END, NEW.first_name, NEW.last_name, NEW.date_of_birth)
          RETURNING * INTO i;
          INSERT INTO public.trainee_number_ledger (number, identity_id, kind) VALUES (NEW.trainee_id, i.id, 'canonical');
        ELSE
          -- an unknown number is never trusted: resolve the person and issue the number ourselves
          _res := public.identity_resolve(NEW.first_name, NEW.last_name, NEW.date_of_birth, NEW.national_id, NEW.organization_id, NULL);
          IF NOT (_res->>'ok')::boolean THEN RAISE EXCEPTION '%: %', _res->>'code', _res->>'message'; END IF;
          SELECT * INTO i FROM public.trainee_identities WHERE id = (_res->>'identity_id')::uuid;
        END IF;
      END IF;
      NEW.identity_id := i.id;
    ELSE
      SELECT * INTO i FROM public.trainee_identities WHERE id = NEW.identity_id;
    END IF;
    _norm := public.normalise_national_id(NEW.national_id);
    IF i.national_id_normalised IS NOT NULL AND _norm IS DISTINCT FROM i.national_id_normalised THEN
      RAISE EXCEPTION 'IDENTITY_MISMATCH: the identity document number does not match the identity this number belongs to';
    END IF;
    IF i.status = 'merged' THEN RAISE EXCEPTION 'IDENTITY_MERGED: this identity was merged into another record'; END IF;
    NEW.trainee_id := i.trainee_number;            -- the number is never taken from the caller
    IF NOT _executing AND public.registration_is_active(NEW.status::text) THEN
      _elig := public.registration_eligibility(NEW.identity_id, NEW.organization_id);
      IF NOT (_elig->>'ok')::boolean THEN RAISE EXCEPTION '%: %', _elig->>'code', _elig->>'message'; END IF;
    END IF;
    -- the login follows the newest registration of the person
    IF NEW.user_id IS NOT NULL THEN
      UPDATE public.trainees SET user_id = NULL, system_email = CASE WHEN system_email IS NOT DISTINCT FROM NEW.system_email THEN NULL ELSE system_email END
       WHERE identity_id = NEW.identity_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF (NEW.identity_id IS DISTINCT FROM OLD.identity_id OR NEW.trainee_id IS DISTINCT FROM OLD.trainee_id) AND coalesce(current_setting('app.identity_maintenance', true), '') <> 'on' THEN
    RAISE EXCEPTION 'The global trainee number and identity cannot be changed here';
  END IF;
  IF NEW.status::text IS DISTINCT FROM OLD.status::text AND public.registration_is_active(NEW.status::text) AND NOT public.registration_is_active(OLD.status::text) AND NOT _executing THEN
    _elig := public.registration_eligibility(NEW.identity_id, NEW.organization_id);
    IF NOT (_elig->>'ok')::boolean AND _elig->>'code' <> 'ALREADY_REGISTERED_HERE' THEN RAISE EXCEPTION '%: %', _elig->>'code', _elig->>'message'; END IF;
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id AND NOT _executing THEN
    RAISE EXCEPTION 'A trainee can only move to another VTC through the transfer workflow';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trainees_enforce_identity BEFORE INSERT OR UPDATE ON public.trainees FOR EACH ROW EXECUTE FUNCTION public.trainees_enforce_identity();

-- the legacy generators are retired: numbers come only from allocate_trainee_identity
CREATE OR REPLACE FUNCTION public.generate_trainee_number(org_id uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Retired: trainee numbers are issued by allocate_trainee_identity() only'; END $$;
CREATE OR REPLACE FUNCTION public.generate_trainee_id(org_id uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Retired: trainee numbers are issued by allocate_trainee_identity() only'; END $$;
CREATE OR REPLACE FUNCTION public.generate_continuous_trainee_number(org_id uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Retired: trainee numbers are issued by allocate_trainee_identity() only'; END $$;
REVOKE ALL ON FUNCTION public.generate_trainee_number(uuid), public.generate_trainee_id(uuid), public.generate_continuous_trainee_number(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Transfer workflow
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_notify(_org uuid, _user uuid, _event text, _title text, _message text, _link text DEFAULT '/transfers') RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT public.workflow_notify(_org, _user, _event, _title, _message, _link, _message) $$;
REVOKE ALL ON FUNCTION public.transfer_notify(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- VTCs the signed-in trainee could ask to move to
CREATE OR REPLACE FUNCTION public.transfer_destinations() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) ORDER BY o.name), '[]'::jsonb)
  FROM public.organizations o
  WHERE o.active AND auth.uid() IS NOT NULL AND o.id <> coalesce((SELECT t.organization_id FROM public.trainees t WHERE t.user_id = auth.uid() LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid)
$$;
GRANT EXECUTE ON FUNCTION public.transfer_destinations() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_transfer_request(_destination uuid, _reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.trainees%ROWTYPE; _id uuid; _ref text; _name text; u uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  PERFORM set_config('app.transfer_fn', 'on', true);
  -- identity, registration and VTC all come from the signed-in trainee's own record, never from the request
  SELECT * INTO src FROM public.trainees WHERE user_id = auth.uid() AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a trainee with an active registration can request a transfer'; END IF;
  IF _destination IS NULL OR _destination = src.organization_id THEN RAISE EXCEPTION 'Choose a different VTC from your current one'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _destination AND active) THEN RAISE EXCEPTION 'That VTC cannot receive transfers'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 10 THEN RAISE EXCEPTION 'Explain the reason for the transfer (at least 10 characters)'; END IF;
  IF EXISTS (SELECT 1 FROM public.trainee_transfers WHERE identity_id = src.identity_id AND status IN ('PENDING_TRAINING', 'PENDING_SUPPORT', 'APPROVED', 'FAILED')) THEN
    PERFORM public.identity_log('transfer_blocked', src.identity_id, src.id, NULL, src.organization_id, 'blocked', 'A transfer request is already open');
    RAISE EXCEPTION 'You already have a transfer request in progress';
  END IF;
  _ref := 'TR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.trainee_transfer_seq')::text, 6, '0');
  BEGIN
    INSERT INTO public.trainee_transfers (reference, identity_id, source_trainee_id, source_org, destination_org, requested_by, reason)
    VALUES (_ref, src.identity_id, src.id, src.organization_id, _destination, auth.uid(), trim(_reason)) RETURNING id INTO _id;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'You already have a transfer request in progress';
  END;
  _name := src.first_name || ' ' || src.last_name;
  PERFORM public.identity_log('transfer_submitted', src.identity_id, src.id, _id, src.organization_id, 'success', trim(_reason), jsonb_build_object('reference', _ref, 'destination_org', _destination));
  PERFORM public.transfer_notify(src.organization_id, auth.uid(), 'transfer_submitted', 'Transfer request ' || _ref || ' submitted', 'Your request to move to another VTC was submitted and is waiting for the Head of Training.', '/trainee/transfer');
  FOR u IN SELECT public.org_role_users(src.organization_id, ARRAY['head_of_training', 'hod']) LOOP
    PERFORM public.transfer_notify(src.organization_id, u, 'transfer_decision_needed', 'Transfer request ' || _ref, _name || ' (' || src.trainee_id || ') asks to transfer to another VTC. Your decision is needed.');
  END LOOP;
  RETURN jsonb_build_object('id', _id, 'reference', _ref, 'status', 'PENDING_TRAINING');
END $$;
GRANT EXECUTE ON FUNCTION public.submit_transfer_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_transfer(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr public.trainee_transfers%ROWTYPE;
BEGIN
  PERFORM set_config('app.transfer_fn', 'on', true);
  SELECT * INTO tr FROM public.trainee_transfers WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR tr.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Transfer request not found'; END IF;
  IF tr.status NOT IN ('PENDING_TRAINING', 'PENDING_SUPPORT') THEN RAISE EXCEPTION 'Only a request that is still waiting for a decision can be cancelled'; END IF;
  UPDATE public.trainee_transfers SET status = 'CANCELLED' WHERE id = _id;
  PERFORM public.identity_log('transfer_cancelled', tr.identity_id, tr.source_trainee_id, _id, tr.source_org, 'success', NULL, jsonb_build_object('reference', tr.reference, 'was', tr.status));
  PERFORM public.transfer_notify(tr.source_org, auth.uid(), 'transfer_cancelled', 'Transfer request ' || tr.reference || ' cancelled', 'You cancelled your transfer request.', '/trainee/transfer');
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_transfer(uuid) TO authenticated;

-- Moves the registration. Internal: reached only from decide_transfer / retry_transfer.
CREATE OR REPLACE FUNCTION public.execute_transfer(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tr public.trainee_transfers%ROWTYPE; src public.trainees%ROWTYPE; _dst uuid; _trade uuid; _qual uuid; _qcode text; _msg text; u uuid; _name text; _dest_name text;
BEGIN
  PERFORM set_config('app.transfer_fn', 'on', true);
  SELECT * INTO tr FROM public.trainee_transfers WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer request not found'; END IF;
  IF tr.status = 'COMPLETED' THEN RETURN jsonb_build_object('status', 'COMPLETED', 'already_completed', true, 'destination_trainee_id', tr.destination_trainee_id); END IF;
  IF tr.status NOT IN ('APPROVED', 'FAILED') THEN RAISE EXCEPTION 'This transfer is not approved (status %)', tr.status; END IF;
  IF tr.training_decision IS DISTINCT FROM 'approved' OR tr.support_decision IS DISTINCT FROM 'approved' OR tr.training_decided_by IS NULL OR tr.support_decided_by IS NULL
     OR tr.training_decided_by = tr.support_decided_by OR tr.requested_by IN (tr.training_decided_by, tr.support_decided_by) THEN
    RAISE EXCEPTION 'The two required approvals are missing or not valid';
  END IF;
  BEGIN
    PERFORM set_config('app.transfer_execution', 'on', true);
    SELECT * INTO src FROM public.trainees WHERE id = tr.source_trainee_id FOR UPDATE;
    IF NOT FOUND OR src.identity_id <> tr.identity_id OR src.organization_id <> tr.source_org THEN RAISE EXCEPTION 'The source registration no longer matches the request'; END IF;
    IF src.status <> 'active' THEN RAISE EXCEPTION 'The source registration is no longer active (%)', src.status; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.trainee_identities WHERE id = tr.identity_id AND status = 'active') THEN RAISE EXCEPTION 'The trainee identity is not valid'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = tr.destination_org AND active) THEN RAISE EXCEPTION 'The destination VTC is not active'; END IF;
    IF EXISTS (SELECT 1 FROM public.trainees WHERE identity_id = tr.identity_id AND id <> src.id AND status IN ('active', 'deferred')) THEN RAISE EXCEPTION 'The trainee has another active registration'; END IF;
    IF NOT (public.has_org_role(tr.training_decided_by, tr.source_org, ARRAY['head_of_training', 'hod']) AND public.has_org_role(tr.support_decided_by, tr.source_org, ARRAY['head_of_trainee_support'])) THEN
      RAISE EXCEPTION 'An approver no longer holds the required role';
    END IF;
    -- the destination must offer the trainee's trade; the qualification is matched by code when the destination has it approved
    SELECT t.id INTO _trade FROM public.trades t WHERE t.id = src.trade_id AND (t.organization_id IS NULL OR t.organization_id = tr.destination_org);
    IF _trade IS NULL THEN
      SELECT t2.id INTO _trade FROM public.trades t2, public.trades t1 WHERE t1.id = src.trade_id AND t2.organization_id = tr.destination_org AND t2.active AND (t2.code = t1.code OR lower(t2.name) = lower(t1.name)) LIMIT 1;
    END IF;
    IF _trade IS NULL THEN RAISE EXCEPTION 'The destination VTC does not offer this trainee''s trade'; END IF;
    SELECT q.qualification_code INTO _qcode FROM public.qualifications q WHERE q.id = src.qualification_id;
    SELECT q.id INTO _qual FROM public.qualifications q WHERE q.organization_id = tr.destination_org AND q.qualification_code = _qcode AND q.active AND q.status::text = 'approved' LIMIT 1;

    -- 1. the source registration is closed (its login moves with the trainee)
    UPDATE public.trainees SET status = 'transferred', user_id = NULL, system_email = NULL WHERE id = src.id;
    -- 2. the destination registration, under the same identity and number
    SELECT id INTO _dst FROM public.trainees WHERE identity_id = tr.identity_id AND organization_id = tr.destination_org FOR UPDATE;
    IF _dst IS NULL THEN
      INSERT INTO public.trainees (organization_id, identity_id, trainee_id, first_name, last_name, email, phone, national_id, date_of_birth, gender, address, trade_id, qualification_id,
        training_mode, level, academic_year, status, system_email, user_id, account_provisioning_status, password_reset_required, is_email_system_generated)
      VALUES (tr.destination_org, tr.identity_id, src.trainee_id, src.first_name, src.last_name, src.email, src.phone, src.national_id, src.date_of_birth, src.gender, src.address, _trade, _qual,
        src.training_mode, src.level, src.academic_year, 'active', src.system_email, src.user_id, src.account_provisioning_status, false, src.is_email_system_generated) RETURNING id INTO _dst;
    ELSE
      UPDATE public.trainees SET status = 'active', trade_id = _trade, qualification_id = coalesce(_qual, qualification_id), level = src.level, academic_year = src.academic_year,
        training_mode = src.training_mode, system_email = src.system_email, user_id = src.user_id WHERE id = _dst;
    END IF;
    IF src.user_id IS NOT NULL THEN
      -- a login holds the trainee role once: it moves from the source VTC to the destination
      UPDATE public.user_roles SET organization_id = tr.destination_org WHERE user_id = src.user_id AND role::text = 'trainee' AND organization_id = tr.source_org;
      IF NOT FOUND THEN
        INSERT INTO public.user_roles (user_id, role, organization_id) SELECT src.user_id, 'trainee', tr.destination_org
          WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = src.user_id AND role::text = 'trainee');
      END IF;
    END IF;
    UPDATE public.trainee_transfers SET status = 'COMPLETED', destination_trainee_id = _dst, completed_at = now(), failure_reason = NULL, attempts = attempts + 1 WHERE id = _id;
    PERFORM public.identity_log('transfer_completed', tr.identity_id, _dst, _id, tr.destination_org, 'success', NULL,
      jsonb_build_object('reference', tr.reference, 'source_trainee_id', src.id, 'source_org', tr.source_org, 'destination_org', tr.destination_org, 'trainee_number', src.trainee_id));
  EXCEPTION WHEN OTHERS THEN
    _msg := left(SQLERRM, 300);
    PERFORM set_config('app.transfer_fn', 'on', true);
    -- everything above is rolled back: the source registration is untouched
    UPDATE public.trainee_transfers SET status = 'FAILED', failure_reason = _msg, failed_at = now(), attempts = attempts + 1 WHERE id = _id;
    PERFORM public.identity_log('transfer_failed', tr.identity_id, tr.source_trainee_id, _id, tr.source_org, 'failed', _msg, jsonb_build_object('reference', tr.reference));
    FOR u IN SELECT public.org_role_users(tr.source_org, ARRAY['head_of_trainee_support']) LOOP
      PERFORM public.transfer_notify(tr.source_org, u, 'transfer_failed', 'Transfer ' || tr.reference || ' could not be completed', _msg);
    END LOOP;
    RETURN jsonb_build_object('status', 'FAILED', 'message', _msg);
  END;
  SELECT first_name || ' ' || last_name INTO _name FROM public.trainees WHERE id = _dst;
  SELECT name INTO _dest_name FROM public.organizations WHERE id = tr.destination_org;
  PERFORM public.transfer_notify(tr.destination_org, tr.requested_by, 'transfer_completed', 'Transfer ' || tr.reference || ' completed', 'You are now registered at ' || _dest_name || '. Your trainee number stays the same.', '/trainee/transfer');
  FOR u IN SELECT public.org_role_users(tr.destination_org, ARRAY['registration_officer', 'head_of_trainee_support']) LOOP
    PERFORM public.transfer_notify(tr.destination_org, u, 'transfer_completed', 'Incoming transfer ' || tr.reference, _name || ' has transferred to your VTC. Complete their registration for the year.', '/trainees');
  END LOOP;
  FOR u IN SELECT public.org_role_users(tr.source_org, ARRAY['registration_officer', 'head_of_training', 'hod', 'head_of_trainee_support']) LOOP
    PERFORM public.transfer_notify(tr.source_org, u, 'transfer_completed', 'Transfer ' || tr.reference || ' completed', _name || ' has transferred to another VTC.', '/transfers');
  END LOOP;
  RETURN jsonb_build_object('status', 'COMPLETED', 'destination_trainee_id', _dst);
END $$;
REVOKE ALL ON FUNCTION public.execute_transfer(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.decide_transfer(_id uuid, _decision text, _comment text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr public.trainee_transfers%ROWTYPE; _role text; _stage text; u uuid; _out jsonb; _trainee text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  PERFORM set_config('app.transfer_fn', 'on', true);
  IF _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'The decision must be approved or rejected'; END IF;
  IF _decision = 'rejected' AND length(trim(coalesce(_comment, ''))) < 5 THEN RAISE EXCEPTION 'Give a reason for rejecting the request'; END IF;
  SELECT * INTO tr FROM public.trainee_transfers WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer request not found'; END IF;
  -- nobody decides their own transfer, whatever roles they hold
  IF tr.requested_by = auth.uid() OR EXISTS (SELECT 1 FROM public.trainees WHERE identity_id = tr.identity_id AND user_id = auth.uid()) THEN
    PERFORM public.identity_log('transfer_decision_blocked', tr.identity_id, tr.source_trainee_id, _id, tr.source_org, 'blocked', 'Own transfer');
    RAISE EXCEPTION 'You cannot decide your own transfer request';
  END IF;
  IF tr.status = 'PENDING_TRAINING' THEN
    _stage := 'training';
    IF NOT public.has_org_role(auth.uid(), tr.source_org, ARRAY['head_of_training', 'hod']) THEN RAISE EXCEPTION 'Only the Head of Training of the trainee''s VTC can decide this step' USING ERRCODE = '42501'; END IF;
    _role := public.identity_actor_role();
  ELSIF tr.status = 'PENDING_SUPPORT' THEN
    _stage := 'support';
    IF NOT public.has_org_role(auth.uid(), tr.source_org, ARRAY['head_of_trainee_support']) THEN RAISE EXCEPTION 'Only the Head of Trainee Support of the trainee''s VTC can decide this step' USING ERRCODE = '42501'; END IF;
    IF tr.training_decided_by = auth.uid() THEN RAISE EXCEPTION 'The second approval must come from a different person'; END IF;
    _role := 'head_of_trainee_support';
  ELSE
    RAISE EXCEPTION 'This request is not waiting for a decision (status %)', tr.status;
  END IF;
  SELECT first_name || ' ' || last_name || ' (' || trainee_id || ')' INTO _trainee FROM public.trainees WHERE id = tr.source_trainee_id;

  IF _stage = 'training' THEN
    UPDATE public.trainee_transfers SET training_decision = _decision, training_decided_by = auth.uid(), training_decided_role = 'head_of_training', training_decided_at = now(),
      training_comment = nullif(trim(coalesce(_comment, '')), ''), status = CASE WHEN _decision = 'approved' THEN 'PENDING_SUPPORT' ELSE 'REJECTED' END WHERE id = _id;
  ELSE
    UPDATE public.trainee_transfers SET support_decision = _decision, support_decided_by = auth.uid(), support_decided_role = _role, support_decided_at = now(),
      support_comment = nullif(trim(coalesce(_comment, '')), ''), status = CASE WHEN _decision = 'approved' THEN 'APPROVED' ELSE 'REJECTED' END WHERE id = _id;
  END IF;
  PERFORM public.identity_log('transfer_' || _stage || '_' || _decision, tr.identity_id, tr.source_trainee_id, _id, tr.source_org, 'success', _comment, jsonb_build_object('reference', tr.reference));

  IF _decision = 'rejected' THEN
    PERFORM public.transfer_notify(tr.source_org, tr.requested_by, 'transfer_rejected', 'Transfer request ' || tr.reference || ' rejected', 'Your transfer request was rejected: ' || trim(coalesce(_comment, '')), '/trainee/transfer');
    RETURN jsonb_build_object('status', 'REJECTED');
  END IF;
  IF _stage = 'training' THEN
    FOR u IN SELECT public.org_role_users(tr.source_org, ARRAY['head_of_trainee_support']) LOOP
      PERFORM public.transfer_notify(tr.source_org, u, 'transfer_decision_needed', 'Transfer request ' || tr.reference, _trainee || ' was approved by the Head of Training. Your decision is needed.');
    END LOOP;
    PERFORM public.transfer_notify(tr.source_org, tr.requested_by, 'transfer_progress', 'Transfer request ' || tr.reference, 'The Head of Training approved your request. It now waits for the Head of Trainee Support.', '/trainee/transfer');
    RETURN jsonb_build_object('status', 'PENDING_SUPPORT');
  END IF;
  -- both approvals are in: the backend executes the move
  PERFORM public.transfer_notify(tr.source_org, tr.requested_by, 'transfer_approved', 'Transfer request ' || tr.reference || ' approved', 'Both approvals are in. Your registration is being moved.', '/trainee/transfer');
  _out := public.execute_transfer(_id);
  RETURN _out;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_transfer(uuid, text, text) TO authenticated;

-- a failed (technical) execution can be retried by the source Head of Trainee Support or the platform team
CREATE OR REPLACE FUNCTION public.retry_transfer(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr public.trainee_transfers%ROWTYPE;
BEGIN
  SELECT * INTO tr FROM public.trainee_transfers WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer request not found'; END IF;
  IF NOT (public.is_identity_admin() OR public.has_org_role(auth.uid(), tr.source_org, ARRAY['head_of_trainee_support'])) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF tr.status <> 'FAILED' THEN RAISE EXCEPTION 'Only a failed transfer can be retried'; END IF;
  RETURN public.execute_transfer(_id);
END $$;
GRANT EXECUTE ON FUNCTION public.retry_transfer(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Reading transfers and identities
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_row_json(tr public.trainee_transfers) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', tr.id, 'reference', tr.reference, 'status', tr.status, 'reason', tr.reason, 'created_at', tr.created_at, 'completed_at', tr.completed_at, 'failure_reason', tr.failure_reason,
    'source_org', tr.source_org, 'source_name', (SELECT name FROM public.organizations WHERE id = tr.source_org),
    'destination_org', tr.destination_org, 'destination_name', (SELECT name FROM public.organizations WHERE id = tr.destination_org),
    'trainee_number', (SELECT trainee_number FROM public.trainee_identities WHERE id = tr.identity_id),
    'trainee_name', (SELECT first_name || ' ' || last_name FROM public.trainees WHERE id = tr.source_trainee_id),
    'programme', (SELECT coalesce(q.qualification_title, tt.name) FROM public.trainees t LEFT JOIN public.qualifications q ON q.id = t.qualification_id LEFT JOIN public.trades tt ON tt.id = t.trade_id WHERE t.id = tr.source_trainee_id),
    'level', (SELECT level FROM public.trainees WHERE id = tr.source_trainee_id),
    'training', jsonb_build_object('decision', tr.training_decision, 'at', tr.training_decided_at, 'comment', tr.training_comment, 'by', (SELECT full_name FROM public.profiles WHERE user_id = tr.training_decided_by)),
    'support', jsonb_build_object('decision', tr.support_decision, 'at', tr.support_decided_at, 'comment', tr.support_comment, 'by', (SELECT full_name FROM public.profiles WHERE user_id = tr.support_decided_by)))
$$;
REVOKE ALL ON FUNCTION public.transfer_row_json(public.trainee_transfers) FROM PUBLIC, anon, authenticated;

-- the signed-in trainee: their number, registrations and transfer requests
CREATE OR REPLACE FUNCTION public.my_transfer_overview() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.trainees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO me FROM public.trainees WHERE user_id = auth.uid() ORDER BY (status = 'active') DESC, created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('registered', false); END IF;
  RETURN jsonb_build_object('registered', true,
    'trainee_number', (SELECT trainee_number FROM public.trainee_identities WHERE id = me.identity_id),
    'current', jsonb_build_object('trainee_id', me.id, 'organization_id', me.organization_id, 'organization_name', (SELECT name FROM public.organizations WHERE id = me.organization_id), 'status', me.status, 'level', me.level,
      'programme', (SELECT coalesce(q.qualification_title, tt.name) FROM public.qualifications q FULL JOIN public.trades tt ON tt.id = me.trade_id WHERE q.id = me.qualification_id OR (me.qualification_id IS NULL AND tt.id = me.trade_id) LIMIT 1)),
    'can_request', me.status = 'active' AND NOT EXISTS (SELECT 1 FROM public.trainee_transfers WHERE identity_id = me.identity_id AND status IN ('PENDING_TRAINING', 'PENDING_SUPPORT', 'APPROVED', 'FAILED')),
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('organization_name', o.name, 'status', t.status, 'since', t.created_at, 'programme', coalesce(q.qualification_title, tt.name)) ORDER BY t.created_at DESC)
        FROM public.trainees t JOIN public.organizations o ON o.id = t.organization_id LEFT JOIN public.qualifications q ON q.id = t.qualification_id LEFT JOIN public.trades tt ON tt.id = t.trade_id WHERE t.identity_id = me.identity_id), '[]'::jsonb),
    'transfers', coalesce((SELECT jsonb_agg(public.transfer_row_json(x) || jsonb_build_object('events', coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event_type, 'at', e.created_at, 'outcome', e.outcome, 'reason', e.reason) ORDER BY e.created_at)
        FROM public.identity_audit_events e WHERE e.transfer_id = x.id), '[]'::jsonb)) ORDER BY x.created_at DESC) FROM public.trainee_transfers x WHERE x.identity_id = me.identity_id), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.my_transfer_overview() TO authenticated;

-- approvers and read-only roles: requests for trainees of their VTC
CREATE OR REPLACE FUNCTION public.transfer_queue() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(public.transfer_row_json(x) || jsonb_build_object(
      'can_decide', CASE WHEN x.status = 'PENDING_TRAINING' THEN public.has_org_role(auth.uid(), x.source_org, ARRAY['head_of_training', 'hod'])
                         WHEN x.status = 'PENDING_SUPPORT' THEN public.has_org_role(auth.uid(), x.source_org, ARRAY['head_of_trainee_support']) AND x.training_decided_by IS DISTINCT FROM auth.uid() ELSE false END,
      'can_retry', x.status = 'FAILED' AND (public.is_identity_admin() OR public.has_org_role(auth.uid(), x.source_org, ARRAY['head_of_trainee_support']))) ORDER BY x.created_at DESC), '[]'::jsonb)
  FROM public.trainee_transfers x
  WHERE auth.uid() IS NOT NULL AND (public.is_identity_admin()
     OR public.has_org_role(auth.uid(), x.source_org, ARRAY['head_of_training', 'hod', 'head_of_trainee_support', 'registration_officer', 'centre_manager', 'organization_admin', 'admin'])
     OR (x.status NOT IN ('REJECTED', 'CANCELLED') AND public.has_org_role(auth.uid(), x.destination_org, ARRAY['registration_officer', 'head_of_trainee_support', 'centre_manager'])))
$$;
GRANT EXECUTE ON FUNCTION public.transfer_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_history(_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE tr public.trainee_transfers%ROWTYPE;
BEGIN
  SELECT * INTO tr FROM public.trainee_transfers WHERE id = _id;
  IF NOT FOUND OR NOT (tr.requested_by = auth.uid() OR public.is_identity_admin()
      OR public.has_org_role(auth.uid(), tr.source_org, ARRAY['head_of_training', 'hod', 'head_of_trainee_support', 'registration_officer', 'centre_manager', 'organization_admin', 'admin'])
      OR (tr.status NOT IN ('REJECTED', 'CANCELLED') AND public.has_org_role(auth.uid(), tr.destination_org, ARRAY['registration_officer', 'head_of_trainee_support', 'centre_manager']))) THEN
    RAISE EXCEPTION 'Transfer request not found';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event_type, 'at', e.created_at, 'by', (SELECT full_name FROM public.profiles WHERE user_id = e.actor_id), 'role', e.actor_role, 'outcome', e.outcome, 'reason', e.reason) ORDER BY e.created_at)
    FROM public.identity_audit_events e WHERE e.transfer_id = _id), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.transfer_history(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Identity maintenance (platform team only, always audited)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.identity_review_queue() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_identity_admin() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('head_of_trainee_support', 'registration_officer'))) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'status', c.status, 'created_at', c.created_at, 'reason', c.details->>'reason', 'resolution_reason', c.resolution_reason,
      'organization', (SELECT name FROM public.organizations WHERE id = c.organization_id),
      'a', CASE WHEN public.is_identity_admin() THEN (SELECT jsonb_build_object('id', i.id, 'trainee_number', i.trainee_number, 'name', i.first_name || ' ' || i.last_name, 'date_of_birth', i.date_of_birth) FROM public.trainee_identities i WHERE i.id = c.identity_a) END,
      'b', CASE WHEN public.is_identity_admin() THEN (SELECT jsonb_build_object('id', i.id, 'trainee_number', i.trainee_number, 'name', i.first_name || ' ' || i.last_name, 'date_of_birth', i.date_of_birth) FROM public.trainee_identities i WHERE i.id = c.identity_b) END,
      'applicant', CASE WHEN c.application_id IS NOT NULL THEN c.details->>'first_name' || ' ' || coalesce(c.details->>'last_name', '') END) ORDER BY (c.status = 'open') DESC, c.created_at DESC)
    FROM public.identity_review_cases c WHERE public.is_identity_admin() OR c.organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('head_of_trainee_support', 'registration_officer'))), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.identity_review_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_identity_review(_case uuid, _decision text, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.identity_review_cases%ROWTYPE;
BEGIN
  IF NOT public.is_identity_admin() THEN RAISE EXCEPTION 'Only the platform team resolves identity reviews' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 10 THEN RAISE EXCEPTION 'Record the reason for the decision (at least 10 characters)'; END IF;
  SELECT * INTO c FROM public.identity_review_cases WHERE id = _case FOR UPDATE;
  IF NOT FOUND OR c.status <> 'open' THEN RAISE EXCEPTION 'This case is not open'; END IF;
  IF (c.kind = 'possible_duplicate' AND _decision NOT IN ('same_person', 'different_people'))
     OR (c.kind = 'manual_verification' AND _decision NOT IN ('verified', 'dismissed'))
     OR (c.kind = 'identity_conflict' AND _decision NOT IN ('dismissed')) THEN RAISE EXCEPTION 'That decision does not apply to this kind of case'; END IF;
  UPDATE public.identity_review_cases SET status = _decision, resolved_by = auth.uid(), resolved_at = now(), resolution_reason = trim(_reason) WHERE id = _case;
  PERFORM public.identity_log('identity_review_' || _decision, c.identity_a, NULL, NULL, c.organization_id, 'success', trim(_reason), jsonb_build_object('case_id', _case, 'kind', c.kind, 'other_identity', c.identity_b));
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_identity_review(uuid, text, text) TO authenticated;

-- Two identities confirmed to be one person: _from folds into _into. Numbers are retired, never reissued.
CREATE OR REPLACE FUNCTION public.merge_identities(_from uuid, _into uuid, _reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.trainee_identities; b public.trainee_identities; _moved integer; _lowest uuid;
BEGIN
  IF NOT public.is_identity_admin() THEN RAISE EXCEPTION 'Only the platform team can merge identities' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 10 THEN RAISE EXCEPTION 'Record the reason for the merge (at least 10 characters)'; END IF;
  IF _from = _into THEN RAISE EXCEPTION 'Choose two different identities'; END IF;
  _lowest := least(_from, _into);
  SELECT * INTO a FROM public.trainee_identities WHERE id = least(_from, _into) FOR UPDATE;
  SELECT * INTO b FROM public.trainee_identities WHERE id = greatest(_from, _into) FOR UPDATE;
  SELECT * INTO a FROM public.trainee_identities WHERE id = _from;
  SELECT * INTO b FROM public.trainee_identities WHERE id = _into;
  IF a.id IS NULL OR b.id IS NULL OR a.status = 'merged' OR b.status = 'merged' THEN RAISE EXCEPTION 'Both identities must exist and not be merged already'; END IF;
  IF EXISTS (SELECT 1 FROM public.trainees x WHERE x.identity_id = _from AND public.registration_is_active(x.status::text))
     AND EXISTS (SELECT 1 FROM public.trainees y WHERE y.identity_id = _into AND public.registration_is_active(y.status::text)) THEN
    RAISE EXCEPTION 'Both identities have an active registration. Resolve that first (one must be closed or transferred).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trainees x JOIN public.trainees y ON y.organization_id = x.organization_id WHERE x.identity_id = _from AND y.identity_id = _into) THEN
    RAISE EXCEPTION 'Both identities already have a record at the same VTC. Consolidate those records first.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trainee_transfers WHERE identity_id IN (_from, _into) AND status IN ('PENDING_TRAINING', 'PENDING_SUPPORT', 'APPROVED', 'FAILED')) THEN RAISE EXCEPTION 'Finish or cancel open transfer requests first'; END IF;
  PERFORM set_config('app.identity_maintenance', 'on', true);
  UPDATE public.trainees SET identity_id = _into, trainee_id = b.trainee_number WHERE identity_id = _from;
  GET DIAGNOSTICS _moved = ROW_COUNT;
  UPDATE public.trainee_transfers SET identity_id = _into WHERE identity_id = _from;
  UPDATE public.trainee_number_ledger SET kind = 'retired', retired_at = now(), reason = 'Merged into ' || b.trainee_number WHERE identity_id = _from AND kind = 'canonical';
  -- ledger rows keep pointing at the merged identity, which points at the canonical one (so old numbers still resolve)
  UPDATE public.trainee_identities SET merged_into = _into WHERE merged_into = _from;
  UPDATE public.trainee_identities SET status = 'merged', merged_into = _into, national_id_normalised = NULL, updated_at = now() WHERE id = _from;
  PERFORM public.identity_log('identity_merged', _into, NULL, NULL, NULL, 'success', trim(_reason), jsonb_build_object('from', _from, 'from_number', a.trainee_number, 'into_number', b.trainee_number, 'registrations_moved', _moved));
  RETURN jsonb_build_object('registrations_moved', _moved, 'retired_number', a.trainee_number, 'canonical_number', b.trainee_number);
END $$;
GRANT EXECUTE ON FUNCTION public.merge_identities(uuid, uuid, text) TO authenticated;

-- A legacy-format identity receives a nine-digit number; the old number stays as an alias. Platform team, one identity at a time.
CREATE OR REPLACE FUNCTION public.remap_legacy_identity(_identity uuid, _reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.trainee_identities; _num text; _try integer := 0; _cn text; _old text;
BEGIN
  IF NOT public.is_identity_admin() THEN RAISE EXCEPTION 'Only the platform team can remap numbers' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 10 THEN RAISE EXCEPTION 'Record the reason (at least 10 characters)'; END IF;
  SELECT * INTO i FROM public.trainee_identities WHERE id = _identity FOR UPDATE;
  IF NOT FOUND OR i.number_format <> 'legacy' OR i.status <> 'active' THEN RAISE EXCEPTION 'Only an active legacy-format identity can be remapped'; END IF;
  IF i.first_year_source = 'needs_review' THEN RAISE EXCEPTION 'The first registration year of this identity needs review before it can be remapped'; END IF;
  _old := i.trainee_number;
  LOOP
    _try := _try + 1; _num := i.first_registration_year::text || public.secure_digits5();
    BEGIN
      INSERT INTO public.trainee_number_ledger (number, identity_id, kind) VALUES (_num, _identity, 'canonical');
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS _cn = CONSTRAINT_NAME;
      IF _cn <> 'trainee_number_ledger_pkey' OR _try >= 25 THEN RAISE; END IF;
    END;
  END LOOP;
  UPDATE public.trainee_number_ledger SET kind = 'legacy_alias', reason = 'Replaced by ' || _num || ': ' || trim(_reason) WHERE number = _old;
  PERFORM set_config('app.identity_maintenance', 'on', true);
  UPDATE public.trainee_identities SET trainee_number = _num, number_format = 'global9', updated_at = now() WHERE id = _identity;
  UPDATE public.trainees SET trainee_id = _num WHERE identity_id = _identity;
  PERFORM public.identity_log('number_remapped', _identity, NULL, NULL, NULL, 'success', trim(_reason), jsonb_build_object('old_number', _old, 'new_number', _num));
  RETURN jsonb_build_object('old_number', _old, 'new_number', _num);
END $$;
GRANT EXECUTE ON FUNCTION public.remap_legacy_identity(uuid, text) TO authenticated;

-- numbers and capacity: 100,000 suffixes exist per year
CREATE OR REPLACE FUNCTION public.trainee_number_capacity() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_identity_admin() THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'years', coalesce((SELECT jsonb_agg(jsonb_build_object('year', y, 'issued', n, 'capacity', 100000, 'used_pct', round(100.0 * n / 100000, 2), 'warning', n >= 50000) ORDER BY y DESC)
      FROM (SELECT left(number, 4) AS y, count(*) AS n FROM public.trainee_number_ledger WHERE number ~ '^[0-9]{9}$' GROUP BY 1) s), '[]'::jsonb),
    'global_identities', (SELECT count(*) FROM public.trainee_identities WHERE status <> 'merged'),
    'with_active_registration', (SELECT count(DISTINCT identity_id) FROM public.trainees WHERE public.registration_is_active(status::text)),
    'registration_records', (SELECT count(*) FROM public.trainees),
    'legacy_format_identities', (SELECT count(*) FROM public.trainee_identities WHERE number_format = 'legacy' AND status <> 'merged'),
    'open_reviews', (SELECT count(*) FROM public.identity_review_cases WHERE status = 'open'),
    'failed_transfers', (SELECT count(*) FROM public.trainee_transfers WHERE status = 'FAILED'),
    'migration_report', (SELECT report FROM public.identity_migration_report ORDER BY generated_at DESC LIMIT 1));
END $$;
GRANT EXECUTE ON FUNCTION public.trainee_number_capacity() TO authenticated;


-- the identity behind a registration record: number, earlier numbers and the person's registrations across VTCs
CREATE OR REPLACE FUNCTION public.trainee_identity_summary(_trainee uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trainees%ROWTYPE; i public.trainee_identities;
BEGIN
  SELECT * INTO t FROM public.trainees WHERE id = _trainee;
  IF NOT FOUND OR NOT (t.user_id = auth.uid() OR public.is_identity_admin()
      OR public.has_org_role(auth.uid(), t.organization_id, ARRAY['registration_officer', 'head_of_trainee_support', 'head_of_training', 'hod', 'centre_manager', 'organization_admin', 'admin', 'debtor_officer'])) THEN
    RAISE EXCEPTION 'Trainee not found';
  END IF;
  SELECT * INTO i FROM public.trainee_identities WHERE id = t.identity_id;
  RETURN jsonb_build_object('trainee_number', i.trainee_number, 'number_format', i.number_format, 'first_registration_year', i.first_registration_year, 'identity_verified', i.identity_verified,
    'earlier_numbers', coalesce((SELECT jsonb_agg(l.number ORDER BY l.issued_at) FROM public.trainee_number_ledger l WHERE l.identity_id = i.id AND l.kind <> 'canonical'), '[]'::jsonb),
    'registrations', coalesce((SELECT jsonb_agg(jsonb_build_object('organization_name', o.name, 'status', x.status, 'since', x.created_at, 'this_record', x.id = t.id) ORDER BY x.created_at)
        FROM public.trainees x JOIN public.organizations o ON o.id = x.organization_id WHERE x.identity_id = t.identity_id), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.trainee_identity_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. Row level security: reads only, writes only through the functions above
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainee_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainee_number_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_review_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_migration_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainee_transfers ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.trainee_identities, public.trainee_number_ledger, public.identity_review_cases, public.identity_audit_events, public.identity_migration_report, public.trainee_transfers FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.identity_visible(_identity uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_identity_admin() OR EXISTS (
    SELECT 1 FROM public.trainees t WHERE t.identity_id = _identity AND (t.user_id = auth.uid()
      OR public.has_org_role(auth.uid(), t.organization_id, ARRAY['registration_officer', 'head_of_trainee_support', 'head_of_training', 'hod', 'centre_manager', 'organization_admin', 'admin']))))
$$;
REVOKE ALL ON FUNCTION public.identity_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.identity_visible(uuid) TO authenticated;

CREATE POLICY "Identity visible to the person and their VTC staff" ON public.trainee_identities FOR SELECT TO authenticated USING (public.identity_visible(id));
CREATE POLICY "Numbers visible with the identity" ON public.trainee_number_ledger FOR SELECT TO authenticated USING (public.identity_visible(identity_id));
CREATE POLICY "Review cases for the VTC and the platform team" ON public.identity_review_cases FOR SELECT TO authenticated
  USING (public.is_identity_admin() OR public.has_org_role(auth.uid(), organization_id, ARRAY['head_of_trainee_support', 'registration_officer']));
CREATE POLICY "Audit trail for the platform team and VTC leaders" ON public.identity_audit_events FOR SELECT TO authenticated
  USING (public.is_identity_admin() OR (organization_id IS NOT NULL AND public.has_org_role(auth.uid(), organization_id, ARRAY['head_of_training', 'hod', 'head_of_trainee_support', 'centre_manager', 'organization_admin', 'admin'])));
CREATE POLICY "Migration report for the platform team" ON public.identity_migration_report FOR SELECT TO authenticated USING (public.is_identity_admin());
CREATE POLICY "Transfers visible to the trainee and the VTCs involved" ON public.trainee_transfers FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.is_identity_admin()
    OR public.has_org_role(auth.uid(), source_org, ARRAY['head_of_training', 'hod', 'head_of_trainee_support', 'registration_officer', 'centre_manager', 'organization_admin', 'admin'])
    OR (status NOT IN ('REJECTED', 'CANCELLED') AND public.has_org_role(auth.uid(), destination_org, ARRAY['registration_officer', 'head_of_trainee_support', 'centre_manager'])));
-- a staff member sees only transfers touching their own VTCs
CREATE POLICY "Centre isolation" ON public.trainee_transfers AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR requested_by = auth.uid() OR source_org = ANY ((SELECT public.my_centre_ids())::uuid[]) OR destination_org = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR requested_by = auth.uid() OR source_org = ANY ((SELECT public.my_centre_ids())::uuid[]) OR destination_org = ANY ((SELECT public.my_centre_ids())::uuid[]));
