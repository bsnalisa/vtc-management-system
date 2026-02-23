
-- ============================================================
-- PHASE 1: TVET-Compliant Assessment Governance System Schema
-- Replaces legacy assessment_results with gradebook-centric model
-- ============================================================

-- 1. Gradebooks — trainer-owned, per qualification + intake
CREATE TABLE public.gradebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id),
  trainer_id UUID NOT NULL REFERENCES public.trainers(id),
  academic_year TEXT NOT NULL,
  intake_label TEXT, -- e.g. "January 2026 Intake"
  level INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL, -- e.g. "Automotive L2 – Jan 2026"
  
  -- CA weight configuration (org-configurable)
  test_weight NUMERIC NOT NULL DEFAULT 40 CHECK (test_weight >= 0 AND test_weight <= 100),
  mock_weight NUMERIC NOT NULL DEFAULT 60 CHECK (mock_weight >= 0 AND mock_weight <= 100),
  
  -- Structure lock
  is_locked BOOLEAN NOT NULL DEFAULT false, -- locks once first mark entered
  locked_at TIMESTAMPTZ,
  
  -- Workflow status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','hot_approved','ac_approved','finalised')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  hot_approved_at TIMESTAMPTZ,
  hot_approved_by UUID,
  hot_return_reason TEXT,
  ac_approved_at TIMESTAMPTZ,
  ac_approved_by UUID,
  ac_return_reason TEXT,
  finalised_at TIMESTAMPTZ,
  finalised_by UUID,
  
  -- Submission window
  submission_opens_at TIMESTAMPTZ,
  submission_closes_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_weights CHECK (test_weight + mock_weight = 100)
);

-- 2. Component groups (Theory / Practical)
CREATE TABLE public.gradebook_component_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Theory" or "Practical"
  group_type TEXT NOT NULL CHECK (group_type IN ('theory','practical')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Assessment components (dynamic, trainer-defined)
CREATE TABLE public.gradebook_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.gradebook_component_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL, -- e.g. "Test 1", "Mock Exam", "Practical: Welding"
  component_type TEXT NOT NULL CHECK (component_type IN ('test','mock','assignment','practical','other')),
  max_marks NUMERIC NOT NULL DEFAULT 100,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Link practicals to multiple unit standards
CREATE TABLE public.gradebook_component_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES public.gradebook_components(id) ON DELETE CASCADE,
  unit_standard_id UUID NOT NULL REFERENCES public.unit_standards(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(component_id, unit_standard_id)
);

-- 5. Trainee enrollment in a gradebook
CREATE TABLE public.gradebook_trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  enrollment_id UUID REFERENCES public.trainee_enrollments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gradebook_id, trainee_id)
);

-- 6. Marks per trainee per component
CREATE TABLE public.gradebook_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.gradebook_components(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  marks_obtained NUMERIC,
  competency_status TEXT NOT NULL DEFAULT 'pending' CHECK (competency_status IN ('competent','not_yet_competent','pending')),
  entered_by UUID NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(component_id, trainee_id)
);

-- 7. Structured feedback per trainee per component
CREATE TABLE public.gradebook_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.gradebook_components(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  feedback_text TEXT NOT NULL,
  is_final BOOLEAN NOT NULL DEFAULT false,
  written_by UUID NOT NULL,
  written_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(component_id, trainee_id)
);

-- 8. Auto-calculated CA scores
CREATE TABLE public.gradebook_ca_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  test_average NUMERIC,
  mock_average NUMERIC,
  ca_score NUMERIC, -- weighted: test_avg * weight% + mock_avg * weight%
  theory_score NUMERIC,
  practical_score NUMERIC,
  overall_competency TEXT DEFAULT 'pending' CHECK (overall_competency IN ('competent','not_yet_competent','pending')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gradebook_id, trainee_id)
);

-- 9. Full audit trail
CREATE TABLE public.gradebook_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- e.g. 'mark_entered','mark_updated','submitted','approved','returned','finalised'
  entity_type TEXT, -- 'mark','feedback','gradebook','component'
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- 10. Mark query/dispute workflow
CREATE TABLE public.mark_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.gradebook_components(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  query_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','escalated_to_hot','escalated_to_ac','resolved','rejected')),
  resolution_text TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  marks_locked BOOLEAN NOT NULL DEFAULT true, -- marks locked while query active
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.gradebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_component_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_component_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_ca_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebook_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_queries ENABLE ROW LEVEL SECURITY;

-- Gradebooks: trainers see own, HoT/AC/admin see org
CREATE POLICY "Trainers see own gradebooks" ON public.gradebooks FOR SELECT TO authenticated
  USING (trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid()));

CREATE POLICY "Staff see org gradebooks" ON public.gradebooks FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR
    public.is_organization_admin(auth.uid(), organization_id) OR
    public.has_role(auth.uid(), 'head_of_training') OR
    public.has_role(auth.uid(), 'assessment_coordinator')
  );

CREATE POLICY "Trainers create gradebooks" ON public.gradebooks FOR INSERT TO authenticated
  WITH CHECK (trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid()));

