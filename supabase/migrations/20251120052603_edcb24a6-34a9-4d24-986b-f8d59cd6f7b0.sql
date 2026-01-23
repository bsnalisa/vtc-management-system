-- Add organization_name column to organization_settings table
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- Add comment
COMMENT ON COLUMN public.organization_settings.organization_name IS 'Name of the organization for branding purposes';