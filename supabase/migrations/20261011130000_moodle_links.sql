-- Moodle integration bookkeeping. The calls to Moodle are made by the moodle-sync edge function
-- (secrets MOODLE_URL and MOODLE_TOKEN); these tables only remember what was linked and imported.

CREATE TABLE public.moodle_course_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL UNIQUE REFERENCES public.classes(id) ON DELETE CASCADE,
  moodle_course_id integer NOT NULL,
  moodle_course_name text,
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_enrol_at timestamptz,
  last_grades_at timestamptz
);
CREATE TABLE public.moodle_user_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL UNIQUE REFERENCES public.trainees(id) ON DELETE CASCADE,
  moodle_user_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.moodle_grade_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  grade numeric,
  grade_max numeric,
  percentage text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, trainee_id, item_name)
);
CREATE INDEX idx_moodle_grade_imports_class ON public.moodle_grade_imports (class_id);

ALTER TABLE public.moodle_course_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodle_user_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodle_grade_imports ENABLE ROW LEVEL SECURITY;
-- Written only by the edge function (service role). Staff can read; a trainee reads their own imported grades.
CREATE POLICY "Training staff view Moodle course links" ON public.moodle_course_links FOR SELECT
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','head_of_training','hod','trainer']));
CREATE POLICY "Training staff view Moodle user links" ON public.moodle_user_links FOR SELECT
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','head_of_training','hod']));
CREATE POLICY "Class managers view imported Moodle grades" ON public.moodle_grade_imports FOR SELECT
  USING (public.can_manage_class_learning(auth.uid(), class_id));
CREATE POLICY "Trainees view their imported Moodle grades" ON public.moodle_grade_imports FOR SELECT
  USING (public.is_own_trainee(trainee_id));
