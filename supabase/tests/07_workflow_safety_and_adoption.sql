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

\set Q 'e0000000-0000-0000-0000-000000000001'

-- ===== separation of duties / unassignable step =====
insert into workflow_definitions (id, organization_id, process_type, name, active) values ('d3000000-0000-0000-0000-000000000001', :'orgA', 'general', 'Self only', true);
insert into workflow_steps (definition_id, step_no, name, approver_user) values ('d3000000-0000-0000-0000-000000000001', 1, 'Admin only', :'admin');
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.workflow_start_request('Admin spends', 'x') as selfinst \gset
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'the starter is not offered their own approval');
reset role;
select public.assert((select count(*) from workflow_events where instance_id = :'selfinst' and event = 'no_assignees') = 1, 'no eligible approver is logged');
select public.assert(public.t_notif_count(:'admin'::uuid, 'Workflow step has no approver%', 'workflow') = 1, 'admins are told when a step has nobody');
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.workflow_cancel(:'selfinst', 'testing');
reset role;
update workflow_steps set allow_self_approval = true where definition_id = 'd3000000-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.workflow_start_request('Admin spends again', 'x') as selfinst2 \gset
select public.assert((select count(*) from workflow_my_tasks()) = 1, 'self-approval step allowed by configuration');
select public.assert(public.workflow_act((select task_id from workflow_my_tasks()), 'approve', 'ok') = 'approved', 'self-approval works when allowed');
reset role;
select 'OK separation of duties';

-- ===== cancel & visibility =====
update workflow_definitions set active = false where id = 'd3000000-0000-0000-0000-000000000001';
insert into workflow_definitions (id, organization_id, process_type, name, active) values ('d4000000-0000-0000-0000-000000000001', :'orgA', 'general', 'General', true);
insert into workflow_steps (definition_id, step_no, name, approver_role) values ('d4000000-0000-0000-0000-000000000001', 1, 'HoT', 'head_of_training');
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.workflow_start_request('To cancel', 'x') as cinst \gset
select set_config('request.jwt.claim.sub', :'coord', false);
select public.expect_error(format('select public.workflow_cancel(%L)', :'cinst'), 'Not authorised|not found', 'bystander cannot cancel');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from workflow_instances) = 0 and (select count(*) from workflow_tasks) = 0 and (select count(*) from workflow_events) = 0 and (select count(*) from workflow_definitions) = 0, 'another centre sees nothing of this workflow');
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'another centre has no tasks');
select set_config('request.jwt.claim.sub', :'trainer', false);
select public.assert((select count(*) from workflow_instances) >= 1, 'requester sees their own requests');
select public.assert((select count(*) from workflow_definitions) = 0, 'requester cannot read definitions');
select public.workflow_cancel(:'cinst', 'changed my mind');
select public.assert((select status from workflow_instances where id = :'cinst') = 'cancelled', 'requester can cancel');
select public.assert((select count(*) from workflow_tasks where instance_id = :'cinst' and status = 'cancelled') = 1, 'open task cancelled with it');
select public.expect_error(format('select public.workflow_cancel(%L)', :'cinst'), 'already finished', 'cannot cancel twice');
select set_config('request.jwt.claim.sub', :'hot', false);
select public.assert((select count(*) from workflow_my_tasks()) = 0, 'cancelled request leaves the approvers queue');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from workflow_instances) >= 3 and (select count(*) from workflow_definitions) >= 2, 'admin sees all instances and definitions');
reset role;
select 'OK cancel and visibility';

-- ===== adoption: exemption requests =====
insert into workflow_definitions (id, organization_id, process_type, name, active) values ('d5000000-0000-0000-0000-000000000001', :'orgA', 'assessment_request', 'Exemptions', true);
insert into workflow_steps (definition_id, step_no, name, approver_role) values ('d5000000-0000-0000-0000-000000000001', 1, 'Assessment coordinator', 'assessment_coordinator');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
insert into assessment_requests (id, organization_id, request_type, trainee_id, applicant_name, unit_standard_id, motivation)
 values ('a5000000-0000-0000-0000-000000000001', :'orgA','exemption','d0000000-0000-0000-0000-000000000001','Tina One','f0000000-0000-0000-0000-000000000001','Did it elsewhere');
insert into assessment_requests (id, organization_id, request_type, trainee_id, applicant_name, qualification_id, motivation)
 values ('a5000000-0000-0000-0000-000000000002', :'orgA','rpl','d0000000-0000-0000-0000-000000000001','Tina One',:'Q','Ten years welding');
