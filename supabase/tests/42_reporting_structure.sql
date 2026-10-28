\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set oa '97f00000-0000-0000-0000-000000000001'
\set cm '97f00000-0000-0000-0000-000000000002'
\set hof '97f00000-0000-0000-0000-000000000003'
\set acc '97f00000-0000-0000-0000-000000000004'
\set hot '97f00000-0000-0000-0000-000000000005'
\set tr '97f00000-0000-0000-0000-000000000006'
\set tr2 '97f00000-0000-0000-0000-000000000007'
\set sa '97f00000-0000-0000-0000-000000000008'
\set outsider '97f00000-0000-0000-0000-000000000009'
\set gone '97f00000-0000-0000-0000-00000000000a'
\set rq '97f00000-0000-0000-0000-00000000000b'

insert into auth.users (id,email) values (:'oa','oa@a.test'),(:'cm','cm@a.test'),(:'hof','hof@a.test'),(:'acc','acc@a.test'),(:'hot','hot@a.test'),(:'tr','tr@a.test'),(:'tr2','tr2@a.test'),(:'sa','sa@x.test'),(:'outsider','out@b.test'),(:'gone','gone@a.test'),(:'rq','rq@a.test');
update auth.users set banned_until = now() + interval '100 years' where id = :'gone';
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '97f00000%' on conflict (user_id) do update set full_name = excluded.full_name;
update profiles set full_name = split_part(email,'@',1) where user_id::text like '97f00000%';
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'oa','organization_admin',:'orgA'),(:'cm','centre_manager',:'orgA'),(:'hof','head_of_finance_admin',:'orgA'),(:'acc','accountant',:'orgA'),
 (:'hot','head_of_training',:'orgA'),(:'tr','trainer',:'orgA'),(:'tr2','trainer',:'orgA'),(:'sa','super_admin',null),(:'outsider','head_of_training',:'orgB'),(:'gone','head_of_training',:'orgA'),(:'rq','librarian',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;
select public.seed_requisition_workflow(:'orgA');

set role authenticated; select set_config('request.jwt.claim.sub', :'tr', false);
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005')$$, 'Only the Organisation Admin', 'a trainer cannot change reporting lines');
select public.expect_error($$insert into user_supervisors (organization_id, user_id, supervisor_user_id) values ('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005')$$, 'permission denied|row-level', 'and cannot write the table');

select set_config('request.jwt.claim.sub', :'oa', false);
select public.expect_error($$insert into user_supervisors (organization_id, user_id, supervisor_user_id) values ('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005')$$, 'permission denied|row-level', 'the Organisation Admin no longer writes the table directly');
select public.expect_error($$update reporting_lines set supervisor_role = 'trainer' where role = 'head_of_training'$$, 'permission denied|row-level', 'nor the role lines');

-- validation
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000007')$$, 'own supervisor', 'not themselves');
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000001')$$, 'cannot make themselves', 'an administrator cannot make themselves the supervisor');
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000009')$$, 'same centre', 'the supervisor must belong to the same centre');
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-00000000000a')$$, 'not active', 'the supervisor must be active');
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005', current_date - 3)$$, 'past', 'no backdating');
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005', current_date + 5, current_date + 2)$$, 'before the start', 'end after start');

-- a named supervisor takes effect, and ends the previous one
select public.assert(public.reporting_set_supervisor(:'orgA', :'tr2', :'hot') ->> 'status' = 'applied', 'a named supervisor is applied for an ordinary role');
reset role;
select public.assert((select count(*) from public.workflow_supervisors_of(:'orgA', :'tr2') s where s = :'hot') = 1, 'and routing uses it');
set role authenticated; select set_config('request.jwt.claim.sub', :'oa', false);
select public.reporting_set_supervisor(:'orgA', :'tr2', :'hof', current_date + 10);
reset role;
select public.assert((select count(*) from public.workflow_supervisors_of(:'orgA', :'tr2') s where s = :'hot') = 1 and (select count(*) from public.workflow_supervisors_of(:'orgA', :'tr2') s where s = :'hof') = 0, 'a future change does not apply yet');
set role authenticated; select set_config('request.jwt.claim.sub', :'oa', false);
select public.assert((select effective_to from user_supervisors where user_id = :'tr2' and supervisor_user_id = :'hot') = current_date + 9, 'the earlier supervisor ends the day before');
reset role;
select public.assert((select count(*) from private.reporting_supervisors_at(:'orgA', :'tr2', current_date + 10) s where s = :'hof') = 1, 'and the new one applies from its date');
set role authenticated; select set_config('request.jwt.claim.sub', :'oa', false);
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000003', current_date + 3)$$, 'later supervisor change', 'a scheduled change blocks an earlier one');

-- loops
select public.assert(public.reporting_set_supervisor(:'orgA', :'tr', :'tr2') ->> 'status' = 'applied', 'tr reports to tr2');
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000006')$$, 'loop', 'tr2 cannot report to tr: a loop');
select public.expect_error($$select public.reporting_set_line('a0000000-0000-0000-0000-00000000000a', 'head_of_training', 'trainer')$$, 'loop between roles', 'role lines cannot loop either');
select public.expect_error($$select public.reporting_set_line('a0000000-0000-0000-0000-00000000000a', 'trainer', 'trainer')$$, 'itself', 'a role cannot report to itself');

-- impact preview
select public.assert(public.reporting_preview(:'orgA', :'tr2', :'tr')  ->> 'problem' like '%loop%', 'the preview names a problem before saving');
select public.assert(public.reporting_preview(:'orgA', :'tr2', :'hot', current_date + 20) ->> 'problem' is null and jsonb_typeof(public.reporting_preview(:'orgA', :'tr2', :'hot', current_date + 20) -> 'direct_reports') = 'array', 'and an acceptable change has none');

-- protected roles need the Super Admin
select public.assert(public.reporting_set_supervisor(:'orgA', :'hof', :'hot') ->> 'status' = 'pending_confirmation', 'a change for the Head of Finance and Administration waits for the Super Admin');
select public.assert((select count(*) from user_supervisors where user_id = :'hof' and supervisor_user_id = :'hot') = 0, 'and nothing changed yet');
select public.expect_error($$select public.reporting_set_supervisor('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000003', '97f00000-0000-0000-0000-000000000002')$$, 'already waiting', 'only one open request per person');
select public.assert(public.reporting_set_line(:'orgA', 'accountant', 'centre_manager') ->> 'status' = 'pending_confirmation', 'so does a role line for the Accountant');
select public.assert(public.reporting_set_supervisor(:'orgA', :'cm', :'rq') ->> 'status' = 'pending_confirmation', 'and the Centre Manager''s own supervisor');
select public.expect_error($$select public.reporting_decide_change((select id from reporting_change_requests where kind = 'line' limit 1), true, null)$$, 'Only a Super Admin', 'the Organisation Admin cannot confirm');
select public.assert(jsonb_array_length(public.reporting_change_requests_list(:'orgA')) = 3, 'the admin sees the requests');
select public.reporting_withdraw_change((select id from reporting_change_requests where kind = 'line' limit 1));
select public.assert((select count(*) from reporting_change_requests where status = 'withdrawn') = 1, 'a request can be withdrawn');
select public.expect_error($$select public.reporting_change_requests_list(null)$$, 'Not authorised', 'the all-centres list is for the Super Admin');

select set_config('request.jwt.claim.sub', :'cm', false);
select public.expect_error($$select public.reporting_decide_change((select id from reporting_change_requests where kind = 'supervisor' limit 1), true, null)$$, 'Only a Super Admin', 'the Centre Manager cannot confirm either');
select public.assert(jsonb_array_length(public.reporting_org_chart(:'orgA') -> 'people') >= 8, 'the Centre Manager can read the organisation chart');

select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert(jsonb_array_length(public.reporting_change_requests_list(null)) >= 3, 'the Super Admin sees requests from every centre');
select public.expect_error($$select public.reporting_decide_change((select id from reporting_change_requests where subject_user = '97f00000-0000-0000-0000-000000000003'), false, 'no')$$, 'reason', 'a rejection needs a reason');
select public.assert(public.reporting_decide_change((select id from reporting_change_requests where subject_user = '97f00000-0000-0000-0000-000000000003'), true, 'agreed') = 'confirmed', 'the Super Admin confirms');
reset role;
select public.assert((select count(*) from user_supervisors where user_id = :'hof' and supervisor_user_id = :'hot') = 1, 'and it is applied');
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert(public.reporting_decide_change((select id from reporting_change_requests where subject_user = '97f00000-0000-0000-0000-000000000002'), false, 'not now') = 'rejected', 'or rejects');
reset role;
select public.assert((select count(*) from user_supervisors where user_id = :'cm') = 0, 'nothing is applied on rejection');
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.expect_error($$select public.reporting_decide_change((select id from reporting_change_requests where subject_user = '97f00000-0000-0000-0000-000000000003'), true, null)$$, 'already been decided', 'a decision is final');
select public.assert(public.reporting_set_supervisor(:'orgA', :'cm', :'rq') ->> 'status' = 'applied', 'the Super Admin can set a protected supervisor directly');

-- gaps
select set_config('request.jwt.claim.sub', :'oa', false);
select public.assert(exists (select 1 from jsonb_array_elements(public.reporting_gaps(:'orgA')) g where g ->> 'kind' = 'no_supervisor' and g ->> 'name' = 'rq'), 'a librarian with no line shows as a gap');
select public.assert(not exists (select 1 from jsonb_array_elements(public.reporting_gaps(:'orgA')) g where g ->> 'kind' = 'no_supervisor' and g ->> 'name' = 'tr'), 'a person with a supervisor does not');

-- waiting approvals: list, then move
reset role;
insert into workflow_process_types (code, label) values ('rep_test', 'Reporting test') on conflict do nothing;
insert into workflow_definitions (id, organization_id, process_type, name, active) values ('a9000000-0000-0000-0000-000000000001', :'orgA', 'rep_test', 'Reporting test', true) on conflict do nothing;
insert into workflow_steps (definition_id, step_no, name, approver_role) values ('a9000000-0000-0000-0000-000000000001', 1, 'Supervisor', '@supervisor') on conflict do nothing;
insert into workflow_instances (id, organization_id, definition_id, process_type, title, status, started_by) values ('a9100000-0000-0000-0000-000000000001', :'orgA', 'a9000000-0000-0000-0000-000000000001', 'rep_test', 'Moving test', 'in_progress', :'tr2');
insert into workflow_tasks (id, instance_id, step_no, step_name, status) values ('a9200000-0000-0000-0000-000000000001', 'a9100000-0000-0000-0000-000000000001', 1, 'Supervisor', 'pending');
insert into workflow_task_assignees (task_id, user_id, reason) values ('a9200000-0000-0000-0000-000000000001', :'hot', 'step');
set role authenticated; select set_config('request.jwt.claim.sub', :'oa', false);
select public.assert(jsonb_array_length(public.reporting_preview(:'orgA', :'tr2', :'hof', current_date + 30) -> 'pending_approvals') = 1, 'the preview lists the approvals waiting for this person''s supervisor');
select public.expect_error($$select public.reporting_reassign_pending('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005', '97f00000-0000-0000-0000-000000000001', 'moving it')$$, 'themselves', 'an administrator cannot take approvals for themselves');
select public.expect_error($$select public.reporting_reassign_pending('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005', '97f00000-0000-0000-0000-000000000007', 'moving it')$$, 'submitted the request', 'nor give it to the submitter');
select public.expect_error($$select public.reporting_reassign_pending('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005', '97f00000-0000-0000-0000-000000000003', '')$$, 'reason', 'a reason is required');
select public.expect_error($$select public.reporting_reassign_pending('a0000000-0000-0000-0000-00000000000a', '97f00000-0000-0000-0000-000000000007', '97f00000-0000-0000-0000-000000000005', '97f00000-0000-0000-0000-000000000009', 'moving it')$$, 'staff role at this centre', 'the new approver must belong to the centre');
select public.assert((public.reporting_reassign_pending(:'orgA', :'tr2', :'hot', :'hof', 'Head of Training is on leave') ->> 'moved')::int = 1, 'the waiting approval is moved');
select public.assert(exists (select 1 from workflow_task_assignees where task_id = 'a9200000-0000-0000-0000-000000000001' and user_id = :'hof') and not exists (select 1 from workflow_task_assignees where task_id = 'a9200000-0000-0000-0000-000000000001' and user_id = :'hot'), 'to the new person');
reset role;
select public.assert((select count(*) from workflow_events where instance_id = 'a9100000-0000-0000-0000-000000000001' and event = 'reassigned') = 1, 'on the approval history');
select public.assert((select count(*) from reporting_events where event = 'approvals_reassigned') = 1 and (select count(*) from reporting_events) >= 8, 'and in the reporting log');
select public.expect_error($$update reporting_events set event = 'x'$$, 'can never be changed', 'the log is append-only');
-- removing a supervisor that started today takes effect today
select set_config('request.jwt.claim.sub', :'oa', false);
set role authenticated;
select public.reporting_set_supervisor(:'orgA', :'tr', :'rq', current_date);
select public.reporting_remove_supervisor(:'orgA', :'tr', current_date);
reset role;
select public.assert((select count(*) from user_supervisors where user_id = :'tr' and (effective_to is null or effective_to >= current_date)) = 0, 'a supervisor that started today can be removed the same day');
select 'OK reporting structure';
