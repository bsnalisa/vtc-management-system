-- Create trigger to auto-generate trainee_id when a trainee is inserted
CREATE OR REPLACE FUNCTION public.set_trainee_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if trainee_id is empty or null
  IF NEW.trainee_id IS NULL OR NEW.trainee_id = '' THEN
    NEW.trainee_id := public.generate_trainee_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_set_trainee_id ON public.trainees;
CREATE TRIGGER auto_set_trainee_id
  BEFORE INSERT ON public.trainees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trainee_id();

-- Add unique constraint on national_id to prevent duplicates
ALTER TABLE public.trainees 
  DROP CONSTRAINT IF EXISTS trainees_national_id_key;
  
ALTER TABLE public.trainees 
  ADD CONSTRAINT trainees_national_id_unique 
  UNIQUE (national_id);