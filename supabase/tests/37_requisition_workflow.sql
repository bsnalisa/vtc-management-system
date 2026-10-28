\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set rq '97a00000-0000-0000-0000-000000000001'
\set hot '97a00000-0000-0000-0000-000000000002'
\set rq2 '97a00000-0000-0000-0000-000000000003'
\set sup2 '97a00000-0000-0000-0000-000000000004'
\set rq3 '97a00000-0000-0000-0000-000000000005'
\set acc '97a00000-0000-0000-0000-000000000006'
\set hof '97a00000-0000-0000-0000-000000000007'
\set cm '97a00000-0000-0000-0000-000000000008'
\set po '97a00000-0000-0000-0000-000000000009'
\set cmB '97a00000-0000-0000-0000-00000000000a'
\set other '97a00000-0000-0000-0000-00000000000b'

insert into auth.users (id,email) values (:'rq','rq@a.test'),(:'hot','hot@a.test'),(:'rq2','rq2@a.test'),(:'sup2','sup2@a.test'),(:'rq3','rq3@a.test'),(:'acc','acc@a.test'),(:'hof','hof@a.test'),(:'cm','cm@a.test'),(:'po','po@a.test'),(:'cmB','cmb@b.test'),(:'other','other@a.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '97a00000%' on conflict (user_id) do update set full_name = excluded.full_name;
update profiles set full_name = split_part(email,'@',1) where user_id::text like '97a00000%';
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values
 (:'rq','trainer',:'orgA'),(:'hot','head_of_training',:'orgA'),(:'rq2','librarian',:'orgA'),(:'sup2','head_of_trainee_support',:'orgA'),(:'rq3','stock_control_officer',:'orgA'),
 (:'acc','accountant',:'orgA'),(:'hof','head_of_finance_admin',:'orgA'),(:'cm','centre_manager',:'orgA'),(:'po','procurement_officer',:'orgA'),(:'cmB','centre_manager',:'orgB'),(:'other','hr_officer',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;
select public.seed_requisition_workflow(:'orgA');
select public.assert((select count(*) from workflow_steps s join workflow_definitions d on d.id = s.definition_id where d.organization_id = :'orgA' and d.process_type = 'purchase_requisition') = 4, 'the four stages are seeded');
insert into user_supervisors (organization_id, user_id, supervisor_user_id) values (:'orgA', :'rq', :'hot'), (:'orgA', :'rq2', :'sup2');

-- the stages cannot be edited
select public.expect_error($$update workflow_steps set approver_role = 'centre_manager' where approver_role = 'accountant'$$, 'fixed', 'the stages cannot be changed');

set role authenticated; select set_config('request.jwt.claim.sub', :'rq', false);
select public.expect_error($$insert into purchase_requisitions (organization_id, requisition_number, requested_by) values ('a0000000-0000-0000-0000-00000000000a', 'X', '97a00000-0000-0000-0000-000000000001')$$, 'permission denied|row-level|requisition form', 'no direct insert');
select public.assert((requisition_my_supervisor(:'orgA') ->> 'valid')::boolean and (requisition_my_supervisor(:'orgA') -> 'supervisors' -> 0 ->> 'name') = 'hot', 'the form shows the requester their supervisor before submitting');
select requisition_save_draft(null, :'orgA', 'Robotic arm training: Industrial Mechatronics', 'Training',
  '[{"description":"18650 batteries","quantity":"4","specifications":"Li-ion 3.7V"},{"description":"Battery holder","quantity":2}]'::jsonb) as r1 \gset
select public.assert((select status from purchase_requisitions where id = :'r1') = 'draft' and (select requisition_number from purchase_requisitions where id = :'r1') like 'DRAFT-%', 'a draft has no reference yet');
select public.expect_error($$update purchase_requisitions set status = 'approved_awaiting_procurement'$$, 'permission denied|workflow', 'status cannot be set directly');
select public.expect_error($$delete from purchase_requisitions$$, 'permission denied|never deleted', 'requisitions cannot be deleted');
select public.expect_error($$select public.requisition_save_draft(null, 'a0000000-0000-0000-0000-00000000000a', 'x', 'y', '[{"description":"","quantity":1}]'::jsonb)$$, 'describe what you need', 'items need a description');
select public.expect_error($$select public.requisition_save_draft(null, 'a0000000-0000-0000-0000-00000000000a', 'x', 'y', '[{"description":"a","quantity":0}]'::jsonb)$$, 'at least 1', 'quantity at least 1');
select (requisition_submit(:'r1') ->> 'supervisor') as sv \gset
select public.assert(:'sv' = 'hot', 'got ['||:'sv'||']');
select public.assert((select status from purchase_requisitions where id = :'r1') = 'pending_line_supervisor' and (select requisition_number from purchase_requisitions where id = :'r1') ~ '^REQ-[0-9]{4}-[0-9]{6}$', 'status and unique reference set on submission');
select public.expect_error($$select public.requisition_submit((select id from purchase_requisitions limit 1))$$, 'already been submitted', 'no duplicate submission');
select public.expect_error($$select public.requisition_save_draft((select id from purchase_requisitions limit 1), null, 'changed', 'Training', '[{"description":"a","quantity":1}]'::jsonb)$$, 'can no longer be edited', 'a submitted requisition cannot be edited');
select public.assert((requisition_view(:'r1') -> 'stages' -> 0 -> 'people' -> 0 ->> 'name') = 'hot' and (requisition_view(:'r1') -> 'stages' -> 0 ->> 'state') = 'current', 'the view shows the supervisor as the current stage');

-- another department routes to its own supervisor
set role authenticated; select set_config('request.jwt.claim.sub', :'rq2', false);
select requisition_save_draft(null, :'orgA', 'Library shelving', 'Resource Centre', '[{"description":"Shelf","quantity":3}]'::jsonb) as r2 \gset
select public.assert((requisition_submit(:'r2') ->> 'supervisor') = 'sup2', 'a requester in another department routes to that department''s supervisor');
-- no supervisor configured
select set_config('request.jwt.claim.sub', :'rq3', false);
select public.assert(not (requisition_my_supervisor(:'orgA') ->> 'valid')::boolean, 'the form warns when no supervisor is configured');
select requisition_save_draft(null, :'orgA', 'Stock', 'Stores', '[{"description":"Gloves","quantity":10}]'::jsonb) as r3 \gset
select public.expect_error($$select public.requisition_submit((select id from purchase_requisitions where department = 'Stores'))$$, 'do not have a line supervisor', 'no supervisor: submission blocked with a clear message');
select public.assert((select status from purchase_requisitions where department = 'Stores') = 'draft', 'and it stays a draft');
-- only staff create requisitions, only the owner reads drafts
select set_config('request.jwt.claim.sub', :'other', false);
select public.assert((select count(*) from purchase_requisitions) = 0, 'unrelated staff see no requisitions');

-- ===== r1: the whole approval chain, in order =====
select set_config('request.jwt.claim.sub', :'hot', false);
select public.assert((select count(*) from requisition_list('to_decide')) = 1 and (select id from requisition_list('to_decide')) = :'r1', 'the supervisor''s queue holds exactly the requisitions routed to them');
select (requisition_view(:'r1') ->> 'task_id') as t1 \gset
select public.assert((requisition_view(:'r1') ->> 'can_decide')::boolean, 'the supervisor can decide');
select public.expect_error(format('select public.workflow_act(%L, %L, %L)', :'t1', 'approve', 'x'), 'Open the requisition', 'the generic approval route is closed for requisitions');
select public.expect_error(format('select public.requisition_decide(%L, %L, %L)', :'t1', 'approve', 'x'), 'not available at this stage', 'the supervisor cannot give the Centre Manager''s decision');
select public.expect_error(format('select public.requisition_decide(%L, %L, %L)', :'t1', 'not_recommend', ''), 'comment is required', 'a negative decision needs a reason');
select set_config('request.jwt.claim.sub', :'acc', false);
select public.expect_error(format('select public.requisition_decide(%L, %L, %L)', :'t1', 'recommend', 'x'), 'not an approver', 'the Accountant cannot act on the supervisor''s stage');
select set_config('request.jwt.claim.sub', :'rq', false);
select public.expect_error(format('select public.requisition_decide(%L, %L, %L)', :'t1', 'recommend', 'x'), 'not an approver|own request', 'the requester cannot approve their own requisition');

select set_config('request.jwt.claim.sub', :'hot', false);
select public.assert(requisition_decide(:'t1', 'recommend', 'Needed for the course') = 'pending_accountant', 'a recommendation moves it to the Accountant');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((select count(*) from requisition_list('to_decide')) = 0, 'the Centre Manager has nothing to decide before the earlier stages');
select set_config('request.jwt.claim.sub', :'acc', false);
select (requisition_view(:'r1') ->> 'task_id') as t2 \gset
select public.expect_error(format('select public.requisition_decide(%L, %L, %L)', :'t2', 'fund_available', 'ok'), 'GL code', 'fund available needs a GL code');
select public.expect_error(format('select public.requisition_decide(%L, %L, %L)', :'t2', 'recommend', 'ok'), 'not available at this stage', 'the Accountant records funding, not a recommendation');
select public.assert(requisition_decide(:'t2', 'fund_available', 'Budget line has room', 'GL-4210/01') = 'pending_head_finance', 'funds available with a GL code moves it on');
select set_config('request.jwt.claim.sub', :'hof', false);
select (requisition_view(:'r1') ->> 'task_id') as t3 \gset
select public.assert(requisition_decide(:'t3', 'recommend', 'Recommended') = 'pending_centre_manager', 'the Head of Finance and Administration recommends');
select set_config('request.jwt.claim.sub', :'po', false);
select public.assert((select count(*) from purchase_requisitions) = 0, 'the Procurement Officer does not see it before final approval');
select set_config('request.jwt.claim.sub', :'cm', false);
select (requisition_view(:'r1') ->> 'task_id') as t4 \gset
select public.assert(requisition_decide(:'t4', 'approve', 'Approved') = 'approved_awaiting_procurement', 'the Centre Manager approves');
select public.assert((select count(*) from requisition_decisions where requisition_id = :'r1') = 4, 'four decisions are recorded');
select public.assert((requisition_view(:'r1') -> 'stages' -> 1 -> 'decision' ->> 'gl_code') = 'GL-4210/01', 'the GL code is stored with the Accountant''s decision');
select public.assert((select string_agg(to_status, '>' order by id) from requisition_status_history where requisition_id = :'r1') = 'draft>submitted>pending_line_supervisor>pending_accountant>pending_head_finance>pending_centre_manager>approved_awaiting_procurement', 'the status history reads in order');
select set_config('request.jwt.claim.sub', :'po', false);
select public.assert((select count(*) from requisition_list('procurement')) = 1 and (select count(*) from purchase_requisitions) = 1, 'after approval it reaches the Procurement Officer');
reset role;
select public.expect_error($$update requisition_decisions set comments = 'edited'$$, 'never be changed', 'decisions cannot be edited');

-- ===== r2: not recommended, reopened, corrected, resubmitted =====
set role authenticated; select set_config('request.jwt.claim.sub', :'sup2', false);
select (requisition_view(:'r2') ->> 'task_id') as s2 \gset
select public.assert(requisition_decide(:'s2', 'not_recommend', 'Not in this year''s plan') = 'not_recommended', 'a negative recommendation stops the process');
select set_config('request.jwt.claim.sub', :'acc', false);
select public.assert((select count(*) from requisition_list('to_decide')) = 0, 'it never reaches the Accountant');
select set_config('request.jwt.claim.sub', :'rq2', false);
select public.assert((requisition_view(:'r2') ->> 'can_reopen')::boolean, 'the requester may reopen it');
select requisition_reopen(:'r2');
select requisition_save_draft(:'r2', null, 'Library shelving, replaces damaged units', 'Resource Centre', '[{"description":"Shelf","quantity":2}]'::jsonb);
select public.assert((requisition_submit(:'r2') ->> 'round')::int = 2, 'resubmission starts round 2');
select public.assert((select count(*) from requisition_decisions where requisition_id = :'r2' and round = 1) = 1 and (select count(*) from requisition_snapshots where requisition_id = :'r2') = 2, 'round 1''s decision and content are kept');
select public.assert((select requisition_number from purchase_requisitions where id = :'r2') ~ '^REQ-', 'the reference does not change on resubmission');
select set_config('request.jwt.claim.sub', :'sup2', false);
select (requisition_view(:'r2') ->> 'task_id') as s2b \gset
select public.assert(requisition_decide(:'s2b', 'return', 'Please add a quotation reference') = 'returned_for_correction', 'return for correction sends it back to the requester');
select set_config('request.jwt.claim.sub', :'rq2', false);
select public.assert((requisition_view(:'r2') ->> 'can_edit')::boolean, 'and it can be edited again');
select requisition_save_draft(:'r2', null, 'Library shelving (quotation ref Q-17)', 'Resource Centre', '[{"description":"Shelf","quantity":2}]'::jsonb);
select public.assert((requisition_submit(:'r2') ->> 'round')::int = 3, 'resubmitted as round 3');
reset role;
select public.assert((select count(*) from workflow_instances where subject_id = :'r2' and process_type = 'purchase_requisition') = 3 and (select count(*) from workflow_instances where subject_id = :'r2' and status = 'in_progress') = 1, 'one live approval round, earlier ones kept');

-- ===== funding not available =====
set role authenticated; select set_config('request.jwt.claim.sub', :'rq', false);
select requisition_save_draft(null, :'orgA', 'Welding consumables', 'Training', '[{"description":"Rods","quantity":50}]'::jsonb) as r5 \gset
select requisition_submit(:'r5');
select set_config('request.jwt.claim.sub', :'hot', false);
select requisition_decide((requisition_view(:'r5') ->> 'task_id')::uuid, 'recommend', 'ok');
select set_config('request.jwt.claim.sub', :'acc', false);
select public.assert(requisition_decide((requisition_view(:'r5') ->> 'task_id')::uuid, 'fund_not_available', 'No budget left this quarter') = 'funding_not_available', 'funds not available does not proceed as if funded');
select set_config('request.jwt.claim.sub', :'hof', false);
select public.assert((select count(*) from requisition_list('to_decide')) = 0, 'it does not reach the Head of Finance and Administration');

-- ===== segregation of duties: the supervisor is also the Head of Finance and Administration =====
reset role;
insert into user_supervisors (organization_id, user_id, supervisor_user_id) values (:'orgA', :'other', :'hof'), (:'orgA', :'hof', :'cm');
set role authenticated; select set_config('request.jwt.claim.sub', :'other', false);
select requisition_save_draft(null, :'orgA', 'Printer paper', 'HR', '[{"description":"Paper","quantity":20}]'::jsonb) as r6 \gset
select requisition_submit(:'r6');
select set_config('request.jwt.claim.sub', :'hof', false);
select requisition_decide((requisition_view(:'r6') ->> 'task_id')::uuid, 'recommend', 'ok as supervisor');
select set_config('request.jwt.claim.sub', :'acc', false);
select requisition_decide((requisition_view(:'r6') ->> 'task_id')::uuid, 'fund_available', 'ok', 'GL-1');
select set_config('request.jwt.claim.sub', :'hof', false);
select public.assert((requisition_view(:'r6') ->> 'can_decide')::boolean = false, 'the same person cannot decide a second stage');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((requisition_view(:'r6') ->> 'can_decide')::boolean, 'the later stage goes to that person''s own supervisor');

-- the letterhead comes from the centre's settings
select public.assert((requisition_letterhead(:'r1') ->> 'centre_name') is not null and (requisition_letterhead(:'r1') -> 'settings') is not null, 'the printed form gets the centre letterhead');

-- ===== centre boundary, cancel, other staff =====
select set_config('request.jwt.claim.sub', :'cmB', false);
select public.assert((select count(*) from purchase_requisitions) = 0 and (select count(*) from requisition_list('centre')) = 0, 'another centre''s Centre Manager sees nothing');
select public.expect_error(format('select public.requisition_view(%L)', :'r1'), 'not found', 'and cannot open a requisition by its id');
select set_config('request.jwt.claim.sub', :'rq3', false);
select requisition_cancel(:'r3', 'No longer needed');
select public.assert((select status from purchase_requisitions where id = :'r3') = 'cancelled', 'a draft can be cancelled');
select public.expect_error(format('select public.requisition_cancel(%L, %L)', :'r3', 'again'), 'no longer be cancelled', 'a cancelled requisition cannot be cancelled again');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((select count(*) from requisition_list('centre')) >= 4, 'the Centre Manager sees the centre''s submitted requisitions');
reset role;
select 'OK requisition workflow';
