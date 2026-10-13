\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set adminA '11111111-0000-0000-0000-000000000001'
\set cm '77777777-0000-0000-0000-000000000001'
\set hofa '77777777-0000-0000-0000-000000000002'
\set acc '77777777-0000-0000-0000-000000000003'
\set cr '77777777-0000-0000-0000-000000000004'
\set hot '77777777-0000-0000-0000-000000000005'
\set tr '77777777-0000-0000-0000-000000000006'
\set accB '77777777-0000-0000-0000-000000000007'
\set hofaB '77777777-0000-0000-0000-000000000008'

insert into auth.users (id,email) values (:'cm','cm@a.test'),(:'hofa','hofa@a.test'),(:'acc','acc@a.test'),(:'cr','cr@a.test'),(:'hot','hot@a.test'),(:'tr','tr@a.test'),(:'accB','accb@b.test'),(:'hofaB','hofab@b.test')
  on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id in (:'cm',:'hofa',:'acc',:'cr',:'hot',:'tr',:'accB',:'hofaB') on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values
 (:'cm','centre_manager',:'orgA'),(:'hofa','head_of_finance_admin',:'orgA'),(:'acc','accountant',:'orgA'),(:'cr','creditors_officer',:'orgA'),
 (:'hot','head_of_training',:'orgA'),(:'tr','trainer',:'orgA'),(:'accB','accountant',:'orgB'),(:'hofaB','head_of_finance_admin',:'orgB');
alter table user_roles enable trigger trg_guard_privileged_roles;

-- ===== roles, reporting lines and default workflows =====
select public.assert((select count(*) from custom_roles where role_code in ('accountant','head_of_finance_admin','creditors_officer','loan_officer','pa_to_centre_manager') and active) = 5, 'the five new roles are assignable');
select public.assert((select count(*) from reporting_lines where organization_id = :'orgA') >= 18, 'reporting lines are seeded for a centre');
select public.assert((select count(*) from reporting_lines where organization_id = :'orgB') = (select count(*) from reporting_lines where organization_id = :'orgA'), 'every centre gets the same default matrix');
select public.assert((select supervisor_role from reporting_lines where organization_id = :'orgA' and role = 'accountant') = 'head_of_finance_admin', 'accountant reports to the Head of Finance and Administration');
select public.assert((select supervisor_role from reporting_lines where organization_id = :'orgA' and role = 'head_of_finance_admin') = 'centre_manager', 'Head of Finance and Administration reports to the Centre Manager');
select public.assert((select supervisor_role from reporting_lines where organization_id = :'orgA' and role = 'registration_officer') = 'head_of_trainee_support', 'registration officer reports to the Head of Trainee Support');
select public.assert((select supervisor_role from reporting_lines where organization_id = :'orgA' and role = 'trainer') = 'head_of_training', 'trainer reports to the Head of Training');
select public.assert((select count(*) from workflow_definitions where organization_id = :'orgA' and process_type in ('finance_submission','payment_request','debtor_adjustment','loan_request','asset_request','executive_matter') and active) = 6, 'default supervisor workflows are active');
select public.assert(public.workflow_supervisors_of(:'orgA', :'acc') = :'hofa'::uuid, 'the accountant''s supervisor is the Head of Finance and Administration');
select public.assert((select count(*) from public.workflow_supervisors_of(:'orgA', :'hofa')) = 1 and (select * from public.workflow_supervisors_of(:'orgA', :'hofa')) = :'cm'::uuid, 'and theirs is the Centre Manager');

-- ===== a submission routes to the direct supervisor =====
set role authenticated; select set_config('request.jwt.claim.sub', :'acc', false);
select public.workflow_create_request('finance_submission', 'Monthly report', 'Q3 figures') as inst \gset
select public.assert((select reference from workflow_instances where id = :'inst') ~ '^WF-[0-9]{4}-[0-9]{6}$', 'the request gets a reference number');
select public.assert((select submitter_role from workflow_instances where id = :'inst') = 'accountant', 'the submitter''s role is recorded');
select public.assert((select status from workflow_instances where id = :'inst') = 'in_progress', 'submitted requests wait for the supervisor');
select public.assert((select count(*) from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'inst') = 1
   and exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'inst' and a.user_id = :'hofa'), 'only the Head of Finance and Administration can decide it');
select t.id as task from workflow_tasks t where t.instance_id = :'inst' and t.status = 'pending' \gset
select public.expect_error($$select public.workflow_act('$$ || :'task' || $$', 'approve', 'ok')$$, 'not an approver', 'the accountant cannot approve their own submission');
select public.assert((select next_action from workflow_instances where id = :'inst') like '%waiting for%', 'the next action is shown');

