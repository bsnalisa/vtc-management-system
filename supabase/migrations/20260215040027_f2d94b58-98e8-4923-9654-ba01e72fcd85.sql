
-- Create trainer-qualification assignment table
CREATE TABLE public.trainer_qualifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  UNIQUE(trainer_id, qualification_id)
);

-- Enable RLS
ALTER TABLE public.trainer_qualifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view trainer qualifications in their org"
  ON public.trainer_qualifications FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Head of training and admins can manage trainer qualifications"
  ON public.trainer_qualifications FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('head_of_training', 'organization_admin', 'admin', 'super_admin')
  ));
