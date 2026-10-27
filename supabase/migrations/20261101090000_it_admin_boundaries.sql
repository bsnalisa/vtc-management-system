-- Follow-ups to the IT Systems Administrator role.
--  1. The administrator keeps reading academic operational records (classes, timetables, assessments, trainers, enrolments) to
--     help with support, but can no longer create, change or delete them: those belong to training and academic staff. Setup the
--     role still owns (registration windows, academic calendar, document settings, modules, workflows) is not touched.
--  2. The IT dashboard says whether message delivery is set up. The dispatcher job runs every five minutes but does nothing until
--     two Vault settings exist, and until then nothing has ever been sent; the figures now tell the administrator that.

-- ---------------------------------------------------------------------------
-- 1. Academic records are not written by the IT administrator
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.not_it_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NULL OR NOT public.is_org_admin_only(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.not_it_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.not_it_admin() TO anon, authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assessments', 'assessment_cycles', 'attendance_registers', 'class_enrollments', 'classes', 'exam_timetables', 'gradebook_mark_queries',
      'invigilators', 'progression_rules', 'timetable_entries', 'timetable_slots', 'timetable_generation_runs', 'trade_levels', 'trades', 'trainee_enrollments',
      'trainer_qualifications', 'trainer_trades', 'trainers', 'training_modules', 'internship_placements', 'courses'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "IT administrators do not change academic records (insert)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "IT administrators do not change academic records (update)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "IT administrators do not change academic records (delete)" ON public.%I', t);
    EXECUTE format('CREATE POLICY "IT administrators do not change academic records (insert)" ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (public.not_it_admin())', t);
    EXECUTE format('CREATE POLICY "IT administrators do not change academic records (update)" ON public.%I AS RESTRICTIVE FOR UPDATE USING (public.not_it_admin()) WITH CHECK (public.not_it_admin())', t);
    EXECUTE format('CREATE POLICY "IT administrators do not change academic records (delete)" ON public.%I AS RESTRICTIVE FOR DELETE USING (public.not_it_admin())', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Is message delivery set up?
-- ---------------------------------------------------------------------------
-- True when both Vault settings the dispatcher job needs exist (see docs/messaging-setup.md). Reads names only, never values.
CREATE OR REPLACE FUNCTION public.message_delivery_configured() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  BEGIN
    EXECUTE $q$select count(*) from vault.decrypted_secrets where name in ('vms_functions_url', 'vms_dispatch_secret') and coalesce(decrypted_secret, '') <> ''$q$ INTO n;
  EXCEPTION WHEN undefined_table OR invalid_schema_name THEN RETURN false;
  END;
  RETURN n = 2;
END $$;
REVOKE ALL ON FUNCTION public.message_delivery_configured() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.it_system_counts(_orgs uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'delivery_configured', public.message_delivery_configured(),
    'messages_sent_7d', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = ANY (_orgs) AND status = 'sent' AND sent_at > now() - interval '7 days'),
    'messages_waiting', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = ANY (_orgs) AND status = 'queued' AND created_at < now() - interval '1 hour'),
    'messages_failed_7d', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = ANY (_orgs) AND status = 'failed' AND created_at > now() - interval '7 days'),
    'account_setup_failures_14d', (SELECT count(*) FROM public.provisioning_logs WHERE organization_id = ANY (_orgs) AND result = 'failed' AND created_at > now() - interval '14 days'),
    'modules_enabled', (SELECT count(*) FROM public.organization_modules WHERE organization_id = ANY (_orgs) AND enabled))
$$;
REVOKE ALL ON FUNCTION public.it_system_counts(uuid[]) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Academic and registration functions no longer admit the IT administrator
-- ---------------------------------------------------------------------------
-- These SECURITY DEFINER functions bypass row security, so closing the tables is not enough: each lists the roles that may call it.
-- The role lists are patched in place; a function that no longer matches the expected text stops the migration instead of being skipped.
DO $$
DECLARE
  r record; _def text;
  _patches jsonb := jsonb_build_array(
    jsonb_build_object('fn', 'publish_timetable(text, integer, boolean)',
      'old', 'ARRAY[''admin'',''organization_admin'',''head_of_training'']', 'new', 'ARRAY[''head_of_training'']'),
    jsonb_build_object('fn', 'issue_transcript(uuid, text)',
      'old', 'ARRAY[''admin'',''organization_admin'',''registration_officer'',''head_of_training'']', 'new', 'ARRAY[''registration_officer'',''head_of_training'']'),
    jsonb_build_object('fn', 'lock_assessment_cycle(uuid, uuid, text, text)',
      'old', 'ARRAY[''organization_admin'',''admin'',''head_of_training'',''assessment_coordinator'']', 'new', 'ARRAY[''head_of_training'',''assessment_coordinator'']'),
    jsonb_build_object('fn', 'request_application_info(uuid, text)',
      'old', 'ARRAY[''admin'',''organization_admin'',''registration_officer'']', 'new', 'ARRAY[''registration_officer'']'),
    jsonb_build_object('fn', 'allocate_trainee_identity(uuid)',
      'old', 'ARRAY[''registration_officer'', ''debtor_officer'', ''head_of_trainee_support'', ''organization_admin'', ''admin'']', 'new', 'ARRAY[''registration_officer'', ''debtor_officer'', ''head_of_trainee_support'']'));
BEGIN
  FOR r IN SELECT value AS p FROM jsonb_array_elements(_patches) LOOP
    _def := pg_get_functiondef(('public.' || (r.p->>'fn'))::regprocedure);
    IF position(r.p->>'old' IN _def) = 0 THEN RAISE EXCEPTION 'Expected role list not found in %', r.p->>'fn'; END IF;
    EXECUTE replace(_def, r.p->>'old', r.p->>'new');
  END LOOP;
END $$;
