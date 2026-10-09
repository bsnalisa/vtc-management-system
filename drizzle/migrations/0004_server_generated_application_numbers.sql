CREATE OR REPLACE FUNCTION public.set_application_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Reference numbers are always issued by the server so they are sequential and cannot be chosen by the client.
  NEW.application_number := public.generate_application_number();
  RETURN NEW;
END;
$$;
UPDATE public.trainee_applications SET application_number = public.generate_application_number()
WHERE application_number LIKE 'APP-%' AND national_id = '05031400123';