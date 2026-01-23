-- Create organization_settings table for tenant branding
CREATE TABLE public.organization_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,
  color_theme JSONB DEFAULT '{"primary": "hsl(222.2 47.4% 11.2%)", "secondary": "hsl(210 40% 96.1%)", "accent": "hsl(210 40% 96.1%)"}',
  favicon TEXT,
  domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on organization_settings
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Organization admins can view their settings
CREATE POLICY "Organization users can view their settings"
ON public.organization_settings
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid()) 
  OR is_super_admin(auth.uid())
);

-- Organization admins and super admins can manage settings
CREATE POLICY "Admins can manage organization settings"
ON public.organization_settings
FOR ALL
USING (
  is_organization_admin(auth.uid(), organization_id) 
  OR is_super_admin(auth.uid())
);

-- Add trigger for updated_at
CREATE TRIGGER update_organization_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trainers table RLS to enforce organization isolation
DROP POLICY IF EXISTS "Authenticated users can view trainers" ON public.trainers;
CREATE POLICY "Users can view trainers in their organization"
ON public.trainers
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR organization_id = get_user_organization(auth.uid())
);

-- Update trainees RLS policies to be more explicit about organization isolation
DROP POLICY IF EXISTS "Users can view trainees in their organization" ON public.trainees;
CREATE POLICY "Users can view trainees in their organization"
ON public.trainees
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR organization_id = get_user_organization(auth.uid())
);

-- Update classes RLS for organization isolation
DROP POLICY IF EXISTS "Everyone can view active classes" ON public.classes;
CREATE POLICY "Users can view classes in their organization"
ON public.classes
FOR SELECT
USING (
  (active = true) AND (
    is_super_admin(auth.uid()) 
    OR organization_id = get_user_organization(auth.uid())
  )
);

-- Update attendance_registers RLS
DROP POLICY IF EXISTS "Authenticated users can view attendance registers" ON public.attendance_registers;
CREATE POLICY "Users can view attendance registers in their organization"
ON public.attendance_registers
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR organization_id = get_user_organization(auth.uid())
);

-- Update fee_records RLS for organization isolation
DROP POLICY IF EXISTS "Authenticated users can view fee records" ON public.fee_records;
CREATE POLICY "Users can view fee records in their organization"
ON public.fee_records
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR organization_id = get_user_organization(auth.uid())
);

-- Update trades RLS for organization isolation
DROP POLICY IF EXISTS "Everyone can view trades" ON public.trades;
CREATE POLICY "Users can view trades in their organization"
ON public.trades
FOR SELECT
USING (
  active = true AND (
    is_super_admin(auth.uid()) 
    OR organization_id IS NULL 
    OR organization_id = get_user_organization(auth.uid())
  )
);

-- Update announcements RLS for organization isolation
DROP POLICY IF EXISTS "Users can view active announcements" ON public.announcements;
CREATE POLICY "Users can view announcements in their organization"
ON public.announcements
FOR SELECT
USING (
  active = true 
  AND (expires_at IS NULL OR expires_at > now())
  AND (
    is_super_admin(auth.uid()) 
    OR organization_id IS NULL 
    OR organization_id = get_user_organization(auth.uid())
  )
  AND (
    target_roles = ARRAY[]::app_role[] 
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = ANY(announcements.target_roles)
    )
  )
);