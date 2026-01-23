-- Create classes table for organizing trainees
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(id),
  level INTEGER NOT NULL,
  training_mode training_mode NOT NULL,
  class_code TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  capacity INTEGER DEFAULT 30,
  trainer_id UUID REFERENCES public.trainers(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create class enrollments junction table
CREATE TABLE public.class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  enrolled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, trainee_id)
);

-- Create timetable slots table
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_number TEXT,
  academic_year TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_roles app_role[] DEFAULT ARRAY[]::app_role[],
  published_by UUID NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes
CREATE POLICY "Everyone can view active classes"
  ON public.classes FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage classes"
  ON public.classes FOR ALL
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'));

-- RLS Policies for class_enrollments
CREATE POLICY "Authenticated users can view class enrollments"
  ON public.class_enrollments FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage class enrollments"
  ON public.class_enrollments FOR ALL
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'));

-- RLS Policies for timetable_slots
CREATE POLICY "Everyone can view active timetables"
  ON public.timetable_slots FOR SELECT
  USING (active = true);

CREATE POLICY "Admins and trainers can manage timetables"
  ON public.timetable_slots FOR ALL
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'trainer') OR has_role(auth.uid(), 'hod'));

-- RLS Policies for announcements
CREATE POLICY "Users can view active announcements"
  ON public.announcements FOR SELECT
  USING (
    active = true AND
    (expires_at IS NULL OR expires_at > now()) AND
    (target_roles = ARRAY[]::app_role[] OR 
     EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY(target_roles)))
  );

CREATE POLICY "Admins and HODs can create announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'hod'));

CREATE POLICY "Publishers can update their announcements"
  ON public.announcements FOR UPDATE
  USING (published_by = auth.uid() OR is_admin(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timetable_slots_updated_at
  BEFORE UPDATE ON public.timetable_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_classes_trade_level ON public.classes(trade_id, level);
CREATE INDEX idx_class_enrollments_trainee ON public.class_enrollments(trainee_id);
CREATE INDEX idx_timetable_day ON public.timetable_slots(day_of_week);
CREATE INDEX idx_announcements_active ON public.announcements(active, expires_at);