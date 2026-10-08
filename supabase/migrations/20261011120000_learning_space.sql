-- Learning space per class: content, assignments, auto-marked quizzes and a discussion forum.
-- Trainers of the class and training staff manage it; trainees enrolled in the class use it.

CREATE OR REPLACE FUNCTION public.can_manage_class_learning(_user_id uuid, _class uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.classes c LEFT JOIN public.trainers t ON t.id = c.trainer_id
    WHERE c.id = _class
      AND (t.user_id = _user_id OR public.has_org_role(_user_id, c.organization_id, ARRAY['admin','organization_admin','head_of_training','hod'])));
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(_user_id uuid, _class uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.class_enrollments ce JOIN public.trainees t ON t.id = ce.trainee_id
    WHERE ce.class_id = _class AND ce.status = 'active' AND t.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.set_learning_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.organization_id := (SELECT organization_id FROM public.classes WHERE id = NEW.class_id);
  IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- Content (pages, links, documents and session recordings held elsewhere)
-- ---------------------------------------------------------------------------
CREATE TABLE public.learning_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  item_type text NOT NULL DEFAULT 'page' CHECK (item_type IN ('page','link','document','recording')),
  body text,
  url text CHECK (url IS NULL OR url ~* '^https?://'),
  position integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (item_type = 'page' OR url IS NOT NULL)
);
CREATE INDEX idx_learning_items_class ON public.learning_items (class_id, position);
CREATE TRIGGER trg_learning_items_org BEFORE INSERT OR UPDATE OF class_id ON public.learning_items FOR EACH ROW EXECUTE FUNCTION public.set_learning_org();
CREATE TRIGGER update_learning_items_updated_at BEFORE UPDATE ON public.learning_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class managers manage content" ON public.learning_items FOR ALL
  USING (public.can_manage_class_learning(auth.uid(), class_id)) WITH CHECK (public.can_manage_class_learning(auth.uid(), class_id));
CREATE POLICY "Enrolled trainees read published content" ON public.learning_items FOR SELECT
  USING (published AND public.is_enrolled_in_class(auth.uid(), class_id));

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------
CREATE TABLE public.learning_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  due_at timestamptz,
  max_marks integer NOT NULL DEFAULT 100 CHECK (max_marks > 0),
  published boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_learning_assignments_class ON public.learning_assignments (class_id);
CREATE TRIGGER trg_learning_assignments_org BEFORE INSERT OR UPDATE OF class_id ON public.learning_assignments FOR EACH ROW EXECUTE FUNCTION public.set_learning_org();
ALTER TABLE public.learning_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class managers manage assignments" ON public.learning_assignments FOR ALL
  USING (public.can_manage_class_learning(auth.uid(), class_id)) WITH CHECK (public.can_manage_class_learning(auth.uid(), class_id));
CREATE POLICY "Enrolled trainees read published assignments" ON public.learning_assignments FOR SELECT
  USING (published AND public.is_enrolled_in_class(auth.uid(), class_id));