reset role;
select public.assert((select count(*) from workflow_instances where process_type = 'assessment_request' and subject_id = 'a5000000-0000-0000-0000-000000000001') = 1, 'submitting an exemption starts the workflow');
select public.assert((select count(*) from workflow_instances where subject_id = 'a5000000-0000-0000-0000-000000000002') = 0, 'RPL does not use the workflow (the assessment decides it)');
select public.assert((select summary->>'Applicant' from workflow_instances where subject_id = 'a5000000-0000-0000-0000-000000000001') = 'Tina One', 'approvers get the applicant details');
-- staff cannot bypass the workflow from the old screen
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.expect_error($$update assessment_requests set status = 'approved' where id = 'a5000000-0000-0000-0000-000000000001'$$, 'approval workflow', 'direct approval is blocked while a workflow is running');
select public.expect_error($$update assessment_requests set status = 'rejected' where id = 'a5000000-0000-0000-0000-000000000001'$$, 'approval workflow', 'direct rejection is blocked too');
update assessment_requests set status = 'under_review' where id = 'a5000000-0000-0000-0000-000000000001';
select public.assert((select status from assessment_requests where id = 'a5000000-0000-0000-0000-000000000001') = 'under_review', 'non-final statuses still work');
-- the RPL request is unaffected
update assessment_requests set status = 'approved', outcome = 'competent' where id = 'a5000000-0000-0000-0000-000000000002';
select public.assert((select status from assessment_requests where id = 'a5000000-0000-0000-0000-000000000002') = 'approved', 'RPL can still be decided directly');
select set_config('request.jwt.claim.sub', :'coord', false);
select task_id as et from workflow_my_tasks() \gset
select public.assert(public.workflow_act(:'et', 'approve', 'Certificate verified') = 'approved', 'coordinator approves through the workflow');
select public.assert((select status from assessment_requests where id = 'a5000000-0000-0000-0000-000000000001') = 'approved', 'decision written back to the request');
select public.assert((select decision_notes from assessment_requests where id = 'a5000000-0000-0000-0000-000000000001') = 'Certificate verified', 'comment becomes the decision note');
select public.assert((select decided_by from assessment_requests where id = 'a5000000-0000-0000-0000-000000000001') = :'coord'::uuid, 'approver recorded as decision maker');
reset role;
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Exemption request%', 'assessment') >= 1, 'applicant notified via the existing request notification');
-- rejected via workflow, then trainee asked for info via workflow
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
insert into assessment_requests (id, organization_id, request_type, trainee_id, applicant_name, unit_standard_id, motivation)
 values ('a5000000-0000-0000-0000-000000000003', :'orgA','external_assessment','d0000000-0000-0000-0000-000000000001','Tina One','f0000000-0000-0000-0000-000000000001','Please');
select set_config('request.jwt.claim.sub', :'coord', false);
select task_id as et2 from workflow_my_tasks() \gset
select public.workflow_act(:'et2', 'request_info', 'Attach your ID');
select set_config('request.jwt.claim.sub', :'tr1', false);
select id as einst from workflow_instances where subject_id = 'a5000000-0000-0000-0000-000000000003' \gset
select public.assert((select status from workflow_instances where id = :'einst') = 'awaiting_info', 'trainee can see the request is awaiting their information');
select public.workflow_provide_info(:'einst', 'ID attached');
select set_config('request.jwt.claim.sub', :'coord', false);
select task_id as et3 from workflow_my_tasks() \gset
select public.assert(public.workflow_act(:'et3', 'reject', 'Not eligible') = 'rejected', 'rejection through workflow');
select public.assert((select status from assessment_requests where id = 'a5000000-0000-0000-0000-000000000003') = 'rejected', 'request rejected');
reset role;
select 'OK adoption: assessment requests';

-- ===== adoption: delivery plans =====
insert into trainers (id, organization_id, user_id, trainer_id, full_name, email) values ('70000000-0000-0000-0000-000000000001', :'orgA', :'trainer', 'TR1', 'Trainer One', 'trainer@a.test');
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year, qualification_id, trainer_id)
 values ('71000000-0000-0000-0000-000000000001', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'fulltime', 'W1', 'Welding L1 A', '2026', :'Q', '70000000-0000-0000-0000-000000000001');
