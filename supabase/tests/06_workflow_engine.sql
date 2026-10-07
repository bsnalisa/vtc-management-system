\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set trainer '11111111-0000-0000-0000-000000000004'
\set outsider '11111111-0000-0000-0000-000000000007'
\set hot '22222222-0000-0000-0000-000000000001'
\set coord '22222222-0000-0000-0000-000000000002'
\set deleg '22222222-0000-0000-0000-000000000003'
\set orgA 'a0000000-0000-0000-0000-00000000000a'

insert into auth.users (id,email) values (:'hot','hot@a.test'),(:'coord','coord@a.test'),(:'deleg','deleg@a.test');
update profiles p set full_name = split_part(u.email,'@',1), email = u.email from auth.users u where u.id = p.user_id and u.id in (:'hot',:'coord',:'deleg');
insert into user_roles (user_id, role, organization_id) values
 (:'hot','head_of_training',:'orgA'), (:'coord','assessment_coordinator',:'orgA'), (:'deleg','hod',:'orgA');
insert into workflow_settings (organization_id, app_base_url) values (:'orgA','https://app.test');

-- ===== definitions =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.expect_error($$insert into workflow_definitions (organization_id, process_type, name) values ('a0000000-0000-0000-0000-00000000000a','general','x')$$, 'row-level security', 'non-admin cannot define workflows');
select public.expect_error($$select public.workflow_start_request('Buy laptop','need one')$$, 'No approval workflow', 'cannot start before a workflow exists');
select set_config('request.jwt.claim.sub', :'admin', false);
insert into workflow_definitions (id, organization_id, process_type, name, active) values ('d1000000-0000-0000-0000-000000000001', :'orgA','general','General approvals', false);
select public.expect_error($$insert into workflow_steps (definition_id, step_no, name) values ('d1000000-0000-0000-0000-000000000001', 1, 'no approver')$$, 'check constraint', 'a step needs exactly one approver');
select public.expect_error($$insert into workflow_steps (definition_id, step_no, name, approver_role, approver_user) values ('d1000000-0000-0000-0000-000000000001', 1, 'both', 'admin', '11111111-0000-0000-0000-000000000001')$$, 'check constraint', 'a step cannot have both role and user');
insert into workflow_steps (definition_id, step_no, name, approver_role, sla_hours, escalate_to_role) values ('d1000000-0000-0000-0000-000000000001', 1, 'Head of Training', 'head_of_training', 24, 'assessment_coordinator');
insert into workflow_steps (definition_id, step_no, name, approver_user) values ('d1000000-0000-0000-0000-000000000001', 2, 'Administrator', :'admin');
insert into workflow_definitions (organization_id, process_type, name, active) values (:'orgA','general','Second', false);
insert into workflow_steps (definition_id, step_no, name, approver_role) select id, 1, 'Only step', 'admin' from workflow_definitions where name = 'Second';
update workflow_definitions set active = true where id = 'd1000000-0000-0000-0000-000000000001';
select public.expect_error($$update workflow_definitions set active = true where name = 'Second'$$, 'duplicate key', 'only one active workflow per process');
reset role;
select 'OK definitions';

-- ===== two-step approval with request-for-information =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.workflow_start_request('Buy laptop', 'Need a laptop for the workshop') as inst \gset
select public.assert((select status from workflow_instances where id = :'inst') = 'in_progress', 'instance started');
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'starter has nothing to approve');
reset role;
select public.assert((select count(*) from workflow_task_assignees where task_id = (select id from workflow_tasks where instance_id = :'inst')) = 1, 'step 1 assigned to the one head_of_training');
select public.assert(public.t_notif_count(:'hot'::uuid, null, 'workflow') = 1, 'approver gets an in-app notification');
select public.assert((select count(*) from outbound_messages where recipient = 'hot@a.test' and body like '%https://app.test/workflow/action/%?a=approve%' and body like '%Need a laptop%' and body like '%a=reject%' and body like '%a=request_info%') = 1, 'email carries the details and approve/reject/more-info links');
select public.assert((select count(*) from outbound_messages where recipient = 'coord@a.test') = 0, 'non-approver gets no email');
select public.assert((select due_at from workflow_tasks where instance_id = :'inst') between now() + interval '23 hours' and now() + interval '25 hours', 'SLA due date set');

