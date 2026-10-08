DROP POLICY IF EXISTS "Applicants upload their application documents" ON storage.objects;
CREATE POLICY "Applicants upload their application documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[2] = 'applications'
  AND (storage.foldername(name))[3] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id::text = (storage.foldername(objects.name))[1] AND o.active)
);