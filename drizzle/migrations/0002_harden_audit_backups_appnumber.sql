DROP POLICY IF EXISTS "System insert audit logs" ON public.gradebook_audit_logs;
DROP POLICY IF EXISTS "Service role can create backups" ON storage.objects;

CREATE OR REPLACE FUNCTION public.set_application_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.application_number IS NULL OR NEW.application_number = '' OR NEW.application_number !~ '[0-9]' THEN
    NEW.application_number := public.generate_application_number();
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.trainee_applications SET application_number = public.generate_application_number()
WHERE application_number = 'TEMP';