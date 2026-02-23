
-- Academic time structure (period definitions for the timetable grid)
CREATE TABLE public.academic_time_structure (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  period_number INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT false,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.academic_time_structure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view time structure"
ON public.academic_time_structure FOR SELECT TO authenticated USING (true);

CREATE POLICY "HoT and admin can manage time structure"
ON public.academic_time_structure FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'organization_admin'::app_role)
  OR public.has_role(auth.uid(), 'head_of_training'::app_role)
);

CREATE UNIQUE INDEX idx_time_structure_unique ON public.academic_time_structure(organization_id, day, period_number);

-- Timetable entries (output of the scheduling engine)
CREATE TABLE public.timetable_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  term INTEGER NOT NULL DEFAULT 1,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.training_rooms(id) ON DELETE SET NULL,
  day TEXT NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  period_number INTEGER NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  lock_type TEXT CHECK (lock_type IN ('trainer','room','time','full')),
  generation_run_id UUID,
  soft_penalty_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view timetable entries"
ON public.timetable_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "HoT and admin can manage timetable entries"
ON public.timetable_entries FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'organization_admin'::app_role)
  OR public.has_role(auth.uid(), 'head_of_training'::app_role)
);

CREATE INDEX idx_timetable_entries_class ON public.timetable_entries(class_id, day, period_number);
CREATE INDEX idx_timetable_entries_trainer ON public.timetable_entries(trainer_id, day, period_number);
CREATE INDEX idx_timetable_entries_room ON public.timetable_entries(room_id, day, period_number);
CREATE UNIQUE INDEX idx_timetable_no_class_conflict ON public.timetable_entries(academic_year, term, class_id, day, period_number);

-- Timetable generation runs (metadata about each generation)
CREATE TABLE public.timetable_generation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  term INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  total_lessons INTEGER DEFAULT 0,
  placed_lessons INTEGER DEFAULT 0,
  failed_lessons INTEGER DEFAULT 0,
  global_penalty_score NUMERIC DEFAULT 0,
  conflict_report JSONB DEFAULT '[]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.timetable_generation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view generation runs"
ON public.timetable_generation_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "HoT and admin can manage generation runs"
ON public.timetable_generation_runs FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'organization_admin'::app_role)
  OR public.has_role(auth.uid(), 'head_of_training'::app_role)
);

-- Course scheduling metadata (periods_per_week, room type requirement, double period flag)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS periods_per_week INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS required_room_type TEXT DEFAULT 'classroom' CHECK (required_room_type IN ('classroom','lab','workshop'));
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_double_period BOOLEAN NOT NULL DEFAULT false;

-- Trainer max weekly load
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS max_weekly_periods INTEGER NOT NULL DEFAULT 25;
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS preferred_daily_periods INTEGER NOT NULL DEFAULT 6;
