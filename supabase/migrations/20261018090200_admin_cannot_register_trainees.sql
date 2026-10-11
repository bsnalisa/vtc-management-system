-- Registering trainees is the registration officer's job. An Organization Admin supports trainees' accounts after
-- registration but cannot create trainee, registration or enrolment records (unless they also hold the registration officer role).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trainees', 'registrations', 'trainee_enrollments'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Admins do not register trainees" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins do not register trainees" ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT (SELECT public.is_org_admin_only(auth.uid())) OR public.has_role(auth.uid(), ''registration_officer''))', t);
  END LOOP;
END $$;
