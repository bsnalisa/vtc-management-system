-- Run after applying the migrations. Every row should have passed = true.
--   Supabase SQL editor, or:  psql "$DATABASE_URL" -f supabase/verify/post_apply_checks.sql
with expected_policies(tablename, policyname) as (values
  ('alumni','Staff or the graduate view alumni'), ('ca_final_results','Staff or the trainee view ca final results'),
  ('ca_final_results','Assessment staff manage ca final results'), ('hostel_fees','Staff or the resident view hostel fees'),
  ('hostel_visitors','Staff or the resident view hostel visitors'), ('invoices','Staff or the trainee view invoices'),
  ('payment_plans','Staff or the trainee view payment plans'), ('summative_results','Staff or the trainee view summative results'),
  ('qualification_results','Staff or the trainee view qualification results'), ('proof_of_registrations','Staff or the trainee view proof of registrations'),
  ('transcripts','Trainees view their own transcripts'), ('trainee_financial_accounts','tfa_staff_or_owner_read'),
  ('financial_transactions','ft_staff_or_owner_read'), ('exam_timetables','Staff can view exam timetables')),
old_policies(tablename, policyname) as (values
  ('alumni','Users can view alumni in their organization'), ('ca_final_results','Staff can view ca final results'),
  ('ca_final_results','System can manage ca final results'), ('hostel_fees','Users can view fees in their organization'),
  ('hostel_visitors','Users can view visitors in their organization'), ('invoices','Users can view invoices in their organization'),
  ('payment_plans','Users can view payment plans in their organization'), ('summative_results','Staff can view summative results'),
  ('qualification_results','Staff can view qualification results'), ('proof_of_registrations','Users can view proof of registrations'),
  ('transcripts','Trainees can view their transcripts'), ('trainee_financial_accounts','tfa_org_read'), ('financial_transactions','ft_org_read'),
  ('attendance_records','Authenticated users can view attendance records'), ('attendance_records','Trainers and admins can manage attendance records')),
new_tables(t) as (values
  ('trainee_affairs_records'),('extracurricular_events'),('anonymous_submissions'),('library_settings'),('library_members'),('library_reservations'),('interlibrary_loans'),
  ('outbound_messages'),('graduation_ceremonies'),('graduation_invitations'),('graduate_surveys'),('survey_questions'),('survey_recipients'),('survey_responses'),
  ('assessment_requests'),('sme_applications'),('assessment_development_plans'),('question_bank_items'),('question_papers'),('question_paper_items'),
  ('assessment_sittings'),('assessment_sitting_candidates'),('assessment_roster_entries'),('delivery_plans'),('delivery_plan_weeks'),('logbook_entries'),
  ('workflow_process_types'),('workflow_definitions'),('workflow_steps'),('workflow_settings'),('workflow_alert_settings'),('workflow_instances'),
  ('workflow_tasks'),('workflow_task_assignees'),('workflow_action_tokens'),('workflow_delegations'),('workflow_events'))
select * from (
  select 'old permissive policies are gone' as check_name,
         not exists (select 1 from old_policies o join pg_policies p on p.schemaname='public' and p.tablename=o.tablename and p.policyname=o.policyname) as passed,
         coalesce((select string_agg(o.tablename||'.'||o.policyname, '; ') from old_policies o join pg_policies p on p.schemaname='public' and p.tablename=o.tablename and p.policyname=o.policyname), 'none left') as detail
  union all
  select 'replacement policies are in place',
         not exists (select 1 from expected_policies e where not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=e.tablename and p.policyname=e.policyname)),
         coalesce((select string_agg(e.tablename||'.'||e.policyname, '; ') from expected_policies e where not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=e.tablename and p.policyname=e.policyname)), 'all present')
  union all
  select 'no attendance policy is open to everyone',
         not exists (select 1 from pg_policies where schemaname='public' and tablename='attendance_records' and coalesce(qual,'') = 'true'),
         coalesce((select string_agg(policyname, '; ') from pg_policies where schemaname='public' and tablename='attendance_records'), 'no policies')
  union all
  select 'new tables exist with row-level security on',
         not exists (select 1 from new_tables n left join pg_class c on c.relname=n.t and c.relnamespace='public'::regnamespace where c.oid is null or not c.relrowsecurity),
         coalesce((select string_agg(n.t, ', ') from new_tables n left join pg_class c on c.relname=n.t and c.relnamespace='public'::regnamespace where c.oid is null or not c.relrowsecurity), 'all 37 protected')
  union all
  select 'notifications accept the types the app sends',
         exists (select 1 from pg_constraint where conname='notifications_type_check' and pg_get_constraintdef(oid) like '%^[a-z][a-z_]*$%'),
         coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname='notifications_type_check'), 'no constraint')
  union all
  select 'new roles and training modes exist',
         (select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where (t.typname='app_role' and e.enumlabel in ('subject_matter_expert','printing_distribution_officer')) or (t.typname='training_mode' and e.enumlabel in ('apprenticeship','rpl'))) = 4,
         (select string_agg(e.enumlabel, ', ') from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='training_mode')
  union all
  select 'new roles can be assigned (custom_roles)',
         (select count(*) from custom_roles where role_code in ('subject_matter_expert','printing_distribution_officer','librarian')) = 3,
         (select string_agg(role_code, ', ') from custom_roles where role_code in ('subject_matter_expert','printing_distribution_officer','librarian'))
  union all
  select 'internal functions are not callable by the public',
         not (has_function_privilege('anon','public.run_scheduled_job(text)','execute') or has_function_privilege('authenticated','public.run_scheduled_job(text)','execute')
           or has_function_privilege('anon','public.claim_outbound_messages(integer)','execute') or has_function_privilege('authenticated','public.claim_outbound_messages(integer)','execute')
           or has_function_privilege('anon','public.respond_graduation_invitation_by_phone(text, smallint)','execute') or has_function_privilege('authenticated','public.respond_graduation_invitation_by_phone(text, smallint)','execute')
           or has_function_privilege('anon','public.invoke_message_dispatcher()','execute')),
         'run_scheduled_job, claim_outbound_messages, respond_graduation_invitation_by_phone, invoke_message_dispatcher'
  union all
  select 'recurring jobs are scheduled',
         case when to_regclass('cron.job') is not null
              then (xpath('/row/c/text()', query_to_xml($q$select count(*) c from cron.job where jobname in ('vms-workflow-escalation','vms-library-overdue','vms-event-reminders','vms-message-dispatcher')$q$, false, true, '')))[1]::text::int = 4
              else true end,
         case when to_regclass('cron.job') is not null
              then coalesce((xpath('/row/c/text()', query_to_xml($q$select coalesce(string_agg(jobname||' ['||schedule||']', '; '), 'none') c from cron.job where jobname like 'vms-%'$q$, false, true, '')))[1]::text, 'none')
              else 'pg_cron not installed (skipped)' end
  union all
  select 'trainee numbers use the new format',
         public.generate_trainee_number((select id from public.organizations where active order by created_at limit 1)) ~ '^[A-Za-z0-9]+-[0-9]{2}-[0-9]{5}$',
         public.generate_trainee_number((select id from public.organizations where active order by created_at limit 1))
) checks order by passed, check_name;
