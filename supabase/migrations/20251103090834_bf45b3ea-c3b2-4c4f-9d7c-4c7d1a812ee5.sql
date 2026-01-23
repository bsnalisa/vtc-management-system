-- Create documents storage bucket with RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for documents bucket

-- Organizations can view their own documents
CREATE POLICY "Organizations can view their documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents' 
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_organization(auth.uid())::text
  )
);

-- Organizations can upload their documents
CREATE POLICY "Organizations can upload documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_organization(auth.uid())::text
  )
);

-- Organizations can update their documents
CREATE POLICY "Organizations can update their documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_organization(auth.uid())::text
  )
);

-- Organizations can delete their documents
CREATE POLICY "Organizations can delete their documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_organization(auth.uid())::text
  )
);

-- Create table to track generated documents
CREATE TABLE public.generated_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'report', 'certificate', 'form', 'letter')),
  template_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  generated_by UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on generated_documents
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for generated_documents
CREATE POLICY "Organizations can view their generated documents"
ON public.generated_documents
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Authorized users can create documents"
ON public.generated_documents
FOR INSERT
WITH CHECK (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'registration_officer'::app_role)
  OR has_role(auth.uid(), 'trainer'::app_role)
);

-- Create index for faster document lookups
CREATE INDEX idx_generated_documents_org ON public.generated_documents(organization_id);
CREATE INDEX idx_generated_documents_type ON public.generated_documents(document_type);

-- Add trigger for updated_at if needed in future
-- (generated_documents is append-only for audit trail)