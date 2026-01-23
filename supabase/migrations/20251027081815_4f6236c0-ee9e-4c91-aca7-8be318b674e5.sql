-- Create package type enum
CREATE TYPE package_type AS ENUM ('basic', 'extended', 'professional');

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  package package_type NOT NULL DEFAULT 'basic',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create modules table
CREATE TABLE public.modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_modules junction table
CREATE TABLE public.organization_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, module_id)
);

-- Add organization_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add organization_id to existing tables
ALTER TABLE public.trainees ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.trainers ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.classes ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.trades ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.fee_records ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_registers ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;

-- Function to check if user is organization admin
CREATE OR REPLACE FUNCTION public.is_organization_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = 'organization_admin'
      AND organization_id = _org_id
  )
$$;

-- Function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to check if organization has module access
CREATE OR REPLACE FUNCTION public.has_module_access(_org_id uuid, _module_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_modules om
    JOIN public.modules m ON om.module_id = m.id
    WHERE om.organization_id = _org_id
      AND m.code = _module_code
      AND om.enabled = true
  )
$$;

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Super admins can manage all organizations"
  ON public.organizations FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Organization admins can view their organization"
  ON public.organizations FOR SELECT
  USING (is_organization_admin(auth.uid(), id) OR id = get_user_organization(auth.uid()));

-- RLS Policies for modules
CREATE POLICY "Super admins can manage modules"
  ON public.modules FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Everyone can view active modules"
  ON public.modules FOR SELECT
  USING (active = true);

-- RLS Policies for organization_modules
CREATE POLICY "Super admins can manage organization modules"
  ON public.organization_modules FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Organization users can view their modules"
  ON public.organization_modules FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()) OR is_super_admin(auth.uid()));

-- Insert default modules
INSERT INTO public.modules (name, code, description, category) VALUES
  ('Trainee Registration', 'trainee_registration', 'Register and manage trainee information', 'core'),
  ('Trainer Management', 'trainer_management', 'Manage trainer profiles and assignments', 'core'),
  ('Assessments & Results', 'assessments', 'Create assessments and record results', 'academic'),
  ('Fee Management', 'fee_management', 'Track fees and payments', 'finance'),
  ('Attendance Tracking', 'attendance', 'Record and monitor attendance', 'academic'),
  ('Timetable Management', 'timetable', 'Create and manage class schedules', 'academic'),
  ('Class Management', 'class_management', 'Organize classes and enrollments', 'core'),
  ('Announcements', 'announcements', 'Post and manage announcements', 'communication'),
  ('Reports', 'reports', 'Generate various system reports', 'analytics');

-- Update existing RLS policies to include organization filtering
DROP POLICY IF EXISTS "Authenticated users can view trainees" ON public.trainees;
CREATE POLICY "Users can view trainees in their organization"
  ON public.trainees FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR 
    organization_id = get_user_organization(auth.uid())
  );

DROP POLICY IF EXISTS "Registration officers and admins can manage trainees" ON public.trainees;
CREATE POLICY "Authorized users can manage trainees in their organization"
  ON public.trainees FOR ALL
  USING (
    is_super_admin(auth.uid()) OR 
    (organization_id = get_user_organization(auth.uid()) AND 
     (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer')))
  );

-- Create trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();