CREATE TABLE public.assignment_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES public.learning_assignments(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  answer_text text,
  link_url text CHECK (link_url IS NULL OR link_url ~* '^https?://'),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','graded','returned')),
  marks numeric(6,2) CHECK (marks IS NULL OR marks >= 0),
  feedback text,
  late boolean NOT NULL DEFAULT false,
  graded_by uuid,
  graded_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, trainee_id),
  CHECK (answer_text IS NOT NULL OR link_url IS NOT NULL)
);
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assignment_class(_assignment uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM public.learning_assignments WHERE id = _assignment;
$$;

CREATE POLICY "Class managers see and grade submissions" ON public.assignment_submissions FOR ALL
  USING (public.can_manage_class_learning(auth.uid(), public.assignment_class(assignment_id)))
  WITH CHECK (public.can_manage_class_learning(auth.uid(), public.assignment_class(assignment_id)));
CREATE POLICY "Trainees see their submissions" ON public.assignment_submissions FOR SELECT
  USING (public.is_own_trainee(trainee_id));
CREATE POLICY "Trainees submit work" ON public.assignment_submissions FOR INSERT
  WITH CHECK (status = 'submitted' AND public.is_own_trainee(trainee_id) AND public.is_enrolled_in_class(auth.uid(), public.assignment_class(assignment_id)));
CREATE POLICY "Trainees revise ungraded work" ON public.assignment_submissions FOR UPDATE
  USING (status IN ('submitted','returned') AND public.is_own_trainee(trainee_id))
  WITH CHECK (status = 'submitted' AND public.is_own_trainee(trainee_id));

CREATE OR REPLACE FUNCTION public.guard_assignment_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.learning_assignments%ROWTYPE; manager boolean;
BEGIN
  SELECT * INTO a FROM public.learning_assignments WHERE id = NEW.assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  NEW.organization_id := a.organization_id;
  manager := auth.uid() IS NOT NULL AND public.can_manage_class_learning(auth.uid(), a.class_id);
  IF NOT manager AND auth.uid() IS NOT NULL THEN
    IF NOT a.published THEN RAISE EXCEPTION 'This assignment is not open'; END IF;
    IF a.due_at IS NOT NULL AND a.due_at < now() - interval '0 minutes' AND TG_OP = 'INSERT' THEN
      NEW.late := true; -- late work is accepted but flagged
    END IF;
    IF TG_OP = 'UPDATE' THEN
      NEW.assignment_id := OLD.assignment_id; NEW.trainee_id := OLD.trainee_id;
      NEW.marks := OLD.marks; NEW.feedback := OLD.feedback; NEW.graded_by := OLD.graded_by; NEW.graded_at := OLD.graded_at;
      NEW.late := OLD.late OR (a.due_at IS NOT NULL AND a.due_at < now());
      NEW.submitted_at := now();
    END IF;
  ELSIF NEW.status = 'graded' THEN
    IF NEW.marks IS NULL THEN RAISE EXCEPTION 'Enter the marks'; END IF;
    IF NEW.marks > a.max_marks THEN RAISE EXCEPTION 'Marks cannot be more than %', a.max_marks; END IF;
    NEW.graded_by := auth.uid(); NEW.graded_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_assignment_submission BEFORE INSERT OR UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_submission();

-- ---------------------------------------------------------------------------
-- Quizzes: trainees never read the questions table (it holds the answers); they use the functions below.
-- ---------------------------------------------------------------------------
CREATE TABLE public.learning_quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  time_limit_minutes integer CHECK (time_limit_minutes IS NULL OR time_limit_minutes BETWEEN 1 AND 600),
  pass_percent integer NOT NULL DEFAULT 50 CHECK (pass_percent BETWEEN 0 AND 100),
  attempts_allowed integer NOT NULL DEFAULT 1 CHECK (attempts_allowed BETWEEN 1 AND 20),
  show_answers boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_learning_quizzes_org BEFORE INSERT OR UPDATE OF class_id ON public.learning_quizzes FOR EACH ROW EXECUTE FUNCTION public.set_learning_org();
ALTER TABLE public.learning_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class managers manage quizzes" ON public.learning_quizzes FOR ALL
  USING (public.can_manage_class_learning(auth.uid(), class_id)) WITH CHECK (public.can_manage_class_learning(auth.uid(), class_id));
CREATE POLICY "Enrolled trainees see published quizzes" ON public.learning_quizzes FOR SELECT
  USING (published AND public.is_enrolled_in_class(auth.uid(), class_id));

CREATE TABLE public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.learning_quizzes(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'single_choice' CHECK (question_type IN ('single_choice','true_false')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  marks integer NOT NULL DEFAULT 1 CHECK (marks > 0)
);
CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions (quiz_id, position);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.quiz_class(_quiz uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM public.learning_quizzes WHERE id = _quiz;
$$;
CREATE POLICY "Class managers manage quiz questions" ON public.quiz_questions FOR ALL
  USING (public.can_manage_class_learning(auth.uid(), public.quiz_class(quiz_id)))
  WITH CHECK (public.can_manage_class_learning(auth.uid(), public.quiz_class(quiz_id)));

CREATE TABLE public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.learning_quizzes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  answers jsonb,
  score numeric(7,2),
  total numeric(7,2),
  passed boolean,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
CREATE INDEX idx_quiz_attempts_quiz ON public.quiz_attempts (quiz_id, trainee_id);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class managers see attempts" ON public.quiz_attempts FOR SELECT
  USING (public.can_manage_class_learning(auth.uid(), public.quiz_class(quiz_id)));
CREATE POLICY "Trainees see their attempts" ON public.quiz_attempts FOR SELECT USING (public.is_own_trainee(trainee_id));

-- Questions without the answers, and a started attempt (the clock runs from here)
CREATE OR REPLACE FUNCTION public.start_quiz_attempt(_quiz uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.learning_quizzes%ROWTYPE; t public.trainees%ROWTYPE; a public.quiz_attempts%ROWTYPE; _used integer;
BEGIN
  SELECT * INTO q FROM public.learning_quizzes WHERE id = _quiz;
  IF NOT FOUND OR NOT q.published THEN RAISE EXCEPTION 'Quiz not found'; END IF;
  SELECT t2.* INTO t FROM public.trainees t2 WHERE t2.user_id = auth.uid() AND t2.organization_id = q.organization_id LIMIT 1;
  IF NOT FOUND OR NOT public.is_enrolled_in_class(auth.uid(), q.class_id) THEN RAISE EXCEPTION 'Quiz not found'; END IF;

  -- resume an unfinished attempt that is still within its time
  SELECT * INTO a FROM public.quiz_attempts WHERE quiz_id = q.id AND trainee_id = t.id AND submitted_at IS NULL
    AND (q.time_limit_minutes IS NULL OR started_at + make_interval(mins => q.time_limit_minutes) > now()) ORDER BY started_at DESC LIMIT 1;
  IF NOT FOUND THEN
    SELECT count(*) INTO _used FROM public.quiz_attempts WHERE quiz_id = q.id AND trainee_id = t.id;
    IF _used >= q.attempts_allowed THEN RAISE EXCEPTION 'You have used all % attempt(s) for this quiz', q.attempts_allowed; END IF;
    INSERT INTO public.quiz_attempts (quiz_id, organization_id, trainee_id) VALUES (q.id, q.organization_id, t.id) RETURNING * INTO a;
  END IF;
  RETURN jsonb_build_object('attempt_id', a.id, 'started_at', a.started_at, 'time_limit_minutes', q.time_limit_minutes,
    'title', q.title, 'instructions', q.instructions,
    'questions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'text', x.question_text, 'type', x.question_type, 'options', x.options, 'marks', x.marks) ORDER BY x.position)
                           FROM public.quiz_questions x WHERE x.quiz_id = q.id), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(uuid) TO authenticated;

-- _answers: { "<question id>": "<chosen option>" }. Marked here; a late submission (after the limit plus one minute) scores 0.
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(_attempt uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.quiz_attempts%ROWTYPE; q public.learning_quizzes%ROWTYPE; _score numeric := 0; _total numeric := 0; x record; _expired boolean; _detail jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO a FROM public.quiz_attempts WHERE id = _attempt FOR UPDATE;
  IF NOT FOUND OR NOT public.is_own_trainee(a.trainee_id) THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF a.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'This attempt was already submitted'; END IF;
  SELECT * INTO q FROM public.learning_quizzes WHERE id = a.quiz_id;
  _expired := q.time_limit_minutes IS NOT NULL AND now() > a.started_at + make_interval(mins => q.time_limit_minutes) + interval '1 minute';
  FOR x IN SELECT * FROM public.quiz_questions WHERE quiz_id = q.id ORDER BY position LOOP
    _total := _total + x.marks;
    IF NOT _expired AND lower(trim(COALESCE(_answers->>(x.id::text), ''))) = lower(trim(x.correct_answer)) THEN _score := _score + x.marks; END IF;
    IF q.show_answers THEN
      _detail := _detail || jsonb_build_object('id', x.id, 'text', x.question_text, 'your_answer', _answers->>(x.id::text), 'correct_answer', x.correct_answer);
    END IF;
  END LOOP;
  UPDATE public.quiz_attempts SET answers = COALESCE(_answers, '{}'::jsonb), score = _score, total = _total,
         passed = (_total > 0 AND _score / _total * 100 >= q.pass_percent), submitted_at = now() WHERE id = a.id;
  RETURN jsonb_build_object('score', _score, 'total', _total, 'passed', (_total > 0 AND _score / _total * 100 >= q.pass_percent),
                            'too_late', _expired, 'review', CASE WHEN q.show_answers THEN _detail ELSE NULL END);
END $$;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Forum
-- ---------------------------------------------------------------------------
CREATE TABLE public.forum_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  locked boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forum_topics_class ON public.forum_topics (class_id, created_at DESC);
CREATE TABLE public.forum_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id uuid NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forum_posts_topic ON public.forum_posts (topic_id, created_at);
ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_use_class_forum(_user_id uuid, _class uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_class_learning(_user_id, _class) OR public.is_enrolled_in_class(_user_id, _class);
$$;
CREATE OR REPLACE FUNCTION public.forum_topic_class(_topic uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM public.forum_topics WHERE id = _topic;
$$;
CREATE OR REPLACE FUNCTION public.forum_topic_locked(_topic uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT locked FROM public.forum_topics WHERE id = _topic), true);
$$;

CREATE POLICY "Class members read topics" ON public.forum_topics FOR SELECT USING (public.can_use_class_forum(auth.uid(), class_id));
CREATE POLICY "Class members start topics" ON public.forum_topics FOR INSERT
  WITH CHECK (author_id = auth.uid() AND NOT locked AND public.can_use_class_forum(auth.uid(), class_id));
CREATE POLICY "Class managers moderate topics" ON public.forum_topics FOR UPDATE
  USING (public.can_manage_class_learning(auth.uid(), class_id)) WITH CHECK (public.can_manage_class_learning(auth.uid(), class_id));
CREATE POLICY "Authors and managers delete topics" ON public.forum_topics FOR DELETE
  USING (author_id = auth.uid() OR public.can_manage_class_learning(auth.uid(), class_id));
CREATE POLICY "Class members read posts" ON public.forum_posts FOR SELECT
  USING (public.can_use_class_forum(auth.uid(), public.forum_topic_class(topic_id)));
CREATE POLICY "Class members reply" ON public.forum_posts FOR INSERT
  WITH CHECK (author_id = auth.uid() AND NOT public.forum_topic_locked(topic_id)
              AND public.can_use_class_forum(auth.uid(), public.forum_topic_class(topic_id)));
CREATE POLICY "Authors and managers delete posts" ON public.forum_posts FOR DELETE
  USING (author_id = auth.uid() OR public.can_manage_class_learning(auth.uid(), public.forum_topic_class(topic_id)));

CREATE OR REPLACE FUNCTION public.stamp_forum_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'forum_topics' THEN
    NEW.organization_id := (SELECT organization_id FROM public.classes WHERE id = NEW.class_id);
  ELSE
    NEW.organization_id := (SELECT organization_id FROM public.forum_topics WHERE id = NEW.topic_id);
  END IF;
  NEW.author_name := COALESCE((SELECT full_name FROM public.profiles WHERE user_id = NEW.author_id), 'Member');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_forum_topics_stamp BEFORE INSERT ON public.forum_topics FOR EACH ROW EXECUTE FUNCTION public.stamp_forum_author();
CREATE TRIGGER trg_forum_posts_stamp BEFORE INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.stamp_forum_author();

-- Classes the caller can open in the learning space (trainee: enrolled; trainer / training staff: manageable)
CREATE OR REPLACE FUNCTION public.my_learning_classes()
RETURNS TABLE (class_id uuid, class_name text, class_code text, academic_year text, can_manage boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.class_name, c.class_code, c.academic_year, public.can_manage_class_learning(auth.uid(), c.id)
  FROM public.classes c
  WHERE c.active IS NOT FALSE AND (public.can_manage_class_learning(auth.uid(), c.id) OR public.is_enrolled_in_class(auth.uid(), c.id))
  ORDER BY c.academic_year DESC, c.class_name;
$$;
GRANT EXECUTE ON FUNCTION public.my_learning_classes() TO authenticated;
