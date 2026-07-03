
-- Invigilators
CREATE TABLE IF NOT EXISTS public.invigilators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  invigilator_type TEXT NOT NULL DEFAULT 'internal' CHECK (invigilator_type IN ('internal','external')),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invigilators TO authenticated;
GRANT ALL ON public.invigilators TO service_role;

ALTER TABLE public.invigilators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view invigilators" ON public.invigilators
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "AC can manage invigilators" ON public.invigilators
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND organization_id = invigilators.organization_id
      AND role IN ('assessment_coordinator','organization_admin','super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND organization_id = invigilators.organization_id
      AND role IN ('assessment_coordinator','organization_admin','super_admin')
  ));

CREATE TRIGGER trg_invigilators_updated_at
  BEFORE UPDATE ON public.invigilators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend exam_timetables
ALTER TABLE public.exam_timetables
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.training_rooms(id),
  ADD COLUMN IF NOT EXISTS invigilator_id UUID REFERENCES public.invigilators(id),
  ADD COLUMN IF NOT EXISTS gradebook_id UUID REFERENCES public.gradebooks(id),
  ADD COLUMN IF NOT EXISTS min_theory_ca NUMERIC NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS min_practical_avg NUMERIC NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID;

-- Trainee SELECT policy for published timetables tied to a gradebook they're in
DROP POLICY IF EXISTS "Trainees can view published exam timetables" ON public.exam_timetables;
CREATE POLICY "Trainees can view published exam timetables" ON public.exam_timetables
  FOR SELECT TO authenticated
  USING (
    published = true
    AND gradebook_id IS NOT NULL
    AND public.is_trainee_in_gradebook(auth.uid(), gradebook_id)
  );
