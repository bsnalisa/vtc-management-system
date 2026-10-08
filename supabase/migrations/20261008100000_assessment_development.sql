-- Assessment development & delivery (spec 4.1-4.5, 4.7, 4.9, 4.10):
-- SME registration, development plans, question bank, paper generation,
-- assessment sittings with candidates, theory roster, induction plan, printing-officer notice.

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org uuid, _roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = _user_id AND ur.organization_id = _org AND ur.role::text = ANY (_roles));
$$;

-- ---------------------------------------------------------------------------
-- 4.1 / 4.2 Subject Matter Expert registration and approval
-- ---------------------------------------------------------------------------
CREATE TABLE public.sme_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  national_id text,
  expertise text NOT NULL,
  experience text NOT NULL,
  qualification_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  user_id uuid, -- set once the applicant has an account holding the SME role
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sme_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff view SME applications" ON public.sme_applications
FOR SELECT USING (public.is_assessment_staff(auth.uid(), organization_id));

-- Public registration (no login): the applicant is identified only by the centre link name.
CREATE OR REPLACE FUNCTION public.submit_sme_application(
  _org_slug text, _full_name text, _email text, _phone text, _national_id text, _expertise text, _experience text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT id INTO _org FROM public.organizations WHERE subdomain = _org_slug AND active;
  IF _org IS NULL THEN RAISE EXCEPTION 'Training centre not found'; END IF;
  IF COALESCE(trim(_full_name), '') = '' OR COALESCE(trim(_email), '') = '' OR COALESCE(trim(_expertise), '') = '' OR COALESCE(trim(_experience), '') = '' THEN
    RAISE EXCEPTION 'Name, email, area of expertise and experience are required';
  END IF;
  IF _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email address'; END IF;
  IF EXISTS (SELECT 1 FROM public.sme_applications WHERE organization_id = _org AND lower(email) = lower(_email) AND status = 'pending') THEN
    RAISE EXCEPTION 'An application for this email is already awaiting review';
  END IF;
  INSERT INTO public.sme_applications (organization_id, full_name, email, phone, national_id, expertise, experience)
  VALUES (_org, trim(_full_name), lower(trim(_email)), _phone, _national_id, trim(_expertise), trim(_experience));
  RETURN 'submitted';
END $$;
GRANT EXECUTE ON FUNCTION public.submit_sme_application(text, text, text, text, text, text, text) TO anon, authenticated;

-- Approve / reject. Approval grants the SME role when the applicant already has an account;
-- otherwise the application is approved and staff create the account with the SME role.
CREATE OR REPLACE FUNCTION public.review_sme_application(_id uuid, _approve boolean, _notes text, _qualification_ids uuid[] DEFAULT '{}')
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.sme_applications%ROWTYPE; _uid uuid;
BEGIN
  SELECT * INTO a FROM public.sme_applications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF NOT public.is_assessment_staff(auth.uid(), a.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF a.status <> 'pending' THEN RAISE EXCEPTION 'Application was already reviewed'; END IF;
  IF NOT _approve AND COALESCE(trim(_notes), '') = '' THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;

  IF _approve THEN
    SELECT user_id INTO _uid FROM public.profiles WHERE lower(email) = lower(a.email) LIMIT 1;
    IF _uid IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role, organization_id)
      VALUES (_uid, 'subject_matter_expert'::public.app_role, a.organization_id)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  UPDATE public.sme_applications
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        review_notes = _notes, reviewed_by = auth.uid(), reviewed_at = now(),
        qualification_ids = COALESCE(_qualification_ids, '{}'), user_id = _uid
    WHERE id = _id;
  RETURN CASE WHEN NOT _approve THEN 'rejected'
              WHEN _uid IS NULL THEN 'approved_without_account'
              ELSE 'approved_role_granted' END;
END $$;
GRANT EXECUTE ON FUNCTION public.review_sme_application(uuid, boolean, text, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4.3 Assessment materials development plan
-- ---------------------------------------------------------------------------
CREATE TABLE public.assessment_development_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  qualification_id uuid NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  unit_standard_id uuid REFERENCES public.unit_standards(id) ON DELETE SET NULL,
  academic_year text NOT NULL,
  assessment_type text NOT NULL CHECK (assessment_type IN ('theory','practical')),
  assigned_to uuid, -- the SME
  questions_required integer NOT NULL DEFAULT 20 CHECK (questions_required > 0),
  due_date date,
  brief text,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','submitted','approved','rejected')),
  review_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_development_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff manage plans" ON public.assessment_development_plans
FOR ALL USING (public.is_assessment_staff(auth.uid(), organization_id))
WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));
CREATE POLICY "SMEs view assigned plans" ON public.assessment_development_plans
FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "SMEs progress assigned plans" ON public.assessment_development_plans
FOR UPDATE USING (assigned_to = auth.uid() AND status IN ('assigned','in_progress','rejected'))
WITH CHECK (assigned_to = auth.uid() AND status IN ('in_progress','submitted'));
CREATE OR REPLACE FUNCTION public.guard_development_plan()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL AND NOT public.is_assessment_staff(auth.uid(), NEW.organization_id) THEN
    -- SMEs can only move their own plan along; everything else is fixed
    NEW.organization_id := OLD.organization_id; NEW.qualification_id := OLD.qualification_id;
    NEW.unit_standard_id := OLD.unit_standard_id; NEW.academic_year := OLD.academic_year;
    NEW.assessment_type := OLD.assessment_type; NEW.assigned_to := OLD.assigned_to;
    NEW.questions_required := OLD.questions_required; NEW.due_date := OLD.due_date;
    NEW.brief := OLD.brief; NEW.review_notes := OLD.review_notes; NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_development_plan BEFORE UPDATE ON public.assessment_development_plans
