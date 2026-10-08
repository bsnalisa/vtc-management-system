-- Recurring maintenance. Everything is event-driven except these four jobs.
--   vms-workflow-escalation   every 30 minutes  escalates approvals past their response time
--   vms-library-overdue       daily 04:00 UTC   flags overdue loans, adds fines, sends reminders
--   vms-event-reminders       hourly            sends each extra-curricular event reminder once
--   vms-message-dispatcher    every 5 minutes   sends queued email/SMS (needs the Vault secrets described below)

-- Runs one job for every active centre. A failure in one centre is logged and does not stop the others.
CREATE OR REPLACE FUNCTION public.run_scheduled_job(_job text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; n integer; total integer := 0;
BEGIN
  IF NOT public.is_job_runner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _job NOT IN ('workflow_escalation', 'library_overdue', 'event_reminders') THEN RAISE EXCEPTION 'Unknown job %', _job; END IF;
  FOR o IN SELECT id FROM public.organizations WHERE active LOOP
    BEGIN
      n := CASE _job
             WHEN 'workflow_escalation' THEN public.workflow_escalate_overdue(o.id)
             WHEN 'library_overdue'     THEN public.library_process_overdue(o.id)
             ELSE public.extracurricular_send_reminders(o.id) END;
      total := total + COALESCE(n, 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'scheduled job % failed for organization %: %', _job, o.id, SQLERRM;
    END;
  END LOOP;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.run_scheduled_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_scheduled_job(text) TO service_role;

-- Calls the dispatch-outbound-messages edge function. The function address and its shared secret are read from
-- Supabase Vault at run time, so no secret is ever stored in the repository or in the cron job text.
-- Until both Vault secrets exist this does nothing.
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'vms_functions_url');
--   select vault.create_secret('<the same value as the DISPATCH_SECRET edge function secret>', 'vms_dispatch_secret');
CREATE OR REPLACE FUNCTION public.invoke_message_dispatcher()
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _url text; _secret text; _id bigint;
BEGIN
  IF NOT public.is_job_runner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  BEGIN
    EXECUTE $q$select decrypted_secret from vault.decrypted_secrets where name = 'vms_functions_url'$q$ INTO _url;
    EXECUTE $q$select decrypted_secret from vault.decrypted_secrets where name = 'vms_dispatch_secret'$q$ INTO _secret;
  EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
    RETURN NULL; -- Vault is not available here
  END;
  IF COALESCE(_url, '') = '' OR COALESCE(_secret, '') = '' THEN RETURN NULL; END IF;
  BEGIN
    EXECUTE $q$select net.http_post(url := $1, headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', $2), body := '{}'::jsonb)$q$
      INTO _id USING rtrim(_url, '/') || '/dispatch-outbound-messages', _secret;
  EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
    RAISE WARNING 'pg_net is not available; the message dispatcher was not called';
    RETURN NULL;
  END;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.invoke_message_dispatcher() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_message_dispatcher() TO service_role;

-- Schedule (idempotent: replaces any earlier definition of the same job). Skipped where pg_cron is not installed.
DO $sched$
DECLARE j text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not installed: recurring jobs were not scheduled (see docs/scheduled-jobs.md)';
    RETURN;
  END IF;
  FOREACH j IN ARRAY ARRAY['vms-workflow-escalation', 'vms-library-overdue', 'vms-event-reminders', 'vms-message-dispatcher'] LOOP
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = j;
  END LOOP;
  PERFORM cron.schedule('vms-workflow-escalation', '*/30 * * * *', $c$select public.run_scheduled_job('workflow_escalation')$c$);
  PERFORM cron.schedule('vms-library-overdue',     '0 4 * * *',    $c$select public.run_scheduled_job('library_overdue')$c$);
  PERFORM cron.schedule('vms-event-reminders',     '15 * * * *',   $c$select public.run_scheduled_job('event_reminders')$c$);
  PERFORM cron.schedule('vms-message-dispatcher',  '*/5 * * * *',  $c$select public.invoke_message_dispatcher()$c$);
END $sched$;
