-- Proof of registration: one shared document for every centre.
--  * The layout is the same everywhere; the letterhead (logo, name, address, contacts), the registration clerk and the
--    signatory come from per-centre settings that the Organization Admin maintains (`proof_of_registration_settings`).
--  * `proof_of_registration_data` assembles the document from live records for the registration's own centre: trainee,
--    qualification, unit standards, and the fee transactions with debit/credit totals and the outstanding balance.
--  * Prints and downloads are logged (append-only); settings changes are audited by the admin audit trigger.

-- ---------------------------------------------------------------------------
-- 1. Settings (one row per centre)
-- ---------------------------------------------------------------------------
CREATE TABLE public.proof_of_registration_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  logo_url text,
  centre_name text,
  physical_address text,
  postal_address text,
  telephone text,
  fax text,
  email text,
  website text,
  correspondence_note text NOT NULL DEFAULT 'All Correspondence must be addressed to the Centre Manager',
  clerk_title text, clerk_name text, clerk_role_label text NOT NULL DEFAULT 'Registration Clerk', clerk_phone text, clerk_email text,
  signatory_title text, signatory_name text, signatory_job_title text NOT NULL DEFAULT 'Head of Trainee Support',
  signature_url text,
  stamp_label text NOT NULL DEFAULT 'OFFICIAL STAMP',
  currency_label text NOT NULL DEFAULT 'N$',
  footer_disclaimer text NOT NULL DEFAULT 'This document is generated from the centre''s records. A copy without the official stamp is not valid.',
  primary_color text NOT NULL DEFAULT '#034EA1' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text NOT NULL DEFAULT '#EE4023' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proof_of_registration_settings ENABLE ROW LEVEL SECURITY;
-- clients read the settings of their own centre (the admin form and the preview); every change goes through save_proof_settings
CREATE POLICY "Centre staff read proof settings" ON public.proof_of_registration_settings FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['organization_admin','admin','head_of_trainee_support','registration_officer','centre_manager']));
CREATE POLICY "Centre isolation" ON public.proof_of_registration_settings AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
DROP TRIGGER IF EXISTS trg_audit_admin_change ON public.proof_of_registration_settings;
CREATE TRIGGER trg_audit_admin_change AFTER INSERT OR UPDATE OR DELETE ON public.proof_of_registration_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

