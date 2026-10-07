-- Delivery plans (spec 3.3) and the electronic industrial-attachment logbook (spec 3.10).

CREATE OR REPLACE FUNCTION public.is_training_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = _user_id AND ur.organization_id = _org
                   AND ur.role::text IN ('admin','organization_admin','head_of_training','hod','assessment_coordinator'));
$$;

-- ---------------------------------------------------------------------------
-- Delivery plans
-- ---------------------------------------------------------------------------
CREATE TABLE public.delivery_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  qualification_id uuid REFERENCES public.qualifications(id) ON DELETE SET NULL,
  title text NOT NULL,
  start_date date NOT NULL,
  weeks integer NOT NULL CHECK (weeks BETWEEN 1 AND 60),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  review_notes text,
  reviewed_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_plans_class ON public.delivery_plans (class_id);
ALTER TABLE public.delivery_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.delivery_plan_weeks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.delivery_plans(id) ON DELETE CASCADE,
  week_no integer NOT NULL,
  week_start date NOT NULL,
  unit_standard_code text, -- the code listed on the qualification (qualification_unit_standards.unit_standard_id)
  topic text NOT NULL,
  outcomes text,
  methods text,
  resources text,
  assessment_activity text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','delivered','deferred')),
  delivered_on date,
  remarks text,
  UNIQUE (plan_id, week_no)
);
ALTER TABLE public.delivery_plan_weeks ENABLE ROW LEVEL SECURITY;

-- Who may touch a plan: training staff, or the trainer the class belongs to.
CREATE OR REPLACE FUNCTION public.can_edit_delivery_plan(_user_id uuid, _plan uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_plans p
    LEFT JOIN public.trainers t ON t.id = p.trainer_id
    WHERE p.id = _plan
      AND (public.is_training_staff(_user_id, p.organization_id)
           OR (t.user_id = _user_id AND p.status IN ('draft','rejected','approved')))
  );
$$;

