-- Graduation module (spec section 5): ceremony attendance invitations with
-- Yes=1 / No=2 replies (5.1), surveys sent to graduates (5.2), survey reports (5.3).

CREATE OR REPLACE FUNCTION public.is_graduation_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.organization_id = _org
      AND ur.role::text IN ('admin','organization_admin','head_of_training','head_of_trainee_support','head_trainee_support','registration_officer','placement_officer')
  );
$$;

-- Messages waiting for an email/SMS dispatcher (no provider is wired up yet).
CREATE TABLE public.outbound_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX idx_outbound_messages_status ON public.outbound_messages (status, created_at);
ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Graduation staff view outbound messages" ON public.outbound_messages
FOR SELECT USING (public.is_graduation_staff(auth.uid(), organization_id));

-- Ceremonies
CREATE TABLE public.graduation_ceremonies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  graduation_year integer NOT NULL,
  ceremony_date timestamptz NOT NULL,
  venue text,
  notes text,
  invitations_sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.graduation_ceremonies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Graduation staff manage ceremonies" ON public.graduation_ceremonies
FOR ALL USING (public.is_graduation_staff(auth.uid(), organization_id))
WITH CHECK (public.is_graduation_staff(auth.uid(), organization_id));
CREATE TRIGGER update_graduation_ceremonies_updated_at BEFORE UPDATE ON public.graduation_ceremonies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.graduation_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ceremony_id uuid NOT NULL REFERENCES public.graduation_ceremonies(id) ON DELETE CASCADE,
  alumni_id uuid NOT NULL REFERENCES public.alumni(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  response_code smallint CHECK (response_code IN (1, 2)), -- 1 = attending (Yes), 2 = not attending (No)
  responded_at timestamptz,
  response_channel text CHECK (response_channel IN ('link','sms','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ceremony_id, alumni_id)
);
ALTER TABLE public.graduation_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Graduation staff manage invitations" ON public.graduation_invitations
FOR ALL USING (public.is_graduation_staff(auth.uid(), organization_id))
WITH CHECK (public.is_graduation_staff(auth.uid(), organization_id));

-- Surveys
CREATE TABLE public.graduate_surveys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  anonymous boolean NOT NULL DEFAULT false,
  target_graduation_year integer,
  target_trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  closes_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.graduate_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Graduation staff manage surveys" ON public.graduate_surveys
FOR ALL USING (public.is_graduation_staff(auth.uid(), organization_id))
WITH CHECK (public.is_graduation_staff(auth.uid(), organization_id));
CREATE TRIGGER update_graduate_surveys_updated_at BEFORE UPDATE ON public.graduate_surveys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.survey_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES public.graduate_surveys(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('text','single_choice','multiple_choice','rating','yes_no')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_survey_questions_survey ON public.survey_questions (survey_id, position);
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Graduation staff manage survey questions" ON public.survey_questions
FOR ALL USING (EXISTS (SELECT 1 FROM public.graduate_surveys s WHERE s.id = survey_id AND public.is_graduation_staff(auth.uid(), s.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.graduate_surveys s WHERE s.id = survey_id AND public.is_graduation_staff(auth.uid(), s.organization_id)));

CREATE TABLE public.survey_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES public.graduate_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alumni_id uuid NOT NULL REFERENCES public.alumni(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (survey_id, alumni_id)
);
ALTER TABLE public.survey_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Graduation staff view recipients" ON public.survey_recipients
FOR SELECT USING (public.is_graduation_staff(auth.uid(), organization_id));

-- Responses. recipient_id is left NULL for anonymous surveys so answers cannot be traced.
CREATE TABLE public.survey_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES public.graduate_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.survey_recipients(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb, -- { "<question_id>": string | number | string[] }
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_survey_responses_survey ON public.survey_responses (survey_id);
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Graduation staff view responses" ON public.survey_responses
FOR SELECT USING (public.is_graduation_staff(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_graduate_message(
  _org uuid, _alumni public.alumni, _subject text, _body text, _link text, _sms_body text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user uuid;
BEGIN
  SELECT user_id INTO _user FROM public.trainees WHERE id = _alumni.trainee_id;
  IF _user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
    VALUES (_user, _org, 'graduation', _subject, _body, _link);
  END IF;
  IF _alumni.email IS NOT NULL AND _alumni.email <> '' THEN
    INSERT INTO public.outbound_messages (organization_id, channel, recipient, subject, body)
    VALUES (_org, 'email', _alumni.email, _subject, _body || E'\n\n' || _link);
  END IF;
  IF _alumni.phone IS NOT NULL AND _alumni.phone <> '' THEN
    INSERT INTO public.outbound_messages (organization_id, channel, recipient, body)
    VALUES (_org, 'sms', _alumni.phone, _sms_body || ' ' || _link);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.queue_graduate_message(uuid, public.alumni, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5.1 Graduation attendance invitations (reply 1 = Yes, 2 = No)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_graduation_invitations(_ceremony uuid, _base_url text DEFAULT '')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.graduation_ceremonies%ROWTYPE; a public.alumni%ROWTYPE; inv public.graduation_invitations%ROWTYPE; n integer := 0;
BEGIN
  SELECT * INTO c FROM public.graduation_ceremonies WHERE id = _ceremony;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ceremony not found'; END IF;
  IF NOT public.is_graduation_staff(auth.uid(), c.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;

  FOR a IN SELECT * FROM public.alumni
           WHERE organization_id = c.organization_id AND graduation_year = c.graduation_year AND active
  LOOP
    INSERT INTO public.graduation_invitations (organization_id, ceremony_id, alumni_id)
    VALUES (c.organization_id, c.id, a.id)
    ON CONFLICT (ceremony_id, alumni_id) DO NOTHING;
    SELECT * INTO inv FROM public.graduation_invitations WHERE ceremony_id = c.id AND alumni_id = a.id;
    IF inv.response_code IS NULL THEN
      PERFORM public.queue_graduate_message(
        c.organization_id, a,
        'Graduation ceremony invitation',
        'You are invited to ' || c.title || ' on ' || to_char(c.ceremony_date, 'DD Mon YYYY HH24:MI')
          || COALESCE(' at ' || c.venue, '') || '. Please confirm whether you will attend.',
        _base_url || '/graduation/rsvp/' || inv.token,
        'Graduation ' || to_char(c.ceremony_date, 'DD Mon YYYY') || '. Reply 1 to attend or 2 to decline, or use:'
      );
      n := n + 1;
    END IF;
  END LOOP;
  UPDATE public.graduation_ceremonies SET invitations_sent_at = now() WHERE id = c.id;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.send_graduation_invitations(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_graduation_invitation(_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', c.title, 'ceremony_date', c.ceremony_date, 'venue', c.venue,
    'graduate_name', t.first_name || ' ' || t.last_name, 'response_code', i.response_code)
  FROM public.graduation_invitations i
  JOIN public.graduation_ceremonies c ON c.id = i.ceremony_id
  JOIN public.alumni a ON a.id = i.alumni_id
  JOIN public.trainees t ON t.id = a.trainee_id
  WHERE i.token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.get_graduation_invitation(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_graduation_invitation(_token text, _code smallint, _channel text DEFAULT 'link')
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _code NOT IN (1, 2) THEN RAISE EXCEPTION 'Reply 1 for Yes or 2 for No'; END IF;
  IF _channel NOT IN ('link','sms') THEN _channel := 'link'; END IF;
  UPDATE public.graduation_invitations
    SET response_code = _code, responded_at = now(), response_channel = _channel
    WHERE token = _token;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION public.respond_graduation_invitation(text, smallint, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5.2 Send a survey to graduates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_graduate_survey(_survey uuid, _base_url text DEFAULT '')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.graduate_surveys%ROWTYPE; a public.alumni%ROWTYPE; r public.survey_recipients%ROWTYPE; n integer := 0;
BEGIN
  SELECT * INTO s FROM public.graduate_surveys WHERE id = _survey;
  IF NOT FOUND THEN RAISE EXCEPTION 'Survey not found'; END IF;
  IF NOT public.is_graduation_staff(auth.uid(), s.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF s.status = 'closed' THEN RAISE EXCEPTION 'Survey is closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.survey_questions WHERE survey_id = s.id) THEN
    RAISE EXCEPTION 'Add at least one question before sending';
  END IF;

  FOR a IN SELECT * FROM public.alumni
           WHERE organization_id = s.organization_id AND active
             AND (s.target_graduation_year IS NULL OR graduation_year = s.target_graduation_year)
             AND (s.target_trade_id IS NULL OR final_trade_id = s.target_trade_id)
  LOOP
    INSERT INTO public.survey_recipients (survey_id, organization_id, alumni_id)
    VALUES (s.id, s.organization_id, a.id)
    ON CONFLICT (survey_id, alumni_id) DO NOTHING;
    IF FOUND THEN
      SELECT * INTO r FROM public.survey_recipients WHERE survey_id = s.id AND alumni_id = a.id;
      PERFORM public.queue_graduate_message(
        s.organization_id, a, 'Graduate survey: ' || s.title,
        COALESCE(s.description, 'We would value your feedback.'),
        _base_url || '/survey/' || r.token,
        'Please complete our graduate survey:'
      );
      n := n + 1;
    END IF;
  END LOOP;
  UPDATE public.graduate_surveys SET status = 'open' WHERE id = s.id;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.send_graduate_survey(uuid, text) TO authenticated;

-- Public survey access by token
CREATE OR REPLACE FUNCTION public.get_survey_by_token(_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', s.title, 'description', s.description, 'anonymous', s.anonymous,
    'status', CASE WHEN s.status <> 'open' OR (s.closes_at IS NOT NULL AND s.closes_at < now()) THEN 'closed' ELSE 'open' END,
    'completed', r.completed_at IS NOT NULL,
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', q.id, 'text', q.question_text, 'type', q.question_type, 'options', q.options, 'required', q.required) ORDER BY q.position)
      FROM public.survey_questions q WHERE q.survey_id = s.id), '[]'::jsonb))
  FROM public.survey_recipients r JOIN public.graduate_surveys s ON s.id = r.survey_id
  WHERE r.token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.get_survey_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_survey_response(_token text, _answers jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.survey_recipients%ROWTYPE; s public.graduate_surveys%ROWTYPE; q record;
BEGIN
  SELECT * INTO r FROM public.survey_recipients WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid survey link'; END IF;
  IF r.completed_at IS NOT NULL THEN RAISE EXCEPTION 'This survey has already been completed'; END IF;
  SELECT * INTO s FROM public.graduate_surveys WHERE id = r.survey_id;
  IF s.status <> 'open' OR (s.closes_at IS NOT NULL AND s.closes_at < now()) THEN RAISE EXCEPTION 'This survey is closed'; END IF;

  FOR q IN SELECT id, question_text FROM public.survey_questions WHERE survey_id = s.id AND required LOOP
    IF NOT (_answers ? q.id::text) OR _answers->>(q.id::text) IS NULL OR _answers->>(q.id::text) IN ('', '[]') THEN
      RAISE EXCEPTION 'Please answer: %', q.question_text;
    END IF;
  END LOOP;

  INSERT INTO public.survey_responses (survey_id, organization_id, recipient_id, answers)
  VALUES (s.id, s.organization_id, CASE WHEN s.anonymous THEN NULL ELSE r.id END, _answers);
  UPDATE public.survey_recipients SET completed_at = now() WHERE id = r.id;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_survey_response(text, jsonb) TO anon, authenticated;
