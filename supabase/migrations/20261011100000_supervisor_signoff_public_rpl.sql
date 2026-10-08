-- Logbook sign-off by the workplace supervisor (no account needed) and public RPL applications (no account needed).

-- ---------------------------------------------------------------------------
-- Supervisor links: a long random token per placement, sent to the supervisor.
-- ---------------------------------------------------------------------------
CREATE TABLE public.logbook_supervisor_links (
  token text PRIMARY KEY DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.internship_placements(id) ON DELETE CASCADE,
  supervisor_name text,
  supervisor_email text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 days'),
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX idx_logbook_supervisor_links_placement ON public.logbook_supervisor_links (placement_id);
ALTER TABLE public.logbook_supervisor_links ENABLE ROW LEVEL SECURITY;
-- Tokens are secrets: only the trainee and the people who may review the logbook can list or revoke them; nobody inserts directly.
CREATE OR REPLACE FUNCTION public.can_manage_supervisor_link(_user_id uuid, _placement uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.internship_placements p JOIN public.trainees t ON t.id = p.trainee_id
    WHERE p.id = _placement AND (t.user_id = _user_id OR public.can_review_logbook(_user_id, p.organization_id, p.trainee_id)));
$$;
CREATE POLICY "Trainee and reviewers see supervisor links" ON public.logbook_supervisor_links FOR SELECT
  USING (public.can_manage_supervisor_link(auth.uid(), placement_id));
CREATE POLICY "Trainee and reviewers revoke supervisor links" ON public.logbook_supervisor_links FOR UPDATE
  USING (public.can_manage_supervisor_link(auth.uid(), placement_id)) WITH CHECK (revoked);

-- The trainee or a reviewer creates a link; the supervisor is emailed when an address is given.
CREATE OR REPLACE FUNCTION public.create_supervisor_link(_placement uuid, _name text, _email text, _base_url text DEFAULT '')
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.internship_placements%ROWTYPE; t public.trainees%ROWTYPE; _tok text; _mail text := NULLIF(trim(COALESCE(_email, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO p FROM public.internship_placements WHERE id = _placement;
  IF NOT FOUND THEN RAISE EXCEPTION 'Placement not found'; END IF;
  SELECT * INTO t FROM public.trainees WHERE id = p.trainee_id;
  IF NOT (t.user_id = auth.uid() OR public.can_review_logbook(auth.uid(), p.organization_id, p.trainee_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF p.status NOT IN ('approved','active','completed') THEN RAISE EXCEPTION 'The placement has not started yet'; END IF;
  IF _mail IS NOT NULL AND _mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email address'; END IF;

  INSERT INTO public.logbook_supervisor_links (organization_id, placement_id, supervisor_name, supervisor_email)
  VALUES (p.organization_id, p.id, NULLIF(trim(COALESCE(_name, '')), ''), lower(_mail)) RETURNING token INTO _tok;

  IF _mail IS NOT NULL THEN
    PERFORM public.notify_person(p.organization_id, NULL, _mail, 'logbook',
      'Logbook sign-off requested: ' || t.first_name || ' ' || t.last_name,
      'Dear ' || COALESCE(NULLIF(trim(COALESCE(_name, '')), ''), 'supervisor') || ', ' || t.first_name || ' ' || t.last_name
        || ' asks you to review and sign their industrial attachment logbook entries. Open this private link: '
        || COALESCE(NULLIF(_base_url, ''), '') || '/logbook/sign/' || _tok || ' (valid for 45 days).',
      NULL);
  END IF;
  RETURN _tok;
END $$;
GRANT EXECUTE ON FUNCTION public.create_supervisor_link(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.logbook_link_row(_token text)
RETURNS public.logbook_supervisor_links
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.* FROM public.logbook_supervisor_links l WHERE l.token = _token AND NOT l.revoked AND l.expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.logbook_link_row(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_logbook_for_supervisor(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.logbook_supervisor_links%ROWTYPE; p public.internship_placements%ROWTYPE; t public.trainees%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.logbook_link_row(_token);
  IF l.token IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.internship_placements WHERE id = l.placement_id;
  SELECT * INTO t FROM public.trainees WHERE id = p.trainee_id;
  UPDATE public.logbook_supervisor_links SET last_used_at = now() WHERE token = _token;
  RETURN jsonb_build_object(
    'supervisor_name', l.supervisor_name, 'expires_at', l.expires_at,
    'trainee_name', t.first_name || ' ' || t.last_name, 'trainee_number', t.trainee_id,
    'placement_number', p.placement_number, 'start_date', p.start_date, 'end_date', p.end_date,
    'employer', (SELECT e.name FROM public.employers e WHERE e.id = p.employer_id),
    'entries', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'entry_date', e.entry_date, 'hours', e.hours, 'activities', e.activities,
        'skills_learned', e.skills_learned, 'challenges', e.challenges, 'status', e.status,
        'supervisor_signed_by', e.supervisor_signed_by, 'supervisor_signed_on', e.supervisor_signed_on,
        'reviewer_comment', e.reviewer_comment) ORDER BY e.entry_date)
      FROM public.logbook_entries e WHERE e.placement_id = p.id AND e.status <> 'draft'), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.get_logbook_for_supervisor(text) TO anon, authenticated;

-- Sign (or send back) the entries that are waiting for the supervisor. Returns how many were changed.
CREATE OR REPLACE FUNCTION public.supervisor_sign_entries(_token text, _entry_ids uuid[], _signer text, _return boolean DEFAULT false, _comment text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.logbook_supervisor_links%ROWTYPE; n integer;
BEGIN
  SELECT * INTO l FROM public.logbook_link_row(_token);
  IF l.token IS NULL THEN RAISE EXCEPTION 'This link is not valid or has expired'; END IF;
  IF COALESCE(trim(_signer), '') = '' THEN RAISE EXCEPTION 'Type your full name to sign'; END IF;
  IF _return AND COALESCE(trim(_comment), '') = '' THEN RAISE EXCEPTION 'Say what the trainee should correct'; END IF;
  IF _entry_ids IS NULL OR cardinality(_entry_ids) = 0 THEN RAISE EXCEPTION 'Choose at least one entry'; END IF;
  IF cardinality(_entry_ids) > 200 THEN RAISE EXCEPTION 'Too many entries at once'; END IF;

  IF _return THEN
    UPDATE public.logbook_entries SET status = 'returned', reviewer_comment = _signer || ' (supervisor): ' || _comment
     WHERE placement_id = l.placement_id AND id = ANY (_entry_ids) AND status = 'submitted';
  ELSE
    UPDATE public.logbook_entries SET status = 'supervisor_signed', supervisor_signed_by = trim(_signer), supervisor_signed_on = CURRENT_DATE,
           reviewer_comment = COALESCE(NULLIF(trim(_comment), ''), reviewer_comment)
     WHERE placement_id = l.placement_id AND id = ANY (_entry_ids) AND status = 'submitted';
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.logbook_supervisor_links SET last_used_at = now() WHERE token = _token;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.supervisor_sign_entries(text, uuid[], text, boolean, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public RPL applications (no account). Staff work them from the Assessment requests screen.
-- ---------------------------------------------------------------------------
CREATE TABLE public.public_rpl_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_number text NOT NULL,
  applicant_name text NOT NULL,
  national_id text,
  phone text,
  email text,
  qualification_id uuid REFERENCES public.qualifications(id) ON DELETE SET NULL,
  occupation text,
  years_experience integer CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 70),
  motivation text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','rejected')),
  staff_notes text,
  converted_request_id uuid REFERENCES public.assessment_requests(id) ON DELETE SET NULL,
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference_number)
);
CREATE INDEX idx_public_rpl_org_status ON public.public_rpl_applications (organization_id, status, created_at);
ALTER TABLE public.public_rpl_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff view public RPL applications" ON public.public_rpl_applications FOR SELECT
  USING (public.is_assessment_staff(auth.uid(), organization_id));
CREATE POLICY "Assessment staff update public RPL applications" ON public.public_rpl_applications FOR UPDATE
  USING (public.is_assessment_staff(auth.uid(), organization_id)) WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));

-- _website is a honeypot field hidden from people on the form: bots fill it in and are silently dropped.
CREATE OR REPLACE FUNCTION public.submit_public_rpl_application(
  _org_slug text, _name text, _national_id text, _phone text, _email text, _qualification uuid,
  _occupation text, _years integer, _motivation text, _website text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _ref text; _tries integer := 0; _mail text := NULLIF(lower(trim(COALESCE(_email, ''))), ''); _tel text := NULLIF(trim(COALESCE(_phone, '')), ''); r record;
BEGIN
  IF COALESCE(_website, '') <> '' THEN RETURN 'RPL-PUB-00-00000'; END IF;
  SELECT id INTO _org FROM public.organizations WHERE subdomain = _org_slug AND active;
  IF _org IS NULL THEN RAISE EXCEPTION 'Training centre not found'; END IF;
  IF COALESCE(trim(_name), '') = '' OR COALESCE(trim(_motivation), '') = '' THEN RAISE EXCEPTION 'Name and motivation are required'; END IF;
  IF _mail IS NULL AND _tel IS NULL THEN RAISE EXCEPTION 'Give an email address or phone number so we can reach you'; END IF;
  IF _mail IS NOT NULL AND _mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email address'; END IF;
  IF length(_motivation) > 4000 OR length(_name) > 200 OR length(COALESCE(_occupation, '')) > 200 THEN RAISE EXCEPTION 'Some answers are too long'; END IF;
  IF _qualification IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.qualifications q WHERE q.id = _qualification AND q.organization_id = _org) THEN
    RAISE EXCEPTION 'Qualification not found';
  END IF;
  -- the same person cannot flood the inbox, and neither can one source
  IF EXISTS (SELECT 1 FROM public.public_rpl_applications a WHERE a.organization_id = _org AND a.created_at > now() - interval '1 day'
             AND ((_mail IS NOT NULL AND a.email = _mail) OR (_tel IS NOT NULL AND a.phone = _tel)
                  OR (NULLIF(trim(COALESCE(_national_id, '')), '') IS NOT NULL AND a.national_id = trim(_national_id)))) THEN
    RAISE EXCEPTION 'We already received an application from you today. We will contact you soon.';
  END IF;
  IF (SELECT count(*) FROM public.public_rpl_applications a WHERE a.organization_id = _org AND a.created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Many applications are arriving right now. Please try again in an hour.';
  END IF;

  LOOP
    _ref := 'RPL-PUB-' || to_char(now(), 'YY') || '-' || lpad(floor(random() * 100000)::int::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.public_rpl_applications WHERE organization_id = _org AND reference_number = _ref);
    _tries := _tries + 1;
    IF _tries > 100 THEN RAISE EXCEPTION 'Could not allocate a reference number'; END IF;
  END LOOP;

  INSERT INTO public.public_rpl_applications (organization_id, reference_number, applicant_name, national_id, phone, email, qualification_id, occupation, years_experience, motivation)
  VALUES (_org, _ref, trim(_name), NULLIF(trim(COALESCE(_national_id, '')), ''), _tel, _mail, _qualification, NULLIF(trim(COALESCE(_occupation, '')), ''), _years, trim(_motivation));

  IF _mail IS NOT NULL THEN
    PERFORM public.notify_person(_org, NULL, _mail, 'rpl', 'RPL application received: ' || _ref,
      'Dear ' || trim(_name) || ', we received your Recognition of Prior Learning application. Your reference is ' || _ref || '. Our RPL coordinator will contact you.', NULL);
  END IF;
  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = _org AND ur.role::text = 'rpl_coordinator' LOOP
    PERFORM public.notify_person(_org, r.user_id, NULL, 'rpl', 'New public RPL application: ' || trim(_name),
      'Reference ' || _ref || '. Open Assessment requests to review it.', '/assessment-requests');
  END LOOP;
  RETURN _ref;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_public_rpl_application(text, text, text, text, text, uuid, text, integer, text, text) TO anon, authenticated;

-- Public list of qualifications a visitor can choose from
CREATE OR REPLACE FUNCTION public.list_public_qualifications(_org_slug text)
RETURNS TABLE (id uuid, title text, code text, nqf_level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.qualification_title, q.qualification_code, q.nqf_level
  FROM public.qualifications q JOIN public.organizations o ON o.id = q.organization_id
  WHERE o.subdomain = _org_slug AND o.active AND q.active AND q.status = 'approved'
  ORDER BY q.qualification_title;
$$;
GRANT EXECUTE ON FUNCTION public.list_public_qualifications(text) TO anon, authenticated;

-- Staff turn an application into a normal RPL request (the applicant is followed up by phone / email)
CREATE OR REPLACE FUNCTION public.convert_public_rpl_application(_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.public_rpl_applications%ROWTYPE; _req uuid;
BEGIN
  SELECT * INTO a FROM public.public_rpl_applications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF NOT public.is_assessment_staff(auth.uid(), a.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF a.status = 'converted' THEN RAISE EXCEPTION 'Already converted'; END IF;
  INSERT INTO public.assessment_requests (organization_id, request_type, applicant_name, national_id, phone, email, qualification_id, motivation, created_by)
  VALUES (a.organization_id, 'rpl', a.applicant_name, a.national_id, a.phone, a.email, a.qualification_id,
          a.motivation || COALESCE(E'\nOccupation: ' || a.occupation, '') || COALESCE(E'\nYears of experience: ' || a.years_experience, '')
            || E'\nPublic application ' || a.reference_number, auth.uid())
  RETURNING id INTO _req;
  UPDATE public.public_rpl_applications SET status = 'converted', converted_request_id = _req, handled_by = auth.uid() WHERE id = a.id;
  RETURN _req;
END $$;
GRANT EXECUTE ON FUNCTION public.convert_public_rpl_application(uuid) TO authenticated;