-- who printed or downloaded which registration
CREATE TABLE public.proof_of_registration_prints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid(),
  action text NOT NULL CHECK (action IN ('print','download')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_proof_prints_reg ON public.proof_of_registration_prints (registration_id, created_at DESC);
ALTER TABLE public.proof_of_registration_prints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Registration staff read print log" ON public.proof_of_registration_prints FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['organization_admin','admin','head_of_trainee_support','registration_officer','centre_manager']));
CREATE POLICY "Centre isolation" ON public.proof_of_registration_prints AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
CREATE OR REPLACE FUNCTION public.proof_prints_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'The print log cannot be changed'; END $$;
CREATE TRIGGER trg_proof_prints_append_only BEFORE UPDATE OR DELETE ON public.proof_of_registration_prints
  FOR EACH ROW EXECUTE FUNCTION public.proof_prints_append_only();

-- ---------------------------------------------------------------------------
-- 2. Settings: only the centre's Organization Admin (or a super admin) changes them
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proof_settings_can_edit(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.has_org_role(auth.uid(), _org, ARRAY['organization_admin','admin']))
$$;
REVOKE ALL ON FUNCTION public.proof_settings_can_edit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proof_settings_can_edit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.proof_settings_complete(s public.proof_of_registration_settings) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT s.organization_id IS NOT NULL AND coalesce(trim(s.centre_name), '') <> '' AND coalesce(trim(s.logo_url), '') <> ''
     AND coalesce(trim(s.physical_address), '') <> '' AND coalesce(trim(s.telephone), '') <> '' AND coalesce(trim(s.email), '') <> ''
     AND coalesce(trim(s.signatory_name), '') <> ''
$$;

CREATE OR REPLACE FUNCTION public.save_proof_settings(_org uuid, _s jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k text; v text;
  _text text[] := ARRAY['centre_name','physical_address','postal_address','telephone','fax','email','website','correspondence_note','clerk_title','clerk_name',
    'clerk_role_label','clerk_phone','clerk_email','signatory_title','signatory_name','signatory_job_title','stamp_label','currency_label','footer_disclaimer'];
  _row public.proof_of_registration_settings;
BEGIN
  IF NOT public.proof_settings_can_edit(_org) THEN RAISE EXCEPTION 'Only the Organization Admin can change the proof of registration settings'; END IF;
  PERFORM public.assert_centre_access(_org);
  FOR k IN SELECT jsonb_object_keys(_s) LOOP
    IF NOT (k = ANY (_text) OR k IN ('logo_url','signature_url','primary_color','accent_color')) THEN RAISE EXCEPTION 'Unknown setting: %', k; END IF;
  END LOOP;
  IF coalesce(trim(_s->>'centre_name'), '') = '' THEN RAISE EXCEPTION 'Enter the centre name'; END IF;
  IF coalesce(trim(_s->>'physical_address'), '') = '' THEN RAISE EXCEPTION 'Enter the physical address'; END IF;
  IF coalesce(trim(_s->>'telephone'), '') = '' THEN RAISE EXCEPTION 'Enter the telephone number'; END IF;
  IF coalesce(trim(_s->>'signatory_name'), '') = '' THEN RAISE EXCEPTION 'Enter the name of the signatory'; END IF;
  FOREACH k IN ARRAY ARRAY['email','clerk_email'] LOOP
    v := trim(coalesce(_s->>k, ''));
    IF v <> '' AND v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email address (%)', replace(k, '_', ' '); END IF;
  END LOOP;
  IF coalesce(trim(_s->>'email'), '') = '' THEN RAISE EXCEPTION 'Enter the centre email address'; END IF;
  FOREACH k IN ARRAY ARRAY['telephone','fax','clerk_phone'] LOOP
    v := trim(coalesce(_s->>k, ''));
    IF v <> '' AND v !~ '^[0-9+()/ .-]{5,25}$' THEN RAISE EXCEPTION 'Enter a valid phone number (%)', replace(k, '_', ' '); END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['logo_url','signature_url'] LOOP
    v := trim(coalesce(_s->>k, ''));
    IF v <> '' AND (v !~ '^https://' OR position('/organization-logos/' || _org::text || '/' IN v) = 0) THEN RAISE EXCEPTION 'Upload the image through the settings page (%)', replace(k, '_', ' '); END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['primary_color','accent_color'] LOOP
    IF _s ? k AND (_s->>k) !~ '^#[0-9A-Fa-f]{6}$' THEN RAISE EXCEPTION 'Colours must look like #034EA1'; END IF;
  END LOOP;

  INSERT INTO public.proof_of_registration_settings (organization_id, updated_by) VALUES (_org, auth.uid()) ON CONFLICT (organization_id) DO NOTHING;
  UPDATE public.proof_of_registration_settings s SET
    logo_url = CASE WHEN _s ? 'logo_url' THEN nullif(trim(_s->>'logo_url'), '') ELSE s.logo_url END,
    centre_name = trim(_s->>'centre_name'),
    physical_address = trim(_s->>'physical_address'),
    postal_address = nullif(trim(coalesce(_s->>'postal_address', '')), ''),
    telephone = trim(_s->>'telephone'),
    fax = nullif(trim(coalesce(_s->>'fax', '')), ''),
    email = trim(_s->>'email'),
    website = nullif(trim(coalesce(_s->>'website', '')), ''),
    correspondence_note = coalesce(nullif(trim(coalesce(_s->>'correspondence_note', '')), ''), s.correspondence_note),
    clerk_title = nullif(trim(coalesce(_s->>'clerk_title', '')), ''), clerk_name = nullif(trim(coalesce(_s->>'clerk_name', '')), ''),
    clerk_role_label = coalesce(nullif(trim(coalesce(_s->>'clerk_role_label', '')), ''), s.clerk_role_label),
    clerk_phone = nullif(trim(coalesce(_s->>'clerk_phone', '')), ''), clerk_email = nullif(trim(coalesce(_s->>'clerk_email', '')), ''),
    signatory_title = nullif(trim(coalesce(_s->>'signatory_title', '')), ''), signatory_name = trim(_s->>'signatory_name'),
    signatory_job_title = coalesce(nullif(trim(coalesce(_s->>'signatory_job_title', '')), ''), s.signatory_job_title),
    signature_url = CASE WHEN _s ? 'signature_url' THEN nullif(trim(_s->>'signature_url'), '') ELSE s.signature_url END,
    stamp_label = coalesce(nullif(trim(coalesce(_s->>'stamp_label', '')), ''), s.stamp_label),
    currency_label = coalesce(nullif(trim(coalesce(_s->>'currency_label', '')), ''), s.currency_label),
    footer_disclaimer = coalesce(nullif(trim(coalesce(_s->>'footer_disclaimer', '')), ''), s.footer_disclaimer),
    primary_color = coalesce(_s->>'primary_color', s.primary_color), accent_color = coalesce(_s->>'accent_color', s.accent_color),
    updated_by = auth.uid(), updated_at = now()
  WHERE s.organization_id = _org;
END $$;
GRANT EXECUTE ON FUNCTION public.save_proof_settings(uuid, jsonb) TO authenticated;

-- copies the letterhead settings from one centre to another the caller may edit (not the logo, signature or signatory)
CREATE OR REPLACE FUNCTION public.copy_proof_settings(_from uuid, _to uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.proof_of_registration_settings;
BEGIN
  IF NOT (public.proof_settings_can_edit(_from) AND public.proof_settings_can_edit(_to)) THEN RAISE EXCEPTION 'You can only copy between centres you administer'; END IF;
  SELECT * INTO src FROM public.proof_of_registration_settings WHERE organization_id = _from;
  IF NOT FOUND THEN RAISE EXCEPTION 'That centre has no settings to copy'; END IF;
  INSERT INTO public.proof_of_registration_settings (organization_id, correspondence_note, clerk_role_label, signatory_job_title, stamp_label, currency_label, footer_disclaimer, primary_color, accent_color, updated_by)
  VALUES (_to, src.correspondence_note, src.clerk_role_label, src.signatory_job_title, src.stamp_label, src.currency_label, src.footer_disclaimer, src.primary_color, src.accent_color, auth.uid())
  ON CONFLICT (organization_id) DO UPDATE SET correspondence_note = EXCLUDED.correspondence_note, clerk_role_label = EXCLUDED.clerk_role_label,
    signatory_job_title = EXCLUDED.signatory_job_title, stamp_label = EXCLUDED.stamp_label, currency_label = EXCLUDED.currency_label,
    footer_disclaimer = EXCLUDED.footer_disclaimer, primary_color = EXCLUDED.primary_color, accent_color = EXCLUDED.accent_color,
    updated_by = auth.uid(), updated_at = now();
END $$;
GRANT EXECUTE ON FUNCTION public.copy_proof_settings(uuid, uuid) TO authenticated;

-- one centre's settings for the admin form (also works for a centre that has none yet)
CREATE OR REPLACE FUNCTION public.proof_settings_get(_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.proof_of_registration_settings;
BEGIN
  IF NOT public.proof_settings_can_edit(_org) THEN RAISE EXCEPTION 'Only the Organization Admin can change the proof of registration settings'; END IF;
  SELECT * INTO s FROM public.proof_of_registration_settings WHERE organization_id = _org;
  RETURN jsonb_build_object('settings', CASE WHEN s.organization_id IS NULL THEN NULL ELSE to_jsonb(s) - 'updated_by' END,
    'centre_name', (SELECT name FROM public.organizations WHERE id = _org), 'configured', coalesce(public.proof_settings_complete(s), false));
END $$;
GRANT EXECUTE ON FUNCTION public.proof_settings_get(uuid) TO authenticated;

-- the centres the caller may configure, with whether each is ready to print
CREATE OR REPLACE FUNCTION public.proof_settings_overview() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('organization_id', o.id, 'name', o.name,
           'configured', coalesce(public.proof_settings_complete(s), false)) ORDER BY o.name), '[]'::jsonb)
  FROM public.organizations o LEFT JOIN public.proof_of_registration_settings s ON s.organization_id = o.id
  WHERE o.active AND public.proof_settings_can_edit(o.id)
$$;
GRANT EXECUTE ON FUNCTION public.proof_settings_overview() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. The document
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proof_of_registration_data(_registration uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reg public.registrations%ROWTYPE; t public.trainees%ROWTYPE; q public.qualifications%ROWTYPE; s public.proof_of_registration_settings;
  _own boolean; _ref text; _tries integer := 0; _acct uuid; _lines jsonb; _debit numeric := 0; _credit numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO reg FROM public.registrations WHERE id = _registration;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  SELECT * INTO t FROM public.trainees WHERE id = reg.trainee_id;
  _own := t.user_id = auth.uid();
  IF NOT (_own OR public.has_org_role(auth.uid(), reg.organization_id,
      ARRAY['registration_officer','head_of_trainee_support','debtor_officer','accountant','head_of_finance_admin','centre_manager','organization_admin','admin'])) THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;
  IF _own AND reg.registration_status <> 'registered' THEN
    RAISE EXCEPTION 'Your registration is not complete yet (%). A proof of registration can be printed once it is.', replace(reg.registration_status, '_', ' ');
  END IF;
  SELECT * INTO q FROM public.qualifications WHERE id = COALESCE(reg.qualification_id, t.qualification_id);
  SELECT * INTO s FROM public.proof_of_registration_settings WHERE organization_id = reg.organization_id;

  -- one stable reference number per trainee, year and qualification, issued once the registration is complete
  IF reg.registration_status = 'registered' AND q.id IS NOT NULL THEN
    SELECT reference_number INTO _ref FROM public.proof_of_registrations
      WHERE trainee_id = reg.trainee_id AND academic_year = reg.academic_year AND qualification_id IS NOT DISTINCT FROM q.id ORDER BY created_at LIMIT 1;
    IF _ref IS NULL THEN
      LOOP
        _ref := 'POR-' || to_char(now(), 'YY') || '-' || lpad(floor(random() * 100000)::int::text, 5, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.proof_of_registrations WHERE reference_number = _ref);
        _tries := _tries + 1;
        IF _tries > 100 THEN RAISE EXCEPTION 'Could not allocate a reference number'; END IF;
      END LOOP;
      INSERT INTO public.proof_of_registrations (organization_id, trainee_id, qualification_id, reference_number, academic_year, registration_date, generated_by)
      VALUES (reg.organization_id, reg.trainee_id, q.id, _ref, reg.academic_year, COALESCE(reg.registered_at::date, CURRENT_DATE), auth.uid());
    END IF;
  END IF;

  -- fees: the trainee's account ledger for this academic year (lines without a year are included)
  SELECT id INTO _acct FROM public.trainee_financial_accounts WHERE trainee_id = reg.trainee_id ORDER BY created_at LIMIT 1;
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'date'), (x->>'created_at')), '[]'::jsonb),
         coalesce(sum((x->>'debit')::numeric), 0), coalesce(sum((x->>'credit')::numeric), 0)
    INTO _lines, _debit, _credit
  FROM (
    SELECT jsonb_build_object(
      'date', ft.processed_at::date, 'created_at', ft.created_at, 'reference', ft.reference_number,
      'description', CASE ft.transaction_type
          WHEN 'charge' THEN coalesce(nullif(ft.description, ''), f.name, 'Fees charged')
          WHEN 'payment' THEN 'Payment received' || coalesce(' – ' || initcap(replace(ft.payment_method, '_', ' ')), '') || coalesce(' (' || nullif(ft.description, '') || ')', '')
          WHEN 'credit' THEN 'Credit' || coalesce(' – ' || nullif(ft.description, ''), '')
          WHEN 'waiver' THEN 'Waiver' || coalesce(' – ' || nullif(ft.description, ''), '')
          WHEN 'refund' THEN 'Refund' || coalesce(' – ' || nullif(ft.description, ''), '')
          ELSE 'Adjustment' || coalesce(' – ' || nullif(ft.description, ''), '') END,
      'debit', CASE WHEN ft.transaction_type IN ('charge','adjustment','refund') THEN ft.amount ELSE 0 END,
      'credit', CASE WHEN ft.transaction_type IN ('payment','credit','waiver') THEN ft.amount ELSE 0 END) AS x
    FROM public.financial_transactions ft LEFT JOIN public.fee_types f ON f.id = ft.fee_type_id
    WHERE ft.account_id = _acct AND (ft.academic_year IS NULL OR ft.academic_year = reg.academic_year)
  ) l;

  RETURN jsonb_build_object(
    'registration_id', reg.id, 'organization_id', reg.organization_id, 'reference_number', _ref, 'issued_on', CURRENT_DATE,
    'academic_year', reg.academic_year, 'registration_status', reg.registration_status,
    'year_of_study', (SELECT count(*) FROM public.registrations r2 WHERE r2.trainee_id = reg.trainee_id AND r2.academic_year <= reg.academic_year
                       AND r2.qualification_id IS NOT DISTINCT FROM reg.qualification_id AND r2.registration_status <> 'rejected'), 'registered_on', COALESCE(reg.registered_at, reg.created_at),
    'trainee', jsonb_build_object('name', t.first_name || ' ' || t.last_name, 'trainee_number', t.trainee_id, 'national_id', t.national_id,
      'level', t.level, 'training_mode', t.training_mode, 'occupational_area', (SELECT name FROM public.trades WHERE id = t.trade_id)),
    'qualification', CASE WHEN q.id IS NULL THEN NULL ELSE jsonb_build_object('code', q.qualification_code, 'title', q.qualification_title,
      'nqf_level', q.nqf_level, 'duration', q.duration_value || ' ' || q.duration_unit::text) END,
    'units', coalesce((SELECT jsonb_agg(jsonb_build_object('unit_id', qus.unit_standard_id, 'title', qus.unit_standard_title,
        'level', qus.level, 'credits', qus.credit_value) ORDER BY qus.created_at, qus.unit_standard_id)
      FROM public.qualification_unit_standards qus WHERE qus.qualification_id = q.id), '[]'::jsonb),
    'fees', jsonb_build_object('lines', _lines, 'total_debit', _debit, 'total_credit', _credit, 'balance', _debit - _credit),
    'settings', CASE WHEN s.organization_id IS NULL THEN NULL ELSE to_jsonb(s) - 'updated_by' END,
    'settings_complete', coalesce(public.proof_settings_complete(s), false),
    'centre_name', (SELECT name FROM public.organizations WHERE id = reg.organization_id));
