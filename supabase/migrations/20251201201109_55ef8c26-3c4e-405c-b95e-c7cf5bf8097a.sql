-- Create trainee_update_requests table for approval workflow
CREATE TABLE IF NOT EXISTS public.trainee_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('personal_details', 'enrollment_details')),
  old_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approver_id UUID,
  approval_notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trainee_update_requests ENABLE ROW LEVEL SECURITY;

-- Officers can create update requests
CREATE POLICY "Officers can create update requests"
ON public.trainee_update_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
);

-- Officers and HoTS can view requests
CREATE POLICY "Officers and HoTS can view requests"
ON public.trainee_update_requests
FOR SELECT
TO authenticated
USING (
  requested_by = auth.uid() OR
  has_role(auth.uid(), 'head_of_trainee_support'::app_role) OR
  is_admin(auth.uid())
);

-- HoTS can approve/reject
CREATE POLICY "HoTS can update requests"
ON public.trainee_update_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'head_of_trainee_support'::app_role) OR
  is_admin(auth.uid())
);

-- Indexes
CREATE INDEX idx_trainee_update_requests_status ON public.trainee_update_requests(status);
CREATE INDEX idx_trainee_update_requests_trainee_id ON public.trainee_update_requests(trainee_id);
CREATE INDEX idx_trainee_update_requests_requested_by ON public.trainee_update_requests(requested_by);

-- Trigger
CREATE TRIGGER update_trainee_update_requests_updated_at
BEFORE UPDATE ON public.trainee_update_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add tracking field to trainees
ALTER TABLE public.trainees ADD COLUMN IF NOT EXISTS has_pending_update BOOLEAN DEFAULT false;