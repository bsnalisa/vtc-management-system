-- Update the generate_trainee_id function to use NVTC prefix
CREATE OR REPLACE FUNCTION public.generate_trainee_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id TEXT;
  year_suffix TEXT;
  counter INTEGER;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(trainee_id FROM 9) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.trainees
  WHERE trainee_id LIKE 'NVTC' || year_suffix || '%';
  
  new_id := 'NVTC' || year_suffix || LPAD(counter::TEXT, 4, '0');
  
  RETURN new_id;
END;
$function$;