-- ===== decisions =====
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.assert((select count(*) from public.workflow_my_tasks() where instance_id = :'inst' and reference like 'WF-%' and submitter_role = 'accountant' and can_escalate) = 1, 'the supervisor sees it in their queue and may escalate');
select public.expect_error($$select public.workflow_act('$$ || :'task' || $$', 'reject', '')$$, 'comment is required', 'rejecting needs a reason');
select public.expect_error($$select public.workflow_act('$$ || :'task' || $$', 'request_info', '  ')$$, 'comment is required', 'returning for correction needs comments');
select public.workflow_act(:'task', 'request_info', 'Attach the bank statement') = 'awaiting_info' as ok \gset
select public.assert((select status from workflow_instances where id = :'inst') = 'awaiting_info', 'returned for correction');
select set_config('request.jwt.claim.sub', :'acc', false);
select public.workflow_provide_info(:'inst', 'Statement attached');
select public.assert((select status = 'in_progress' and resubmitted and resubmissions = 1 from workflow_instances where id = :'inst'), 'resubmitted goes back to the supervisor');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.expect_error($$select public.workflow_act((select id from workflow_tasks where instance_id = '$$ || :'inst' || $$' and status = 'pending'), 'escalate', '')$$, 'comment is required', 'escalating needs comments');
select public.workflow_act((select id from workflow_tasks where instance_id = :'inst' and status = 'pending'), 'escalate', 'Above my limit') = 'escalated' as ok \gset
select public.assert((select escalated and status = 'in_progress' from workflow_instances where id = :'inst'), 'escalated requests stay open at the higher level');
select public.assert((select count(*) from public.workflow_my_tasks() where instance_id = :'inst') = 0, 'the escalating supervisor no longer holds it');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((select count(*) from public.workflow_my_tasks() where instance_id = :'inst') = 1, 'it is in the Centre Manager''s queue');
select public.workflow_act((select id from workflow_tasks where instance_id = :'inst' and status = 'pending'), 'approve', 'Approved') = 'approved' as ok \gset
select public.assert((select status = 'approved' and not escalated from workflow_instances where id = :'inst'), 'higher-level approval finishes the request');
select public.assert((select count(*) from workflow_events where instance_id = :'inst' and event in ('returned_for_correction','resubmitted','escalated_by_approver','approved')) = 4, 'every decision is in the history');

-- approved is not completed until processing is recorded
select set_config('request.jwt.claim.sub', :'tr', false);
select public.expect_error($$select public.workflow_mark_completed('$$ || :'inst' || $$')$$, 'Not authorised', 'an unrelated user cannot complete it');
select set_config('request.jwt.claim.sub', :'acc', false);
select public.workflow_mark_completed(:'inst', 'Posted');
select public.assert((select status from workflow_instances where id = :'inst') = 'completed', 'approved requests can be marked completed');
reset role;
select public.expect_error($$update workflow_events set comment = 'edited'$$, 'cannot be changed', 'the history is append-only');
set role authenticated;

-- ===== other routes =====
select set_config('request.jwt.claim.sub', :'tr', false);
select public.workflow_create_request('training_submission', 'Delivery note', 'x') as i2 \gset
select public.assert(exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'i2' and a.user_id = :'hot'), 'trainer submissions go to the Head of Training');
select set_config('request.jwt.claim.sub', :'accB', false);
select public.workflow_create_request('finance_submission', 'Other centre', 'x') as i3 \gset
select public.assert(exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'i3' and a.user_id = :'hofaB') and not exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'i3' and a.user_id = :'hofa'), 'routing stays inside the centre');
select public.assert((select count(*) from reporting_lines where organization_id = :'orgA') = 0, 'another centre''s reporting lines are not visible');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.workflow_create_request('executive_matter', 'Manager request', 'x') as i4 \gset
select public.assert(exists (select 1 from workflow_tasks where instance_id = :'i4' and status = 'pending') and not exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'i4' and a.user_id = :'cm'), 'a request with nobody above cannot be approved by its own submitter');

-- a named override beats the role line
reset role;
insert into user_supervisors (organization_id, user_id, supervisor_user_id) values (:'orgA', :'cr', :'hot');
set role authenticated; select set_config('request.jwt.claim.sub', :'cr', false);
select public.workflow_create_request('payment_request', 'Invoice 1', 'x') as i5 \gset
select public.assert(exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'i5' and a.user_id = :'hot') and not exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'i5' and a.user_id = :'hofa'), 'a per-person supervisor overrides the role line');

-- no reporting line: falls back to the Centre Manager
select set_config('request.jwt.claim.sub', :'adminA', false);
select public.workflow_create_request('general', 'Admin request', 'x') as i6 \gset
select public.assert(exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'i6' and a.user_id = :'cm'), 'with no reporting line the Centre Manager decides');

-- ===== drafts =====
select set_config('request.jwt.claim.sub', :'acc', false);
select public.workflow_create_request('finance_submission', 'Draft one', 'x', false) as d1 \gset
select public.assert((select status from workflow_instances where id = :'d1') = 'draft' and not exists (select 1 from workflow_tasks where instance_id = :'d1'), 'a draft waits for nobody');
select public.workflow_submit(:'d1');
select public.assert((select status from workflow_instances where id = :'d1') = 'in_progress' and exists (select 1 from workflow_tasks where instance_id = :'d1' and status = 'pending'), 'submitting a draft opens the approval');
select public.expect_error($$select public.workflow_submit('$$ || :'d1' || $$')$$, 'already been submitted', 'a submitted request cannot be submitted again');
select 'OK reporting hierarchy and supervisor routing' as result;
