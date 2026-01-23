-- Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  credits INTEGER,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create assessment types table
CREATE TABLE IF NOT EXISTS public.assessment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  weight NUMERIC(5,2) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default assessment types
INSERT INTO public.assessment_types (name, code, weight, description) VALUES
('Continuous Assessment', 'CA', 40.00, 'Ongoing assessment throughout the term'),
('Final Assessment', 'FINAL', 60.00, 'End of term final examination')
ON CONFLICT (code) DO NOTHING;

-- Create assessments table
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  assessment_type_id UUID NOT NULL REFERENCES public.assessment_types(id),
  academic_year TEXT NOT NULL,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  max_marks NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  due_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create marks table
CREATE TABLE IF NOT EXISTS public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  marks_obtained NUMERIC(5,2),
  remarks TEXT,
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  is_withheld BOOLEAN NOT NULL DEFAULT false,
  withheld_reason TEXT,
  withheld_by UUID,
  withheld_at TIMESTAMPTZ,
  UNIQUE(assessment_id, trainee_id)
);

-- Create trainee enrollments table
CREATE TABLE IF NOT EXISTS public.trainee_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trainee_id, course_id, academic_year)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fee_reminder', 'marks_released', 'marks_withheld', 'registration', 'general')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID REFERENCES public.trainees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('proof_of_registration', 'fee_statement', 'assessment_report', 'transcript')),
  file_path TEXT,
  generated_by UUID NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  academic_year TEXT
);

-- Add user_id to trainees table to link with auth
ALTER TABLE public.trainees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trainees_user_id_idx ON public.trainees(user_id) WHERE user_id IS NOT NULL;

-- Enable RLS on new tables
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainee_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courses
CREATE POLICY "Everyone can view active courses" ON public.courses
  FOR SELECT USING (active = true);

CREATE POLICY "Admins can manage courses" ON public.courses
  FOR ALL USING (is_admin(auth.uid()));

-- RLS Policies for assessment_types
CREATE POLICY "Everyone can view assessment types" ON public.assessment_types
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage assessment types" ON public.assessment_types
  FOR ALL USING (is_admin(auth.uid()));

-- RLS Policies for assessments
CREATE POLICY "Authenticated users can view assessments" ON public.assessments
  FOR SELECT USING (true);

CREATE POLICY "Trainers and coordinators can create assessments" ON public.assessments
  FOR INSERT WITH CHECK (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'trainer'::app_role) OR 
    has_role(auth.uid(), 'assessment_coordinator'::app_role)
  );

CREATE POLICY "Trainers can update their assessments" ON public.assessments
  FOR UPDATE USING (created_by = auth.uid() OR is_admin(auth.uid()));

-- RLS Policies for marks
CREATE POLICY "Trainees can view their own marks" ON public.marks
  FOR SELECT USING (
    trainee_id IN (SELECT id FROM trainees WHERE user_id = auth.uid())
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'trainer'::app_role)
    OR has_role(auth.uid(), 'assessment_coordinator'::app_role)
    OR has_role(auth.uid(), 'hod'::app_role)
  );

CREATE POLICY "Trainers can insert marks" ON public.marks
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'trainer'::app_role) OR 
    is_admin(auth.uid())
  );

CREATE POLICY "Trainers can update unlocked marks" ON public.marks
  FOR UPDATE USING (
    (has_role(auth.uid(), 'trainer'::app_role) AND is_locked = false) OR
    has_role(auth.uid(), 'assessment_coordinator'::app_role) OR
    is_admin(auth.uid())
  );

-- RLS Policies for trainee_enrollments
CREATE POLICY "Trainees can view their enrollments" ON public.trainee_enrollments
  FOR SELECT USING (
    trainee_id IN (SELECT id FROM trainees WHERE user_id = auth.uid())
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'trainer'::app_role)
    OR has_role(auth.uid(), 'registration_officer'::app_role)
  );

CREATE POLICY "Registration officers can manage enrollments" ON public.trainee_enrollments
  FOR ALL USING (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'registration_officer'::app_role)
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- RLS Policies for documents
CREATE POLICY "Trainees can view their documents" ON public.documents
  FOR SELECT USING (
    trainee_id IN (SELECT id FROM trainees WHERE user_id = auth.uid())
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'registration_officer'::app_role)
  );

CREATE POLICY "Authorized users can create documents" ON public.documents
  FOR INSERT WITH CHECK (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'registration_officer'::app_role) OR
    has_role(auth.uid(), 'trainer'::app_role)
  );

-- Create function to check trainee fees
CREATE OR REPLACE FUNCTION public.trainee_has_outstanding_fees(_trainee_id UUID, _academic_year TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fee_records
    WHERE trainee_id = _trainee_id
      AND academic_year = _academic_year
      AND balance > 0
  )
$$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_courses_updated_at ON public.courses;
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessments_updated_at ON public.assessments;
CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_marks_updated_at ON public.marks;
CREATE TRIGGER update_marks_updated_at
  BEFORE UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();