set role authenticated; select set_config('request.jwt.claim.sub', :'coord', false);
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'unrelated user has no tasks');
select public.assert((select count(*) from workflow_instances) = 0, 'unrelated user cannot see the instance');
select public.expect_error(format('select public.workflow_act(%L, %L)', (select id from workflow_tasks limit 1), 'approve'), 'not', 'unrelated user cannot approve');
select set_config('request.jwt.claim.sub', :'trainer', false);
select public.expect_error(format('select public.workflow_act(%L, %L)', (select id from workflow_tasks limit 1), 'approve'), 'not', 'starter cannot approve own request');
select set_config('request.jwt.claim.sub', :'hot', false);
select public.assert((select count(*) from workflow_my_tasks()) = 1, 'approver sees the task');
select id as t1 from workflow_tasks where instance_id = :'inst' and step_no = 1 \gset
select public.expect_error(format('select public.workflow_act(%L, %L)', :'t1', 'reject'), 'comment is required', 'rejecting needs a reason');
select public.expect_error(format('select public.workflow_act(%L, %L)', :'t1', 'bogus'), 'Unknown action', 'unknown action refused');
select public.assert(public.workflow_act(:'t1', 'approve', 'fine by me') = 'in_progress', 'step 1 approved, moves on');
select public.expect_error(format('select public.workflow_act(%L, %L)', :'t1', 'approve'), 'no longer waiting', 'cannot decide the same task twice');
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'task gone from first approver');
reset role;
select public.assert(public.t_notif_count(:'admin'::uuid, null, 'workflow') >= 1, 'step 2 approver notified');
select public.assert((select current_step from workflow_instances where id = :'inst') = 2, 'current step advanced');

set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select id as t2 from workflow_tasks where instance_id = :'inst' and step_no = 2 \gset
select public.expect_error(format('select public.workflow_act(%L, %L)', :'t2', 'request_info'), 'comment is required', 'info request needs a question');
select public.assert(public.workflow_act(:'t2', 'request_info', 'Which model?') = 'awaiting_info', 'information requested');
select public.assert((select status from workflow_instances where id = :'inst') = 'awaiting_info', 'instance awaiting info');
select set_config('request.jwt.claim.sub', :'hot', false);
select public.expect_error(format('select public.workflow_provide_info(%L, %L)', :'inst', 'x'), 'Only the person who made', 'only the requester can reply');
select set_config('request.jwt.claim.sub', :'trainer', false);
select public.expect_error(format('select public.workflow_provide_info(%L, %L)', :'inst', ''), 'Write your reply', 'reply cannot be empty');
select public.workflow_provide_info(:'inst', 'ThinkPad T14');
select public.assert((select status from workflow_instances where id = :'inst') = 'in_progress', 'back in progress after reply');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from workflow_my_tasks()) = 1, 'approver sees the task again');
select public.assert(public.workflow_act(:'t2', 'approve', 'ok') = 'approved', 'final approval');
select public.assert((select status from workflow_instances where id = :'inst') = 'approved' and (select completed_at from workflow_instances where id = :'inst') is not null, 'instance approved');
select public.assert((select count(*) from workflow_events where instance_id = :'inst') >= 8, 'audit trail recorded');
reset role;
select public.assert(public.t_notif_count(:'trainer'::uuid, 'Approved:%', 'workflow') = 1, 'requester told it was approved');
select public.assert((select count(*) from workflow_events where instance_id = :'inst' and event = 'info_requested' and actor = :'admin'::uuid) = 1, 'who asked is recorded');
select 'OK sequential approval and info request';