CREATE POLICY "Trainers update own draft gradebooks" ON public.gradebooks FOR UPDATE TO authenticated
  USING (trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid()));

CREATE POLICY "HoT can update gradebooks" ON public.gradebooks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'head_of_training'));

CREATE POLICY "AC can update gradebooks" ON public.gradebooks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'assessment_coordinator'));

-- Component groups, components, component_units: follow gradebook access
CREATE POLICY "View component groups" ON public.gradebook_component_groups FOR SELECT TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks));

CREATE POLICY "Manage component groups" ON public.gradebook_component_groups FOR ALL TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks WHERE trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())));

CREATE POLICY "View components" ON public.gradebook_components FOR SELECT TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks));

CREATE POLICY "Manage components" ON public.gradebook_components FOR ALL TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks WHERE trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())));

CREATE POLICY "View component units" ON public.gradebook_component_units FOR SELECT TO authenticated
  USING (component_id IN (SELECT id FROM public.gradebook_components));

CREATE POLICY "Manage component units" ON public.gradebook_component_units FOR ALL TO authenticated
  USING (component_id IN (SELECT id FROM public.gradebook_components WHERE gradebook_id IN (SELECT id FROM public.gradebooks WHERE trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid()))));

-- Gradebook trainees
CREATE POLICY "View gradebook trainees" ON public.gradebook_trainees FOR SELECT TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks));

CREATE POLICY "Trainee sees own enrollment" ON public.gradebook_trainees FOR SELECT TO authenticated
  USING (trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));

CREATE POLICY "Manage gradebook trainees" ON public.gradebook_trainees FOR ALL TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks WHERE trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())));

-- Marks: trainers enter, all staff view, trainees see own
CREATE POLICY "Staff view marks" ON public.gradebook_marks FOR SELECT TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks));

CREATE POLICY "Trainees see own marks" ON public.gradebook_marks FOR SELECT TO authenticated
  USING (trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));

CREATE POLICY "Trainers manage marks" ON public.gradebook_marks FOR ALL TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks WHERE trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())));

-- Feedback
CREATE POLICY "Staff view feedback" ON public.gradebook_feedback FOR SELECT TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks));

CREATE POLICY "Trainees see own feedback" ON public.gradebook_feedback FOR SELECT TO authenticated
  USING (trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));

CREATE POLICY "Trainers manage feedback" ON public.gradebook_feedback FOR ALL TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks WHERE trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())));

-- CA scores
CREATE POLICY "Staff view ca scores" ON public.gradebook_ca_scores FOR SELECT TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks));

CREATE POLICY "Trainees see own ca scores" ON public.gradebook_ca_scores FOR SELECT TO authenticated
  USING (trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));

CREATE POLICY "System manages ca scores" ON public.gradebook_ca_scores FOR ALL TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks WHERE trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())));

-- Audit logs: staff only
CREATE POLICY "Staff view audit logs" ON public.gradebook_audit_logs FOR SELECT TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks));

CREATE POLICY "System insert audit logs" ON public.gradebook_audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Mark queries
CREATE POLICY "Trainees manage own queries" ON public.mark_queries FOR ALL TO authenticated
  USING (trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()));

CREATE POLICY "Staff view queries" ON public.mark_queries FOR SELECT TO authenticated
  USING (gradebook_id IN (SELECT id FROM public.gradebooks));

CREATE POLICY "Staff update queries" ON public.mark_queries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'trainer') OR
    public.has_role(auth.uid(), 'head_of_training') OR
    public.has_role(auth.uid(), 'assessment_coordinator')
  );

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-lock gradebook structure on first mark entry
CREATE OR REPLACE FUNCTION public.lock_gradebook_on_first_mark()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.gradebooks
  SET is_locked = true, locked_at = now(), updated_at = now()
  WHERE id = NEW.gradebook_id AND is_locked = false;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_gradebook_on_mark
AFTER INSERT ON public.gradebook_marks
FOR EACH ROW
EXECUTE FUNCTION public.lock_gradebook_on_first_mark();

-- Auto-calculate CA scores when marks change
CREATE OR REPLACE FUNCTION public.recalculate_ca_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gradebook_id UUID;
  v_trainee_id UUID;
  v_test_avg NUMERIC;
  v_mock_avg NUMERIC;
  v_theory_avg NUMERIC;
  v_practical_avg NUMERIC;
  v_test_weight NUMERIC;
  v_mock_weight NUMERIC;
  v_ca NUMERIC;
  v_competency TEXT;