insert into qualification_unit_standards (qualification_id, unit_standard_id, unit_standard_title, credit_value, level) values (:'Q','US-1','Safety',10,1);
insert into workflow_definitions (id, organization_id, process_type, name, active) values ('d6000000-0000-0000-0000-000000000001', :'orgA', 'delivery_plan', 'Plans', true);
insert into workflow_steps (definition_id, step_no, name, approver_role) values ('d6000000-0000-0000-0000-000000000001', 1, 'Head of Training', 'head_of_training');
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.generate_delivery_plan('71000000-0000-0000-0000-000000000001', date '2026-02-02', 6, null) as plan \gset
update delivery_plans set status = 'submitted' where id = :'plan';
select public.assert((select count(*) from workflow_instances where process_type = 'delivery_plan' and subject_id = :'plan') = 1, 'submitting a plan starts the workflow');
select public.assert((select summary->>'Weeks' from workflow_instances where subject_id = :'plan') = '6', 'approver sees plan details');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.expect_error(format($$update delivery_plans set status = 'approved' where id = %L$$, :'plan'), 'approval workflow', 'direct plan approval blocked');
select set_config('request.jwt.claim.sub', :'hot', false);
select task_id as pt from workflow_my_tasks() \gset
select public.assert(public.workflow_act(:'pt', 'reject', 'Add practical hours') = 'rejected', 'head of training returns the plan');
select public.assert((select status from delivery_plans where id = :'plan') = 'rejected' and (select review_notes from delivery_plans where id = :'plan') = 'Add practical hours', 'plan returned with the reason');
select set_config('request.jwt.claim.sub', :'trainer', false);
update delivery_plans set status = 'submitted' where id = :'plan';
select public.assert((select count(*) from workflow_instances where subject_id = :'plan') = 2, 'resubmission starts a fresh workflow');
select set_config('request.jwt.claim.sub', :'hot', false);
select task_id as pt2 from workflow_my_tasks() \gset
select public.workflow_act(:'pt2', 'approve', 'Good');
select public.assert((select status from delivery_plans where id = :'plan') = 'approved' and (select reviewed_by from delivery_plans where id = :'plan') = :'hot'::uuid, 'plan approved with the approver recorded');
reset role;
-- no workflow active => the old behaviour is untouched
update workflow_definitions set active = false where id = 'd6000000-0000-0000-0000-000000000001';
update delivery_plans set status = 'draft' where id = :'plan';
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
update delivery_plans set status = 'submitted' where id = :'plan';
select public.assert((select count(*) from workflow_instances where subject_id = :'plan') = 2, 'no new workflow when none is active');
select set_config('request.jwt.claim.sub', :'admin', false);
update delivery_plans set status = 'approved' where id = :'plan';
select public.assert((select status from delivery_plans where id = :'plan') = 'approved', 'staff can still approve directly when no workflow is configured');
reset role;
select 'OK adoption: delivery plans';

-- ===== editing safety =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.expect_error($$select public.workflow_save_steps('d4000000-0000-0000-0000-000000000001', '[]')$$, 'Not authorised', 'non-admin cannot save steps');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.workflow_start_request('Running one', 'x') as run1 \gset
select public.expect_error($$select public.workflow_save_steps('d4000000-0000-0000-0000-000000000001', '[{"name":"New","approver_role":"admin"}]')$$, 'running request', 'steps locked while requests are running');
select public.assert((select count(*) from workflow_steps where definition_id = 'd4000000-0000-0000-0000-000000000001') = 1, 'failed save leaves existing steps intact');
select public.workflow_cancel(:'run1', 'done');
select public.expect_error($$select public.workflow_save_steps('d4000000-0000-0000-0000-000000000001', '[{"name":"","approver_role":"admin"}]')$$, 'needs a name', 'step name required');
select public.expect_error($$select public.workflow_save_steps('d4000000-0000-0000-0000-000000000001', '[{"name":"X"}]')$$, 'role or a named person', 'approver required');
select public.expect_error($$select public.workflow_save_steps('d4000000-0000-0000-0000-000000000001', '[{"name":"X","approver_role":"admin","approver_user":"11111111-0000-0000-0000-000000000001"}]')$$, 'role or a named person', 'not both');
select public.expect_error($$select public.workflow_save_steps('d4000000-0000-0000-0000-000000000001', '[{"name":"X","approver_role":"no_such_role"}]')$$, 'does not exist', 'unknown role refused');
select public.expect_error($$select public.workflow_save_steps('d4000000-0000-0000-0000-000000000001', '[]')$$, 'at least one step', 'active workflow keeps a step');
select public.assert((select count(*) from workflow_steps where definition_id = 'd4000000-0000-0000-0000-000000000001') = 1, 'rejected saves are atomic (old steps kept)');
select public.workflow_save_steps('d4000000-0000-0000-0000-000000000001', '[{"name":"First","approver_role":"head_of_training","sla_hours":8,"escalate_to_role":"admin"},{"name":"Second","approver_user":"11111111-0000-0000-0000-000000000001","allow_self_approval":true}]');
select public.assert((select count(*) from workflow_steps where definition_id = 'd4000000-0000-0000-0000-000000000001') = 2 and (select name from workflow_steps where definition_id = 'd4000000-0000-0000-0000-000000000001' and step_no = 2) = 'Second', 'steps replaced and renumbered');
insert into workflow_definitions (id, organization_id, process_type, name, active) values ('d7000000-0000-0000-0000-000000000001', :'orgA', 'delivery_plan', 'Empty', false);
select public.expect_error($$update workflow_definitions set active = true where id = 'd7000000-0000-0000-0000-000000000001'$$, 'at least one step', 'cannot activate an empty workflow');
reset role;
select 'OK editing safety';