FOR EACH ROW EXECUTE FUNCTION public.guard_development_plan();

-- ---------------------------------------------------------------------------
-- 4.4 Question bank
-- ---------------------------------------------------------------------------
CREATE TABLE public.question_bank_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  qualification_id uuid NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  unit_standard_id uuid REFERENCES public.unit_standards(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.assessment_development_plans(id) ON DELETE SET NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice','true_false','short_answer','practical_task')),
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  marks integer NOT NULL DEFAULT 1 CHECK (marks > 0),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  review_notes text,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_question_bank_lookup ON public.question_bank_items (organization_id, qualification_id, unit_standard_id, status);
ALTER TABLE public.question_bank_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff manage questions" ON public.question_bank_items
FOR ALL USING (public.is_assessment_staff(auth.uid(), organization_id))
WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));
-- SMEs see and edit only their own questions, so they cannot read other experts' exam content.
CREATE POLICY "SMEs view own questions" ON public.question_bank_items
FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "SMEs add own questions" ON public.question_bank_items
FOR INSERT WITH CHECK (
  author_id = auth.uid() AND status IN ('draft','submitted')
  AND public.has_org_role(auth.uid(), organization_id, ARRAY['subject_matter_expert'])
);
CREATE POLICY "SMEs edit own unreviewed questions" ON public.question_bank_items
FOR UPDATE USING (author_id = auth.uid() AND status IN ('draft','rejected'))
WITH CHECK (author_id = auth.uid() AND status IN ('draft','submitted'));
CREATE POLICY "SMEs delete own drafts" ON public.question_bank_items
FOR DELETE USING (author_id = auth.uid() AND status = 'draft');
CREATE OR REPLACE FUNCTION public.guard_question_item()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL AND NOT public.is_assessment_staff(auth.uid(), NEW.organization_id) THEN
    NEW.review_notes := OLD.review_notes; NEW.reviewed_by := OLD.reviewed_by;
    NEW.organization_id := OLD.organization_id; NEW.author_id := OLD.author_id;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    NEW.reviewed_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_question_item BEFORE UPDATE ON public.question_bank_items
FOR EACH ROW EXECUTE FUNCTION public.guard_question_item();

