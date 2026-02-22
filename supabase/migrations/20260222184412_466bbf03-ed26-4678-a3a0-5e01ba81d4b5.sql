
-- Drop the unique constraint on trainer_id since it's no longer auto-generated uniquely
ALTER TABLE public.trainers DROP CONSTRAINT IF EXISTS trainers_trainer_id_key;
