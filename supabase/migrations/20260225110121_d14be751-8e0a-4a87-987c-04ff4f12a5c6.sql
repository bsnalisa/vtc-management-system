
-- ═══════════════════════════════════════════════════════
-- Exam Timetable & External Exam Results Schema
-- ═══════════════════════════════════════════════════════

-- 1. Exam timetable: AC creates exam schedule per qualification
CREATE TABLE public.exam_timetables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id),
  academic_year TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exam_type TEXT NOT NULL DEFAULT 'theory' CHECK (exam_type IN ('theory', 'practical')),
  subject_name TEXT NOT NULL,
  exam_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  venue TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view exam timetables" ON public.exam_timetables
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "AC can manage exam timetables" ON public.exam_timetables
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND organization_id = exam_timetables.organization_id
        AND role IN ('assessment_coordinator', 'organization_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND organization_id = exam_timetables.organization_id
        AND role IN ('assessment_coordinator', 'organization_admin', 'super_admin')
    )
  );

-- 2. Exam results from external assessors
CREATE TABLE public.exam_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  exam_type TEXT NOT NULL DEFAULT 'theory' CHECK (exam_type IN ('theory', 'practical')),
  subject_name TEXT NOT NULL,
  max_marks NUMERIC NOT NULL DEFAULT 100,
  marks_obtained NUMERIC,
  competency_status TEXT NOT NULL DEFAULT 'pending' CHECK (competency_status IN ('pending', 'competent', 'not_yet_competent')),
  assessor_name TEXT,
  exam_date DATE,
  entered_by UUID,
  entered_at TIMESTAMPTZ DEFAULT now(),
  upload_batch_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gradebook_id, trainee_id, subject_name, exam_type)
);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view exam results" ON public.exam_results
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    OR
    public.is_trainee_in_gradebook(auth.uid(), gradebook_id)
  );

CREATE POLICY "AC can manage exam results" ON public.exam_results
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND organization_id = exam_results.organization_id
        AND role IN ('assessment_coordinator', 'organization_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND organization_id = exam_results.organization_id
        AND role IN ('assessment_coordinator', 'organization_admin', 'super_admin')
    )
  );

-- 3. Add results release date to gradebooks
ALTER TABLE public.gradebooks
  ADD COLUMN IF NOT EXISTS results_release_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exam_results_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exam_results_uploaded_by UUID;

-- 4. Trainee exam eligibility view helper
-- A trainee qualifies for theory exam if theory CA >= 50%
-- A trainee qualifies for practical exam if practical score >= 60%
CREATE OR REPLACE FUNCTION public.get_trainee_exam_eligibility(
  _gradebook_id UUID,
  _trainee_id UUID
)
RETURNS TABLE (
  theory_eligible BOOLEAN,
  practical_eligible BOOLEAN,
  theory_ca NUMERIC,
  practical_avg NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ca.ca_score >= 50, false) AS theory_eligible,
    COALESCE(ca.practical_score >= 60, false) AS practical_eligible,
    ca.ca_score AS theory_ca,
    ca.practical_score AS practical_avg
  FROM public.gradebook_ca_scores ca
  WHERE ca.gradebook_id = _gradebook_id
    AND ca.trainee_id = _trainee_id;
$$;
