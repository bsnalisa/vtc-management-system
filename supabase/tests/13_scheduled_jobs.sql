\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set orgA 'a0000000-0000-0000-0000-00000000000a'

-- Supabase API requests connect as "authenticator" and then SET ROLE; the scheduler connects as postgres.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login; end if;
  grant anon, authenticated, service_role to authenticator;
end $$;

-- ===== the database scheduler (session user postgres, no JWT) is accepted =====
select public.assert(public.is_job_runner(), 'scheduler/SQL editor session counts as a job runner');
select public.assert(public.workflow_escalate_overdue(:'orgA') >= 0 and public.library_process_overdue(:'orgA') >= 0 and public.extracurricular_send_reminders(:'orgA') >= 0, 'the three maintenance functions accept the scheduler');
select public.assert(public.run_scheduled_job('library_overdue') >= 0 and public.run_scheduled_job('workflow_escalation') >= 0 and public.run_scheduled_job('event_reminders') >= 0, 'run_scheduled_job runs each job across centres');
select public.expect_error($$select public.run_scheduled_job('drop_everything')$$, 'Unknown job', 'unknown job names are refused');

-- ===== API callers are not job runners, whatever role they claim =====
set session authorization authenticator;
set role anon;
select public.assert(not public.is_job_runner(), 'anonymous API caller is not a job runner');
select public.expect_error($$select public.workflow_escalate_overdue('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'anonymous caller cannot escalate approvals');
select public.expect_error($$select public.library_process_overdue('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'anonymous caller cannot run the library sweep');
select public.expect_error($$select public.extracurricular_send_reminders('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'anonymous caller cannot send reminders');
select public.expect_error($$select public.run_scheduled_job('library_overdue')$$, 'permission denied', 'run_scheduled_job is not callable by the public');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert(not public.is_job_runner(), 'a signed-in trainee is not a job runner');
select public.expect_error($$select public.library_process_overdue('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'trainee cannot run the library sweep');
select public.expect_error($$select public.invoke_message_dispatcher()$$, 'permission denied', 'trainee cannot call the dispatcher');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert(public.workflow_escalate_overdue(:'orgA') >= 0, 'a centre admin can still run escalation by hand');
reset role;
-- the service-role key still works
set role service_role; select set_config('request.jwt.claim.role', 'service_role', false); select set_config('request.jwt.claim.sub', '', false);
select public.assert(public.is_job_runner() and public.run_scheduled_job('event_reminders') >= 0, 'service role is a job runner');
reset role; select set_config('request.jwt.claim.role', '', false);
reset session authorization;
select 'OK job runner identity';

-- ===== job behaviour =====
insert into extracurricular_events (organization_id, title, category, start_date, reminder_days_before, created_by)
 values (:'orgA', 'Open day', 'other', now() + interval '1 day', 2, :'admin');
select public.assert(public.run_scheduled_job('event_reminders') = 1, 'the scheduled reminder job sends a due reminder');
select public.assert(public.run_scheduled_job('event_reminders') = 0, 'and only once');
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Reminder: Open day', 'general') = 1, 'trainees received it');
select public.assert(public.invoke_message_dispatcher() is null, 'the dispatcher job does nothing until the Vault secrets exist (and does not error)');
select 'OK job behaviour';

-- ===== stale emails expire instead of being sent weeks late =====
delete from outbound_messages;
insert into outbound_messages (organization_id, channel, recipient, subject, body, created_at) values
 (:'orgA', 'email', 'old@example.com', 'Old', 'Exam tomorrow', now() - interval '8 days'),
 (:'orgA', 'email', 'new@example.com', 'New', 'Fresh', now() - interval '1 hour');
set role service_role;
select public.assert((select count(*) from public.claim_outbound_messages(50)) = 1, 'only the fresh message is claimed');
reset role;
select public.assert((select status from outbound_messages where recipient = 'old@example.com') = 'failed' and (select error from outbound_messages where recipient = 'old@example.com') like '%expired%', 'the week-old message is marked failed with a reason, not sent');
select public.assert((select status from outbound_messages where recipient = 'new@example.com') = 'sending', 'the fresh message is on its way');
select 'OK message expiry';