-- ---------------------------------------------------------------------------
-- Generated papers (auto-selected from approved questions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.question_papers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  qualification_id uuid NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  unit_standard_id uuid REFERENCES public.unit_standards(id) ON DELETE SET NULL,
  title text NOT NULL,
  target_marks integer NOT NULL,
  total_marks integer NOT NULL DEFAULT 0,
  duration_minutes integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.question_paper_items (
  paper_id uuid NOT NULL REFERENCES public.question_papers(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.question_bank_items(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  PRIMARY KEY (paper_id, question_id)
);
ALTER TABLE public.question_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_paper_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff manage papers" ON public.question_papers
FOR ALL USING (public.is_assessment_staff(auth.uid(), organization_id))
WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));
CREATE POLICY "Assessment staff manage paper items" ON public.question_paper_items
FOR ALL USING (EXISTS (SELECT 1 FROM public.question_papers p WHERE p.id = paper_id AND public.is_assessment_staff(auth.uid(), p.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.question_papers p WHERE p.id = paper_id AND public.is_assessment_staff(auth.uid(), p.organization_id)));

-- Picks random approved questions until the target marks are reached (never exceeded).
-- Questions already used in a paper for the same qualification are avoided while enough fresh ones exist.
CREATE OR REPLACE FUNCTION public.generate_question_paper(
  _qualification uuid, _unit_standard uuid, _title text, _target_marks integer,
  _duration integer DEFAULT NULL, _difficulty text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _paper uuid; q record; _total integer := 0; _pos integer := 0; _pass integer;
BEGIN
  SELECT organization_id INTO _org FROM public.qualifications WHERE id = _qualification;
  IF _org IS NULL THEN RAISE EXCEPTION 'Qualification not found'; END IF;
  IF NOT public.is_assessment_staff(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _target_marks IS NULL OR _target_marks <= 0 THEN RAISE EXCEPTION 'Target marks must be positive'; END IF;

  INSERT INTO public.question_papers (organization_id, qualification_id, unit_standard_id, title, target_marks, duration_minutes, generated_by)
  VALUES (_org, _qualification, _unit_standard, _title, _target_marks, _duration, auth.uid())
  RETURNING id INTO _paper;

  FOR _pass IN 1..2 LOOP -- pass 1: unused questions only; pass 2: top up from previously used ones
    FOR q IN
      SELECT b.id, b.marks FROM public.question_bank_items b
      WHERE b.organization_id = _org AND b.qualification_id = _qualification AND b.status = 'approved'
        AND (_unit_standard IS NULL OR b.unit_standard_id = _unit_standard)
        AND (_difficulty IS NULL OR b.difficulty = _difficulty)
        AND NOT EXISTS (SELECT 1 FROM public.question_paper_items i WHERE i.paper_id = _paper AND i.question_id = b.id)
        AND (_pass = 2 OR NOT EXISTS (SELECT 1 FROM public.question_paper_items u JOIN public.question_papers up ON up.id = u.paper_id
                                      WHERE u.question_id = b.id AND up.id <> _paper))
      ORDER BY random()
    LOOP
      EXIT WHEN _total >= _target_marks;
      IF _total + q.marks <= _target_marks THEN
        _pos := _pos + 1;
        INSERT INTO public.question_paper_items (paper_id, question_id, position) VALUES (_paper, q.id, _pos);
        _total := _total + q.marks;
      END IF;
    END LOOP;
    EXIT WHEN _total >= _target_marks;
  END LOOP;

  IF _pos = 0 THEN
    DELETE FROM public.question_papers WHERE id = _paper;
    RAISE EXCEPTION 'No approved questions match. Approve questions in the bank first.';
  END IF;
  UPDATE public.question_papers SET total_marks = _total WHERE id = _paper;
  RETURN _paper;
END $$;
GRANT EXECUTE ON FUNCTION public.generate_question_paper(uuid, uuid, text, integer, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4.5 / 4.7 / 4.9 / 4.10 Assessment sittings, candidates, roster, induction, printing notice
-- ---------------------------------------------------------------------------
CREATE TABLE public.assessment_sittings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  qualification_id uuid NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  title text NOT NULL,
  sitting_date date NOT NULL,
  venue text,
  paper_id uuid REFERENCES public.question_papers(id) ON DELETE SET NULL,
  induction_date timestamptz,
  induction_venue text,
  induction_agenda text,
  induction_notified_at timestamptz,
  printing_notified_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_sittings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff manage sittings" ON public.assessment_sittings
FOR ALL USING (public.is_assessment_staff(auth.uid(), organization_id))
WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));
CREATE POLICY "Printing officers view sittings" ON public.assessment_sittings
FOR SELECT USING (public.has_org_role(auth.uid(), organization_id, ARRAY['printing_distribution_officer']));

CREATE TABLE public.assessment_sitting_candidates (
  sitting_id uuid NOT NULL REFERENCES public.assessment_sittings(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','approved','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sitting_id, trainee_id)
);
ALTER TABLE public.assessment_sitting_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff manage candidates" ON public.assessment_sitting_candidates
FOR ALL USING (public.is_assessment_staff(auth.uid(), organization_id))
WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));
CREATE POLICY "Printing officers view candidates" ON public.assessment_sitting_candidates
FOR SELECT USING (public.has_org_role(auth.uid(), organization_id, ARRAY['printing_distribution_officer']));
CREATE POLICY "Trainees view own candidacy" ON public.assessment_sitting_candidates
FOR SELECT USING (trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));