-- ===== rejection =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.workflow_start_request('Leave', 'x') as inst2 \gset
select set_config('request.jwt.claim.sub', :'hot', false);
select public.assert(public.workflow_act((select id from workflow_tasks where instance_id = :'inst2'), 'reject', 'Not now') = 'rejected', 'rejection ends the workflow');
select public.assert((select status from workflow_instances where id = :'inst2') = 'rejected' and (select outcome_comment from workflow_instances where id = :'inst2') = 'Not now', 'rejected with reason');
select public.assert((select count(*) from workflow_tasks where instance_id = :'inst2' and step_no = 2) = 0, 'no later step is opened after rejection');
reset role;
select 'OK rejection';

-- ===== email links =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.workflow_start_request('Training budget', 'Courses') as inst3 \gset
reset role;
select token as tok, task_id as ttask from workflow_action_tokens where user_id = :'hot' and task_id in (select id from workflow_tasks where instance_id = :'inst3') \gset
set role anon;
select public.assert((public.workflow_get_task_by_token(:'tok')->>'usable')::boolean, 'token page can load the request');
select public.assert(public.workflow_get_task_by_token(:'tok')->>'title' = 'Training budget', 'details shown');
select public.assert(public.workflow_get_task_by_token('nope') is null, 'unknown token returns nothing');
select public.expect_error($$select public.workflow_act_by_token('nope', 'approve', null)$$, 'not valid', 'unknown token rejected');
select public.expect_error(format('select public.workflow_act_by_token(%L, %L, %L)', :'tok', 'reject', ''), 'comment is required', 'reject by email needs a reason');
select public.assert(public.workflow_act_by_token(:'tok', 'approve', 'approved from email') = 'in_progress', 'approve from email moves to step 2');
select public.expect_error(format('select public.workflow_act_by_token(%L, %L, %L)', :'tok', 'approve', null), 'already been used', 'link works only once');
select public.assert(not (public.workflow_get_task_by_token(:'tok')->>'usable')::boolean, 'used link reported unusable');
select public.expect_error($$select * from workflow_action_tokens$$, 'permission denied|row-level', 'tokens are not readable') where false;
select public.assert((select count(*) from workflow_action_tokens) = 0, 'tokens are not readable by anon');
reset role;
select public.assert((select via from workflow_events where instance_id = :'inst3' and event = 'approved') = 'email', 'audit shows decision came by email');
select public.assert((select actor from workflow_events where instance_id = :'inst3' and event = 'approved') = :'hot'::uuid, 'audit shows who decided');
-- expiry
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.workflow_start_request('Old request', 'x') as inst4 \gset
reset role;
select token as tok2 from workflow_action_tokens where user_id = :'hot' and task_id in (select id from workflow_tasks where instance_id = :'inst4') \gset
update workflow_action_tokens set expires_at = now() - interval '1 minute' where token = :'tok2';
set role anon;
select public.expect_error(format('select public.workflow_act_by_token(%L, %L, %L)', :'tok2', 'approve', null), 'expired', 'expired link refused');
reset role;
select 'OK email actions';