CREATE POLICY "Training staff manage delivery plans" ON public.delivery_plans
FOR ALL USING (public.is_training_staff(auth.uid(), organization_id))
WITH CHECK (public.is_training_staff(auth.uid(), organization_id));
CREATE POLICY "Trainers view their delivery plans" ON public.delivery_plans
FOR SELECT USING (trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid()));
CREATE POLICY "Trainers update their delivery plans" ON public.delivery_plans
FOR UPDATE USING (trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid()) AND status IN ('draft','rejected'))
WITH CHECK (trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid()) AND status IN ('draft','submitted'));
CREATE POLICY "Training staff manage plan weeks" ON public.delivery_plan_weeks
FOR ALL USING (EXISTS (SELECT 1 FROM public.delivery_plans p WHERE p.id = plan_id AND public.is_training_staff(auth.uid(), p.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_plans p WHERE p.id = plan_id AND public.is_training_staff(auth.uid(), p.organization_id)));
CREATE POLICY "Trainers view plan weeks" ON public.delivery_plan_weeks
FOR SELECT USING (EXISTS (SELECT 1 FROM public.delivery_plans p JOIN public.trainers t ON t.id = p.trainer_id WHERE p.id = plan_id AND t.user_id = auth.uid()));
CREATE POLICY "Trainers edit plan weeks" ON public.delivery_plan_weeks
FOR UPDATE USING (public.can_edit_delivery_plan(auth.uid(), plan_id)) WITH CHECK (public.can_edit_delivery_plan(auth.uid(), plan_id));

CREATE OR REPLACE FUNCTION public.guard_delivery_plan()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL AND NOT public.is_training_staff(auth.uid(), NEW.organization_id) THEN
    NEW.review_notes := OLD.review_notes; NEW.reviewed_by := OLD.reviewed_by; NEW.organization_id := OLD.organization_id;
    NEW.class_id := OLD.class_id; NEW.trainer_id := OLD.trainer_id; NEW.start_date := OLD.start_date; NEW.weeks := OLD.weeks;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    NEW.reviewed_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_delivery_plan BEFORE UPDATE ON public.delivery_plans
FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_plan();

-- Marking a week delivered stamps the date
CREATE OR REPLACE FUNCTION public.stamp_delivery_week()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'delivered' AND NEW.delivered_on IS NULL THEN NEW.delivered_on := CURRENT_DATE; END IF;
  IF NEW.status <> 'delivered' THEN NEW.delivered_on := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stamp_delivery_week BEFORE INSERT OR UPDATE ON public.delivery_plan_weeks
FOR EACH ROW EXECUTE FUNCTION public.stamp_delivery_week();

-- Fill the template: spreads the qualification's unit standards over the weeks in proportion to their credits,
-- with the final week kept for revision and assessment. Trainers can then edit every week.
CREATE OR REPLACE FUNCTION public.generate_delivery_plan(_class uuid, _start date, _weeks integer, _title text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.classes%ROWTYPE; t_user uuid; _plan uuid; u record;
  _teaching integer; _total numeric; _alloc integer; _used integer := 0; _w integer; _remaining integer; _units integer; _seen integer := 0;
BEGIN
  SELECT * INTO c FROM public.classes WHERE id = _class;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;
  SELECT user_id INTO t_user FROM public.trainers WHERE id = c.trainer_id;
  IF NOT (public.is_training_staff(auth.uid(), c.organization_id) OR t_user = auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _weeks < 2 OR _weeks > 60 THEN RAISE EXCEPTION 'A plan needs between 2 and 60 weeks'; END IF;
  IF c.qualification_id IS NULL THEN RAISE EXCEPTION 'This class has no qualification, so there are no unit standards to plan from'; END IF;

  SELECT count(*), COALESCE(sum(GREATEST(COALESCE(credit_value, 1), 1)), 0) INTO _units, _total
  FROM public.qualification_unit_standards WHERE qualification_id = c.qualification_id;
  IF _units = 0 THEN RAISE EXCEPTION 'The qualification has no unit standards. Add them to the qualification first.'; END IF;
  IF _units > _weeks - 1 THEN RAISE EXCEPTION 'The qualification has % unit standards but only % teaching weeks. Use at least % weeks.', _units, _weeks - 1, _units + 1; END IF;

  INSERT INTO public.delivery_plans (organization_id, class_id, trainer_id, qualification_id, title, start_date, weeks)
  VALUES (c.organization_id, c.id, c.trainer_id, c.qualification_id,
          COALESCE(NULLIF(trim(_title), ''), c.class_name || ' delivery plan'), _start, _weeks)
  RETURNING id INTO _plan;

  _teaching := _weeks - 1; -- last week reserved
  _w := 1;
  FOR u IN
    SELECT qus.unit_standard_id, qus.unit_standard_title, GREATEST(COALESCE(qus.credit_value, 1), 1) AS credit
    FROM public.qualification_unit_standards qus
    WHERE qus.qualification_id = c.qualification_id
    ORDER BY qus.level, qus.is_mandatory DESC, qus.unit_standard_title
  LOOP
    _seen := _seen + 1;
    _remaining := _teaching - _used;
    EXIT WHEN _remaining <= 0;
    -- proportional share, at least one week, leaving at least one week for each unit still to come
    _alloc := GREATEST(1, round(u.credit / _total * _teaching)::int);
    _alloc := LEAST(_alloc, GREATEST(1, _remaining - (_units - _seen)));
    FOR i IN 1.._alloc LOOP
      EXIT WHEN _w > _teaching;
      INSERT INTO public.delivery_plan_weeks (plan_id, week_no, week_start, unit_standard_code, topic)
      VALUES (_plan, _w, _start + (_w - 1) * 7, u.unit_standard_id,
              u.unit_standard_title || CASE WHEN _alloc > 1 THEN ' (part ' || i || ' of ' || _alloc || ')' ELSE '' END);
      _w := _w + 1;
    END LOOP;
    _used := _w - 1;
  END LOOP;

  -- any teaching weeks left over (fewer credits than weeks) become consolidation weeks
  WHILE _w <= _teaching LOOP
    INSERT INTO public.delivery_plan_weeks (plan_id, week_no, week_start, topic)
    VALUES (_plan, _w, _start + (_w - 1) * 7, 'Practice and consolidation');
    _w := _w + 1;
  END LOOP;
  INSERT INTO public.delivery_plan_weeks (plan_id, week_no, week_start, topic, assessment_activity)
  VALUES (_plan, _weeks, _start + (_weeks - 1) * 7, 'Revision and assessment', 'Summative assessment');
  RETURN _plan;
END $$;
GRANT EXECUTE ON FUNCTION public.generate_delivery_plan(uuid, date, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Logbook
-- ---------------------------------------------------------------------------
CREATE TABLE public.logbook_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.internship_placements(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  hours numeric(4,1) NOT NULL CHECK (hours > 0 AND hours <= 24),
  activities text NOT NULL,
  skills_learned text,
  challenges text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','returned','supervisor_signed','approved')),
  reviewer_comment text,
  supervisor_signed_by text,
  supervisor_signed_on date,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, entry_date)
);
CREATE INDEX idx_logbook_trainee ON public.logbook_entries (trainee_id, entry_date);
ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_review_logbook(_user_id uuid, _org uuid, _trainee uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['admin','organization_admin','placement_officer','head_of_training','hod'])
      OR EXISTS (SELECT 1 FROM public.class_enrollments ce
                 JOIN public.classes c ON c.id = ce.class_id
                 JOIN public.trainers t ON t.id = c.trainer_id
                 WHERE ce.trainee_id = _trainee AND t.user_id = _user_id);
$$;

CREATE POLICY "Reviewers manage logbook entries" ON public.logbook_entries
FOR ALL USING (public.can_review_logbook(auth.uid(), organization_id, trainee_id))
WITH CHECK (public.can_review_logbook(auth.uid(), organization_id, trainee_id));
CREATE POLICY "Trainees view own logbook" ON public.logbook_entries
FOR SELECT USING (trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));
CREATE POLICY "Trainees write own logbook" ON public.logbook_entries
FOR INSERT WITH CHECK (
  status IN ('draft','submitted')
  AND trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
  AND placement_id IN (SELECT ip.id FROM public.internship_placements ip WHERE ip.trainee_id = logbook_entries.trainee_id)
);
CREATE POLICY "Trainees edit unsigned entries" ON public.logbook_entries
FOR UPDATE USING (status IN ('draft','returned') AND trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()))
WITH CHECK (status IN ('draft','submitted') AND trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));
CREATE POLICY "Trainees delete own drafts" ON public.logbook_entries
FOR DELETE USING (status = 'draft' AND trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_logbook_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.internship_placements%ROWTYPE; reviewer boolean;
BEGIN
  SELECT * INTO p FROM public.internship_placements WHERE id = NEW.placement_id;
  IF NOT FOUND OR p.trainee_id <> NEW.trainee_id THEN RAISE EXCEPTION 'Placement does not belong to this trainee'; END IF;
  IF p.status NOT IN ('approved','active','completed') THEN RAISE EXCEPTION 'The placement has not started yet'; END IF;
  IF NEW.entry_date < p.start_date OR (p.end_date IS NOT NULL AND NEW.entry_date > p.end_date) OR NEW.entry_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Entry date must fall within the placement period and not be in the future';
  END IF;
  NEW.organization_id := p.organization_id;
  NEW.updated_at := now();
  reviewer := auth.uid() IS NOT NULL AND public.can_review_logbook(auth.uid(), p.organization_id, NEW.trainee_id);
  IF TG_OP = 'UPDATE' AND NOT reviewer AND auth.uid() IS NOT NULL THEN
    -- trainees cannot touch sign-off fields
    NEW.reviewer_comment := OLD.reviewer_comment; NEW.supervisor_signed_by := OLD.supervisor_signed_by;
    NEW.supervisor_signed_on := OLD.supervisor_signed_on; NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
    NEW.placement_id := OLD.placement_id; NEW.trainee_id := OLD.trainee_id; NEW.entry_date := OLD.entry_date;
  END IF;
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status <> 'approved') THEN
    NEW.approved_by := auth.uid(); NEW.approved_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_logbook_entry BEFORE INSERT OR UPDATE ON public.logbook_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_logbook_entry();

-- Trainees read their own placements through this function (placement table policies are staff-oriented).
CREATE OR REPLACE FUNCTION public.my_logbook_placements()
RETURNS TABLE (id uuid, trainee_id uuid, placement_number text, start_date date, end_date date, status text, employer_name text, supervisor_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ip.id, ip.trainee_id, ip.placement_number, ip.start_date, ip.end_date, ip.status, e.name, ip.supervisor_name
  FROM public.internship_placements ip
  JOIN public.trainees t ON t.id = ip.trainee_id
  LEFT JOIN public.employers e ON e.id = ip.employer_id
  WHERE t.user_id = auth.uid() AND ip.status IN ('approved','active','completed')
  ORDER BY ip.start_date DESC;
$$;
GRANT EXECUTE ON FUNCTION public.my_logbook_placements() TO authenticated;