CREATE TABLE public.assessment_roster_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sitting_id uuid NOT NULL REFERENCES public.assessment_sittings(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  duty text NOT NULL CHECK (duty IN ('invigilator','chief_invigilator','assessor','supervisor')),
  staff_name text NOT NULL,
  room text,
  session_start timestamptz,
  session_end timestamptz,
  CHECK (session_end IS NULL OR session_start IS NULL OR session_end > session_start)
);
ALTER TABLE public.assessment_roster_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff manage roster" ON public.assessment_roster_entries
FOR ALL USING (public.is_assessment_staff(auth.uid(), organization_id))
WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));

-- 4.10 tell registered candidates about the induction
CREATE OR REPLACE FUNCTION public.notify_sitting_induction(_sitting uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.assessment_sittings%ROWTYPE; n integer;
BEGIN
  SELECT * INTO s FROM public.assessment_sittings WHERE id = _sitting;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sitting not found'; END IF;
  IF NOT public.is_assessment_staff(auth.uid(), s.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF s.induction_date IS NULL THEN RAISE EXCEPTION 'Set the induction date first'; END IF;
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
  SELECT t.user_id, s.organization_id, 'assessment', 'Assessment induction: ' || s.title,
         'Induction on ' || to_char(s.induction_date, 'DD Mon YYYY HH24:MI') || COALESCE(' at ' || s.induction_venue, '')
           || COALESCE('. ' || s.induction_agenda, ''),
         '/trainee/exams/timetable'
  FROM public.assessment_sitting_candidates c JOIN public.trainees t ON t.id = c.trainee_id
  WHERE c.sitting_id = s.id AND c.status <> 'withdrawn' AND t.user_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.assessment_sittings SET induction_notified_at = now() WHERE id = s.id;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.notify_sitting_induction(uuid) TO authenticated;

-- 4.9 tell the Printing & Distribution Officer(s) which candidates are approved
CREATE OR REPLACE FUNCTION public.notify_printing_officer(_sitting uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.assessment_sittings%ROWTYPE; cnt integer; n integer;
BEGIN
  SELECT * INTO s FROM public.assessment_sittings WHERE id = _sitting;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sitting not found'; END IF;
  IF NOT public.is_assessment_staff(auth.uid(), s.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT count(*) INTO cnt FROM public.assessment_sitting_candidates WHERE sitting_id = s.id AND status = 'approved';
  IF cnt = 0 THEN RAISE EXCEPTION 'Approve at least one candidate first'; END IF;
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
  SELECT ur.user_id, s.organization_id, 'assessment', 'Approved candidates: ' || s.title,
         cnt || ' approved candidate(s) for ' || s.title || ' on ' || to_char(s.sitting_date, 'DD Mon YYYY') || '. Prepare and distribute materials.',
         '/assessment-sittings'
  FROM public.user_roles ur
  WHERE ur.organization_id = s.organization_id AND ur.role::text = 'printing_distribution_officer';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'No Printing & Distribution Officer exists for this centre'; END IF;
  UPDATE public.assessment_sittings SET printing_notified_at = now() WHERE id = s.id;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.notify_printing_officer(uuid) TO authenticated;

-- Approved SMEs of a centre, for assigning development plans
CREATE OR REPLACE FUNCTION public.list_smes(_org uuid)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_assessment_staff(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
    SELECT ur.user_id, p.full_name, p.email
    FROM public.user_roles ur JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.organization_id = _org AND ur.role::text = 'subject_matter_expert'
    ORDER BY p.full_name;
END $$;
GRANT EXECUTE ON FUNCTION public.list_smes(uuid) TO authenticated;

-- Make the new roles assignable from user management
INSERT INTO public.custom_roles (role_code, role_name, description, is_system_role, active) VALUES
  ('subject_matter_expert', 'Subject Matter Expert', 'External or internal expert who develops assessment materials and submits questions for approval', true, true),
  ('printing_distribution_officer', 'Printing & Distribution Officer', 'Prepares and distributes assessment materials for approved candidates', true, true)
ON CONFLICT (role_code) DO NOTHING;
