-- Fix search_path for update_full_name function
CREATE OR REPLACE FUNCTION public.update_full_name()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.full_name := TRIM(COALESCE(NEW.firstname, '') || ' ' || COALESCE(NEW.surname, ''));
  RETURN NEW;
END;
$$;