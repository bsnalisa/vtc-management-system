-- Add qualification_id column to classes table
ALTER TABLE public.classes
ADD COLUMN qualification_id uuid REFERENCES public.qualifications(id);

-- Create index for performance
CREATE INDEX idx_classes_qualification_id ON public.classes(qualification_id);