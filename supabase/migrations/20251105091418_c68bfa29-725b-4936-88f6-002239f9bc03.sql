-- Create alumni table
CREATE TABLE public.alumni (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  trainee_id UUID NOT NULL,
  graduation_year INTEGER NOT NULL,
  graduation_date DATE,
  final_trade_id UUID,
  final_level INTEGER,
  national_id TEXT,
  email TEXT,
  phone TEXT,
  alternative_phone TEXT,
  current_address TEXT,
  linkedin_profile TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Create alumni employment records table
CREATE TABLE public.alumni_employment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  alumni_id UUID NOT NULL,
  employer_name TEXT NOT NULL,
  position TEXT NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  salary_range TEXT,
  location TEXT,
  industry TEXT,
  job_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create alumni events table
CREATE TABLE public.alumni_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  description TEXT,
  max_attendees INTEGER,
  registration_deadline DATE,
  organizer_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create alumni event registrations table
CREATE TABLE public.alumni_event_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  event_id UUID NOT NULL,
  alumni_id UUID NOT NULL,
  registration_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  attendance_status TEXT NOT NULL DEFAULT 'registered',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create alumni announcements table
CREATE TABLE public.alumni_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  announcement_type TEXT NOT NULL DEFAULT 'general',
  target_graduation_years INTEGER[],
  target_trade_ids UUID[],
  published_by UUID NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.alumni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alumni table
CREATE POLICY "Users can view alumni in their organization"
  ON public.alumni FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage alumni"
  ON public.alumni FOR ALL
  USING (
    is_admin(auth.uid())
    AND organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for alumni_employment table
CREATE POLICY "Users can view employment in their organization"
  ON public.alumni_employment FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage employment"
  ON public.alumni_employment FOR ALL
  USING (
    is_admin(auth.uid())
    AND organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for alumni_events table
CREATE POLICY "Users can view events in their organization"
  ON public.alumni_events FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage events"
  ON public.alumni_events FOR ALL
  USING (
    is_admin(auth.uid())
    AND organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for alumni_event_registrations table
CREATE POLICY "Users can view registrations in their organization"
  ON public.alumni_event_registrations FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage registrations"
  ON public.alumni_event_registrations FOR ALL
  USING (
    is_admin(auth.uid())
    AND organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for alumni_announcements table
CREATE POLICY "Users can view published announcements in their organization"
  ON public.alumni_announcements FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    AND (status = 'published' OR is_admin(auth.uid()))
  );

CREATE POLICY "Admins can manage announcements"
  ON public.alumni_announcements FOR ALL
  USING (
    is_admin(auth.uid())
    AND organization_id = get_user_organization(auth.uid())
  );

-- Create triggers for updated_at
CREATE TRIGGER update_alumni_updated_at
  BEFORE UPDATE ON public.alumni
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alumni_employment_updated_at
  BEFORE UPDATE ON public.alumni_employment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alumni_events_updated_at
  BEFORE UPDATE ON public.alumni_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alumni_announcements_updated_at
  BEFORE UPDATE ON public.alumni_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();