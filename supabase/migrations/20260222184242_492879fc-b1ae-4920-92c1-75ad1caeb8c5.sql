
-- Add user_id column to trainers table to link with auth users
ALTER TABLE public.trainers 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE;

-- Make previously required fields nullable since they'll come from profiles
ALTER TABLE public.trainers 
  ALTER COLUMN trainer_id DROP NOT NULL,
  ALTER COLUMN full_name DROP NOT NULL,
  ALTER COLUMN gender DROP NOT NULL,
  ALTER COLUMN employment_type DROP NOT NULL;

-- Add default for gender and employment_type
ALTER TABLE public.trainers 
  ALTER COLUMN gender SET DEFAULT 'other',
  ALTER COLUMN employment_type SET DEFAULT 'fulltime';
