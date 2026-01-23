-- Create storage bucket for organization backups
INSERT INTO storage.buckets (id, name, public) 
VALUES ('organization-backups', 'organization-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read their organization's backups
CREATE POLICY "Organization admins can view their backups"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'organization-backups' 
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_organization(auth.uid())::text
  )
);

-- Allow system to create backups (service role will handle this)
CREATE POLICY "Service role can create backups"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'organization-backups');