END $$;
GRANT EXECUTE ON FUNCTION public.proof_of_registration_data(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_proof_print(_registration uuid, _action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  PERFORM public.proof_of_registration_data(_registration); -- same access rules as viewing it
  SELECT organization_id INTO _org FROM public.registrations WHERE id = _registration;
  INSERT INTO public.proof_of_registration_prints (organization_id, registration_id, action) VALUES (_org, _registration, _action);
END $$;
GRANT EXECUTE ON FUNCTION public.log_proof_print(uuid, text) TO authenticated;

-- Nakayale VTC starts with the details supplied for it; its logo is uploaded through the settings page
INSERT INTO public.proof_of_registration_settings (organization_id, centre_name, physical_address, postal_address, telephone, fax, email, website,
  clerk_title, clerk_name, clerk_phone, clerk_email, signatory_title, signatory_name)
SELECT id, 'Nakayale Vocational Training Centre', 'Oshakati-Ruacana Main Road, Ontapi, Namibia', 'P.O. Box 910', '065 250 067', '065 250 062',
  'info@nvtc.edu.na', 'www.nvtc.edu.na', 'Ms.', 'Victoria Akathingo', '+26465250067', 'vakathingo@nvtc.edu.na', 'Ms.', 'Soniah Shitaleni'
FROM public.organizations WHERE name ILIKE 'nakayale%' LIMIT 1
ON CONFLICT (organization_id) DO NOTHING;
