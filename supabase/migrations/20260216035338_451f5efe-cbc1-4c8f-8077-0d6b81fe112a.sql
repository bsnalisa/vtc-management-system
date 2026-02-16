
-- Add assessment workflow status to assessment_results
-- Using a text column with CHECK constraint for the status workflow
ALTER TABLE public.assessment_results
ADD COLUMN IF NOT EXISTS assessment_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (assessment_status IN ('draft', 'submitted_by_trainer', 'returned_to_trainer', 'approved_by_hot', 'finalised'));

-- Add audit timestamp columns
ALTER TABLE public.assessment_results
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hot_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hot_approved_by UUID,
ADD COLUMN IF NOT EXISTS ac_finalised_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ac_finalised_by UUID,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS return_reason TEXT;

-- Set all existing records to 'finalised' for backward compatibility
UPDATE public.assessment_results
SET assessment_status = 'finalised'
WHERE assessment_status = 'draft';

-- Add index for status-based queries
CREATE INDEX IF NOT EXISTS idx_assessment_results_status ON public.assessment_results(assessment_status);
