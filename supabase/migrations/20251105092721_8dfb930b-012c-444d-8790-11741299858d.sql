-- Create employers table
CREATE TABLE IF NOT EXISTS public.employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  rating NUMERIC CHECK (rating >= 0 AND rating <= 5),
  website TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employer_interactions table
CREATE TABLE IF NOT EXISTS public.employer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  employer_id UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  interaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  conducted_by UUID NOT NULL,
  notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job_postings table
CREATE TABLE IF NOT EXISTS public.job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  salary_range TEXT,
  requirements TEXT,
  closing_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed', 'filled')),
  posted_by UUID NOT NULL,
  posted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job_applications table
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'shortlisted', 'interviewed', 'hired', 'rejected')),
  cover_letter TEXT,
  resume_path TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, trainee_id)
);

-- Create internship_placements table
CREATE TABLE IF NOT EXISTS public.internship_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  supervisor_name TEXT,
  supervisor_contact TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'cancelled')),
  evaluation_score NUMERIC CHECK (evaluation_score >= 0 AND evaluation_score <= 100),
  evaluation_remarks TEXT,
  attachment_letter_path TEXT,
  placement_number TEXT NOT NULL,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_placements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employers
CREATE POLICY "Placement officers and admins can manage employers"
ON public.employers FOR ALL
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Users can view employers in their organization"
ON public.employers FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- RLS Policies for employer_interactions
CREATE POLICY "Placement officers and admins can manage interactions"
ON public.employer_interactions FOR ALL
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Users can view interactions in their organization"
ON public.employer_interactions FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- RLS Policies for job_postings
CREATE POLICY "Placement officers and admins can manage job postings"
ON public.job_postings FOR ALL
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Users can view active job postings in their organization"
ON public.job_postings FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  AND (status = 'active' OR is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
);

-- RLS Policies for job_applications
CREATE POLICY "Placement officers and admins can manage applications"
ON public.job_applications FOR ALL
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Trainees can view and create their own applications"
ON public.job_applications FOR SELECT
USING (
  trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
  OR is_admin(auth.uid())
  OR has_role(auth.uid(), 'placement_officer'::app_role)
);

CREATE POLICY "Trainees can create applications"
ON public.job_applications FOR INSERT
WITH CHECK (
  trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
  AND organization_id = get_user_organization(auth.uid())
);

-- RLS Policies for internship_placements
CREATE POLICY "Placement officers and admins can manage placements"
ON public.internship_placements FOR ALL
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Trainees can view their own placements"
ON public.internship_placements FOR SELECT
USING (
  trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
  OR is_admin(auth.uid())
  OR has_role(auth.uid(), 'placement_officer'::app_role)
);

-- Update alumni RLS policies to include placement_officer
DROP POLICY IF EXISTS "Admins can manage alumni" ON public.alumni;
CREATE POLICY "Admins and placement officers can manage alumni"
ON public.alumni FOR ALL
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage employment" ON public.alumni_employment;
CREATE POLICY "Admins and placement officers can manage employment"
ON public.alumni_employment FOR ALL
USING (
  alumni_id IN (
    SELECT id FROM public.alumni 
    WHERE organization_id = get_user_organization(auth.uid())
  )
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
);

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.alumni_announcements;
CREATE POLICY "Admins and placement officers can manage announcements"
ON public.alumni_announcements FOR ALL
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage events" ON public.alumni_events;
CREATE POLICY "Admins and placement officers can manage events"
ON public.alumni_events FOR ALL
USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'placement_officer'::app_role))
  AND organization_id = get_user_organization(auth.uid())
);

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER update_employers_updated_at
BEFORE UPDATE ON public.employers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_employer_interactions_updated_at
BEFORE UPDATE ON public.employer_interactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_job_postings_updated_at
BEFORE UPDATE ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_job_applications_updated_at
BEFORE UPDATE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_internship_placements_updated_at
BEFORE UPDATE ON public.internship_placements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();