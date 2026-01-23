-- Create organization-logos storage bucket for logo uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos for their organization
CREATE POLICY "Users can upload logos for their organization"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos' AND
  (storage.foldername(name))[1] = get_user_organization(auth.uid())::text
);

-- Allow public read access to organization logos
CREATE POLICY "Organization logos are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'organization-logos');

-- Allow users to update their organization's logos
CREATE POLICY "Users can update their organization logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-logos' AND
  (storage.foldername(name))[1] = get_user_organization(auth.uid())::text
);

-- Allow users to delete their organization's logos
CREATE POLICY "Users can delete their organization logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-logos' AND
  (storage.foldername(name))[1] = get_user_organization(auth.uid())::text
);