
-- ============================================================
-- Phase 1: Assessment Template System + Role Permission Shifts
-- ============================================================

-- 1. Assessment Templates (one per qualification)
CREATE TABLE public.assessment_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  theory_pass_mark NUMERIC NOT NULL DEFAULT 50,
  practical_pass_mark NUMERIC NOT NULL DEFAULT 60,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(qualification_id)
);

-- 2. Assessment Template Components (e.g., "Theory Paper 1", "Word Practical", "Excel Practical")
CREATE TABLE public.assessment_template_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.assessment_templates(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('theory', 'practical')),
  sequence_order INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SA (Summative Assessment) results - external assessor marks per template component per trainee
CREATE TABLE public.summative_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  template_component_id UUID NOT NULL REFERENCES public.assessment_template_components(id),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id),
  academic_year TEXT NOT NULL,
  marks_obtained NUMERIC,
  max_marks NUMERIC NOT NULL DEFAULT 100,
  percentage NUMERIC GENERATED ALWAYS AS (CASE WHEN max_marks > 0 THEN (marks_obtained / max_marks) * 100 ELSE 0 END) STORED,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_component_id, trainee_id, academic_year)
);

-- 4. CA Final Results - one aggregated CA mark per template component per trainee
CREATE TABLE public.ca_final_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  template_component_id UUID NOT NULL REFERENCES public.assessment_template_components(id),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id),
  academic_year TEXT NOT NULL,
  ca_average NUMERIC,
  assessment_count INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_component_id, trainee_id, academic_year)
);

-- 5. Final qualification results per trainee per component
CREATE TABLE public.qualification_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id),
  template_component_id UUID NOT NULL REFERENCES public.assessment_template_components(id),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id),
  academic_year TEXT NOT NULL,
  ca_mark NUMERIC,
  sa_mark NUMERIC,
  pass_mark NUMERIC NOT NULL,
  result_status TEXT NOT NULL DEFAULT 'pending' CHECK (result_status IN ('pending', 'pass', 'fail', 'competent', 'not_yet_competent')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_component_id, trainee_id, academic_year)
);

-- 6. Link gradebook components to template components
ALTER TABLE public.gradebook_components
  ADD COLUMN IF NOT EXISTS template_component_id UUID REFERENCES public.assessment_template_components(id);

-- 7. Timetable approval workflow
CREATE TABLE public.timetable_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  academic_year TEXT NOT NULL,
  term INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Assessment template audit trail
CREATE TABLE public.assessment_template_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  template_id UUID REFERENCES public.assessment_templates(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'template', 'ca_entry', 'sa_entry', 'result_approval'
  entity_id UUID,
  performed_by UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_template_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summative_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_final_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_template_audit ENABLE ROW LEVEL SECURITY;

-- Assessment Templates: AC + HoT + Org Admin can view, AC can create/update
CREATE POLICY "Staff can view assessment templates" ON public.assessment_templates
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "AC can manage assessment templates" ON public.assessment_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.is_super_admin(auth.uid()))
  );

CREATE POLICY "AC can update assessment templates" ON public.assessment_templates
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.has_role(auth.uid(), 'head_of_training') OR public.is_super_admin(auth.uid()))
  );

-- Template Components
CREATE POLICY "Staff can view template components" ON public.assessment_template_components
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessment_templates t
    WHERE t.id = template_id AND t.organization_id = public.get_user_organization(auth.uid())
  ));

CREATE POLICY "AC can manage template components" ON public.assessment_template_components
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessment_templates t
    WHERE t.id = template_id AND t.organization_id = public.get_user_organization(auth.uid())
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.is_super_admin(auth.uid()))
  ));

CREATE POLICY "AC can update template components" ON public.assessment_template_components
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessment_templates t
    WHERE t.id = template_id AND t.organization_id = public.get_user_organization(auth.uid())
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.is_super_admin(auth.uid()))
  ));

CREATE POLICY "AC can delete template components" ON public.assessment_template_components
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessment_templates t
    WHERE t.id = template_id AND t.organization_id = public.get_user_organization(auth.uid())
    AND t.status = 'draft'
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.is_super_admin(auth.uid()))
  ));

-- Summative Results
CREATE POLICY "Staff can view summative results" ON public.summative_results
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "AC can manage summative results" ON public.summative_results
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.is_super_admin(auth.uid()))
  );

CREATE POLICY "AC can update summative results" ON public.summative_results
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND is_locked = false
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.is_super_admin(auth.uid()))
  );

-- CA Final Results
CREATE POLICY "Staff can view ca final results" ON public.ca_final_results
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "System can manage ca final results" ON public.ca_final_results
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization(auth.uid()));

-- Qualification Results
CREATE POLICY "Staff can view qualification results" ON public.qualification_results
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "AC and HoT can manage qualification results" ON public.qualification_results
  FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.has_role(auth.uid(), 'head_of_training') OR public.is_super_admin(auth.uid()))
  );

-- Timetable Submissions
CREATE POLICY "Staff can view timetable submissions" ON public.timetable_submissions
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "AC can create timetable submissions" ON public.timetable_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.is_super_admin(auth.uid()))
  );

CREATE POLICY "AC and HoT can update timetable submissions" ON public.timetable_submissions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND (public.has_role(auth.uid(), 'assessment_coordinator') OR public.has_role(auth.uid(), 'head_of_training') OR public.is_super_admin(auth.uid()))
  );

-- Audit Trail
CREATE POLICY "Staff can view assessment audit" ON public.assessment_template_audit
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "System can insert assessment audit" ON public.assessment_template_audit
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

-- ============================================================
-- Update qualification management permission to include AC
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_qualifications(_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('organization_admin', 'assessment_coordinator', 'super_admin')
  )
$$;
