-- Create unit standards table
CREATE TABLE public.unit_standards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_no TEXT NOT NULL UNIQUE,
  module_title TEXT NOT NULL,
  level INTEGER NOT NULL,
  credit INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create course unit standards linking table
CREATE TABLE public.course_unit_standards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  unit_standard_id UUID NOT NULL REFERENCES public.unit_standards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, unit_standard_id)
);

-- Create assessment results table
CREATE TABLE public.assessment_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.trainee_enrollments(id) ON DELETE CASCADE,
  unit_standard_id UUID NOT NULL REFERENCES public.unit_standards(id) ON DELETE CASCADE,
  marks_obtained NUMERIC,
  competency_status TEXT CHECK (competency_status IN ('competent', 'not_yet_competent', 'pending')),
  assessment_date DATE,
  assessed_by UUID REFERENCES auth.users(id),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trainee_id, enrollment_id, unit_standard_id)
);

-- Add completion status to trainee_enrollments
ALTER TABLE public.trainee_enrollments 
  ALTER COLUMN status TYPE TEXT,
  ALTER COLUMN status SET DEFAULT 'active',
  ADD CONSTRAINT status_check CHECK (status IN ('active', 'completed', 'withdrawn', 'suspended'));

-- Function to check if trainee can enroll in a new course
CREATE OR REPLACE FUNCTION public.can_trainee_enroll(
  _trainee_id UUID,
  _training_mode training_mode
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_enrollments INTEGER;
  has_fulltime BOOLEAN;
  has_bdl BOOLEAN;
  has_shortcourse BOOLEAN;
BEGIN
  -- Check active enrollments
  SELECT COUNT(*) INTO active_enrollments
  FROM trainee_enrollments te
  JOIN trainees t ON te.trainee_id = t.id
  WHERE t.id = _trainee_id AND te.status = 'active';
  
  -- If no active enrollments, allow
  IF active_enrollments = 0 THEN
    RETURN true;
  END IF;
  
  -- Check existing modes
  SELECT 
    bool_or(t.training_mode = 'fulltime'),
    bool_or(t.training_mode = 'bdl'),
    bool_or(t.training_mode = 'shortcourse')
  INTO has_fulltime, has_bdl, has_shortcourse
  FROM trainee_enrollments te
  JOIN trainees t ON te.trainee_id = t.id
  WHERE t.id = _trainee_id AND te.status = 'active';
  
  -- Allow if adding shortcourse to fulltime or bdl
  IF _training_mode = 'shortcourse' AND (has_fulltime OR has_bdl) AND NOT (has_fulltime AND has_bdl) THEN
    RETURN true;
  END IF;
  
  -- Reject all other combinations
  RETURN false;
END;
$$;

-- Enable RLS on new tables
ALTER TABLE public.unit_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_unit_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for unit_standards
CREATE POLICY "Everyone can view unit standards"
  ON public.unit_standards FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage unit standards"
  ON public.unit_standards FOR ALL
  USING (is_admin(auth.uid()));

-- RLS policies for course_unit_standards
CREATE POLICY "Everyone can view course unit standards"
  ON public.course_unit_standards FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage course unit standards"
  ON public.course_unit_standards FOR ALL
  USING (is_admin(auth.uid()));

-- RLS policies for assessment_results
CREATE POLICY "Trainees can view their own results"
  ON public.assessment_results FOR SELECT
  USING (
    trainee_id IN (SELECT id FROM trainees WHERE user_id = auth.uid())
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'trainer')
    OR has_role(auth.uid(), 'assessment_coordinator')
  );

CREATE POLICY "Trainers and coordinators can manage results"
  ON public.assessment_results FOR ALL
  USING (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'trainer')
    OR has_role(auth.uid(), 'assessment_coordinator')
  );

-- Add triggers for updated_at
CREATE TRIGGER update_unit_standards_updated_at
  BEFORE UPDATE ON public.unit_standards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_results_updated_at
  BEFORE UPDATE ON public.assessment_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert ICT Foundation Level 2 unit standards
INSERT INTO public.unit_standards (unit_no, module_title, level, credit) VALUES
  ('2327', 'Recognise PC equipment and accessories', 1, 5),
  ('2338', 'Describe software for personal computers', 3, 6),
  ('2329', 'Identify and utilise operating system components', 2, 4),
  ('2330', 'Use basic word processing', 2, 10),
  ('2331', 'Use basic spreadsheets', 2, 12),
  ('2333', 'Use basic presentation', 2, 6),
  ('2328', 'Perform desktop publishing', 2, 5),
  ('2336', 'Perform advanced word processing', 3, 5),
  ('2337', 'Perform advanced presentation', 3, 4),
  ('2335', 'Perform advanced spreadsheet functions', 3, 6),
  ('2334', 'Demonstrate an understanding of database architecture and functions', 2, 10),
  ('2332', 'Use basic internet and email applications', 2, 4);