BEGIN
  v_gradebook_id := NEW.gradebook_id;
  v_trainee_id := NEW.trainee_id;

  -- Get weights
  SELECT test_weight, mock_weight INTO v_test_weight, v_mock_weight
  FROM public.gradebooks WHERE id = v_gradebook_id;

  -- Calculate test average (percentage)
  SELECT AVG((m.marks_obtained / c.max_marks) * 100)
  INTO v_test_avg
  FROM public.gradebook_marks m
  JOIN public.gradebook_components c ON m.component_id = c.id
  WHERE m.gradebook_id = v_gradebook_id
    AND m.trainee_id = v_trainee_id
    AND c.component_type = 'test'
    AND m.marks_obtained IS NOT NULL;

  -- Calculate mock average (percentage)
  SELECT AVG((m.marks_obtained / c.max_marks) * 100)
  INTO v_mock_avg
  FROM public.gradebook_marks m
  JOIN public.gradebook_components c ON m.component_id = c.id
  WHERE m.gradebook_id = v_gradebook_id
    AND m.trainee_id = v_trainee_id
    AND c.component_type = 'mock'
    AND m.marks_obtained IS NOT NULL;

  -- Theory group average
  SELECT AVG((m.marks_obtained / c.max_marks) * 100)
  INTO v_theory_avg
  FROM public.gradebook_marks m
  JOIN public.gradebook_components c ON m.component_id = c.id
  LEFT JOIN public.gradebook_component_groups g ON c.group_id = g.id
  WHERE m.gradebook_id = v_gradebook_id
    AND m.trainee_id = v_trainee_id
    AND g.group_type = 'theory'
    AND m.marks_obtained IS NOT NULL;

  -- Practical group average
  SELECT AVG((m.marks_obtained / c.max_marks) * 100)
  INTO v_practical_avg
  FROM public.gradebook_marks m
  JOIN public.gradebook_components c ON m.component_id = c.id
  LEFT JOIN public.gradebook_component_groups g ON c.group_id = g.id
  WHERE m.gradebook_id = v_gradebook_id
    AND m.trainee_id = v_trainee_id
    AND g.group_type = 'practical'
    AND m.marks_obtained IS NOT NULL;

  -- CA = test_avg * weight% + mock_avg * weight%
  v_ca := COALESCE(v_test_avg, 0) * (v_test_weight / 100) + COALESCE(v_mock_avg, 0) * (v_mock_weight / 100);

  -- Competency: >= 50% = competent
  v_competency := CASE
    WHEN v_ca >= 50 THEN 'competent'
    WHEN v_test_avg IS NULL AND v_mock_avg IS NULL THEN 'pending'
    ELSE 'not_yet_competent'
  END;

  -- Upsert CA score
  INSERT INTO public.gradebook_ca_scores (gradebook_id, trainee_id, test_average, mock_average, ca_score, theory_score, practical_score, overall_competency, calculated_at)
  VALUES (v_gradebook_id, v_trainee_id, v_test_avg, v_mock_avg, v_ca, v_theory_avg, v_practical_avg, v_competency, now())
  ON CONFLICT (gradebook_id, trainee_id)
  DO UPDATE SET
    test_average = EXCLUDED.test_average,
    mock_average = EXCLUDED.mock_average,
    ca_score = EXCLUDED.ca_score,
    theory_score = EXCLUDED.theory_score,
    practical_score = EXCLUDED.practical_score,
    overall_competency = EXCLUDED.overall_competency,
    calculated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalculate_ca
AFTER INSERT OR UPDATE ON public.gradebook_marks
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_ca_scores();

-- Audit log trigger for mark changes
CREATE OR REPLACE FUNCTION public.audit_gradebook_mark_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.gradebook_audit_logs (gradebook_id, action, entity_type, entity_id, new_value, performed_by)
    VALUES (NEW.gradebook_id, 'mark_entered', 'mark', NEW.id, 
      jsonb_build_object('marks_obtained', NEW.marks_obtained, 'competency_status', NEW.competency_status, 'trainee_id', NEW.trainee_id, 'component_id', NEW.component_id),
      NEW.entered_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.marks_obtained IS DISTINCT FROM NEW.marks_obtained THEN
    INSERT INTO public.gradebook_audit_logs (gradebook_id, action, entity_type, entity_id, old_value, new_value, performed_by)
    VALUES (NEW.gradebook_id, 'mark_updated', 'mark', NEW.id,
      jsonb_build_object('marks_obtained', OLD.marks_obtained, 'competency_status', OLD.competency_status),
      jsonb_build_object('marks_obtained', NEW.marks_obtained, 'competency_status', NEW.competency_status),
      NEW.entered_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_mark_change
AFTER INSERT OR UPDATE ON public.gradebook_marks
FOR EACH ROW
EXECUTE FUNCTION public.audit_gradebook_mark_change();

-- Updated_at triggers
CREATE TRIGGER trg_gradebooks_updated_at
BEFORE UPDATE ON public.gradebooks
FOR EACH ROW
EXECUTE FUNCTION public.update_financial_queue_updated_at();

CREATE TRIGGER trg_mark_queries_updated_at
BEFORE UPDATE ON public.mark_queries
FOR EACH ROW
EXECUTE FUNCTION public.update_financial_queue_updated_at();

-- Enable realtime for marks and feedback (trainee portal)
ALTER PUBLICATION supabase_realtime ADD TABLE public.gradebook_marks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gradebook_feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gradebook_ca_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mark_queries;