-- ===== delegation =====
set role authenticated; select set_config('request.jwt.claim.sub', :'deleg', false);
select public.expect_error(format($$insert into workflow_delegations (organization_id, from_user, to_user, starts_at, ends_at) values ('a0000000-0000-0000-0000-00000000000a', %L, %L, now(), now() + interval '1 day')$$, :'hot', :'deleg'), 'row-level security', 'cannot delegate on someone elses behalf');
select set_config('request.jwt.claim.sub', :'hot', false);
select public.expect_error(format($$insert into workflow_delegations (organization_id, from_user, to_user, starts_at, ends_at) values ('a0000000-0000-0000-0000-00000000000a', %L, %L, now() + interval '2 days', now())$$, :'hot', :'deleg'), 'check constraint', 'end must be after start');
select public.expect_error(format($$insert into workflow_delegations (organization_id, from_user, to_user, starts_at, ends_at) values ('a0000000-0000-0000-0000-00000000000a', %L, %L, now(), now() + interval '1 day')$$, :'hot', :'hot'), 'check constraint', 'cannot delegate to self');
select public.assert((select count(*) from workflow_my_tasks()) >= 1, 'approver still has the older pending task');
-- future delegation: not active yet
insert into workflow_delegations (organization_id, from_user, to_user, starts_at, ends_at) values (:'orgA', :'hot', :'deleg', now() + interval '1 day', now() + interval '3 days');
select set_config('request.jwt.claim.sub', :'deleg', false);
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'scheduled (future) delegation grants nothing yet');
select set_config('request.jwt.claim.sub', :'hot', false);
delete from workflow_delegations;
insert into workflow_delegations (id, organization_id, from_user, to_user, starts_at, ends_at) values ('de100000-0000-0000-0000-000000000001', :'orgA', :'hot', :'deleg', now() - interval '1 hour', now() + interval '2 days');
select set_config('request.jwt.claim.sub', :'deleg', false);
select public.assert((select count(*) from workflow_my_tasks() where delegated) >= 1, 'active delegation exposes the delegators tasks, flagged as delegated');
select public.assert(public.workflow_act((select task_id from workflow_my_tasks() where title = 'Old request' limit 1), 'approve', 'covering') = 'in_progress', 'delegate can decide');
reset role;
select public.assert((select actor from workflow_events where instance_id = :'inst4' and event = 'approved') = :'deleg'::uuid, 'audit records the delegate as the actor');
-- a new request while delegation is active also emails the delegate
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.workflow_start_request('Printer', 'x') as inst5 \gset
reset role;
select public.assert((select count(*) from outbound_messages where recipient = 'deleg@a.test' and subject like '%Printer%') = 1, 'delegate is emailed about new requests');
-- after the window ends nothing remains
update workflow_delegations set starts_at = now() - interval '3 days', ends_at = now() - interval '1 day';
set role authenticated; select set_config('request.jwt.claim.sub', :'deleg', false);
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'expired delegation grants nothing');
select set_config('request.jwt.claim.sub', :'hot', false);
update workflow_delegations set starts_at = now() - interval '1 hour', ends_at = now() + interval '1 day', process_type = 'delivery_plan';
select set_config('request.jwt.claim.sub', :'deleg', false);
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'delegation limited to one process does not cover others');
reset role;
select 'OK delegation';

-- ===== escalation =====
update workflow_tasks set due_at = now() - interval '1 hour' where instance_id = :'inst5';
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.expect_error($$select public.workflow_escalate_overdue('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'only admins run escalation');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert(public.workflow_escalate_overdue(:'orgA') = 1, 'one overdue task escalated');
select public.assert(public.workflow_escalate_overdue(:'orgA') = 0, 'escalation happens once');
reset role;
select public.assert((select count(*) from workflow_task_assignees where task_id = (select id from workflow_tasks where instance_id = :'inst5') and reason = 'escalation' and user_id = :'coord') = 1, 'escalation target added');
select public.assert((select escalated_at from workflow_tasks where instance_id = :'inst5') is not null, 'task marked escalated');
select public.assert(public.t_notif_count(:'coord'::uuid, 'Overdue approval escalated%', 'workflow') = 1, 'escalation target notified');
select public.assert((select count(*) from outbound_messages where recipient = 'coord@a.test' and body like '%a=approve%') = 1, 'escalation target gets an action email');
set role authenticated; select set_config('request.jwt.claim.sub', :'coord', false);
select public.assert((select count(*) from workflow_my_tasks() where escalated) = 1, 'escalated task appears for the escalation target');
reset role;
select 'OK escalation';

-- ===== separation of duties and unassignable steps =====
insert into workflow_definitions (id, organization_id, process_type, name, active) values ('d2000000-0000-0000-0000-000000000001', :'orgA', 'delivery_plan', 'Plans', false);
insert into workflow_steps (definition_id, step_no, name, approver_role) values ('d2000000-0000-0000-0000-000000000001', 1, 'Nobody holds this', 'stock_control_officer');
update workflow_definitions set active = true where id = 'd2000000-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);

reset role;
select 'OK pre-adoption';
