-- Add subdomain column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Create index for faster subdomain lookups
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain 
ON public.organizations(subdomain) 
WHERE subdomain IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.organizations.subdomain IS 'Unique subdomain for organization (e.g., vtcname in vtcname.nvtc.app)';
