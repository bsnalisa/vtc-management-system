-- Create table for draft applications (incomplete applications that can be resumed)
CREATE TABLE public.application_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  form_data JSONB NOT NULL DEFAULT '{}',
  current_tab TEXT DEFAULT 'personal',
  progress_percentage INTEGER DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.application_drafts ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own drafts
CREATE POLICY "Users can view their own drafts"
  ON public.application_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own drafts"
  ON public.application_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
  ON public.application_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
  ON public.application_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- Staff can view drafts in their organization
CREATE POLICY "Staff can view organization drafts"
  ON public.application_drafts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.organization_id = application_drafts.organization_id
      AND ur.role IN ('admin', 'organization_admin', 'registration_officer')
    )
  );

-- Index for faster lookups
CREATE INDEX idx_application_drafts_user_id ON public.application_drafts(user_id);
CREATE INDEX idx_application_drafts_org_id ON public.application_drafts(organization_id);