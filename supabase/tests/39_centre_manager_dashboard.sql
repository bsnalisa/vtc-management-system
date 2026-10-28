\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set cm '97c00000-0000-0000-0000-000000000001'
\set pa '97c00000-0000-0000-0000-000000000002'
\set hr '97c00000-0000-0000-0000-000000000003'
\set adm '97c00000-0000-0000-0000-000000000004'
\set cmB '97c00000-0000-0000-0000-000000000005'
\set T1 'd0000000-0000-0000-0000-000000000001'

insert into auth.users (id,email) values (:'cm','cm@a.test'),(:'pa','pa@a.test'),(:'hr','hr@a.test'),(:'adm','adm@a.test'),(:'cmB','cmb@b.test');
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'cm','centre_manager',:'orgA'),(:'pa','pa_to_centre_manager',:'orgA'),(:'hr','hr_officer',:'orgA'),(:'adm','organization_admin',:'orgA'),(:'cmB','centre_manager',:'orgB');
alter table user_roles enable trigger trg_guard_privileged_roles;
insert into fee_records (trainee_id, total_fee, amount_paid, academic_year, organization_id) values (:'T1', 2000, 500, '2025', :'orgA'), (:'T1', 1000, 900, '2026', :'orgA');
insert into department_budgets (organization_id, department, budget_year, total_budget, spent_amount) values (:'orgA', 'Training', '2026', 10000, 2500);
insert into office_correspondence (organization_id, reference, direction, subject, party, item_date, due_on, status) values (:'orgA', 'C-1', 'incoming', 'NTA annual return', 'NTA', current_date - 20, current_date - 3, 'received');
insert into office_tasks (organization_id, title, due_on, source, status) values (:'orgA', 'Quarterly report to NTA', current_date - 2, 'report', 'open'), (:'orgA', 'Staff review', current_date + 10, 'review', 'open'), (:'orgA', 'Other', current_date + 1, 'self', 'open');

set role authenticated; select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((public.centre_manager_finance() ->> 'year') = '2026' and (public.centre_manager_finance() -> 'fees' ->> 'collection_rate')::numeric = 90.0, 'finance defaults to the latest academic year, not all years mixed');
select public.assert((public.centre_manager_finance(null, '2025') -> 'fees' ->> 'billed')::numeric = 2000, 'another year can be chosen');
select public.assert((public.centre_manager_overview() -> 'finance' ->> 'billed')::numeric = 1000, 'the main dashboard uses the latest academic year');
select public.assert((public.centre_manager_finance() -> 'budgets' -> 0 ->> 'utilisation')::numeric = 25.0, 'budget against actual is calculated');
select public.assert(jsonb_typeof(public.centre_manager_finance() -> 'requisitions') = 'object' and (public.centre_manager_finance() -> 'funding') ? 'awarded', 'requisition pipeline and funding sections exist');
select public.assert(jsonb_typeof(public.centre_manager_quality() -> 'qualifications') = 'object' and (public.centre_manager_quality() -> 'progression') ? 'dropout_rate', 'quality figures exist');
select public.assert((public.centre_manager_stakeholders() -> 'correspondence' ->> 'overdue')::int = 1 and (public.centre_manager_stakeholders() -> 'reports_and_reviews' ->> 'open')::int = 2 and (public.centre_manager_stakeholders() -> 'reports_and_reviews' ->> 'overdue')::int = 1, 'overdue correspondence and reports due are counted, other tasks are not');
select public.assert((public.centre_manager_staffing() -> 'leave') ? 'pending' and jsonb_typeof(public.centre_manager_staffing() -> 'establishment') = 'array', 'staffing figures exist');
select public.expect_error($$select public.save_staff_establishment('a0000000-0000-0000-0000-00000000000a', 'trainer', 'Trainer', 5)$$, 'Only the HR officer', 'the Centre Manager does not edit the establishment');
select public.expect_error($$select public.save_centre_target('a0000000-0000-0000-0000-00000000000a', 'pass_rate', 80)$$, 'Only the PA', 'nor the targets');

select set_config('request.jwt.claim.sub', :'hr', false);
select public.save_staff_establishment(:'orgA', 'trainer', 'Trainer', 5);
select public.expect_error($$select public.save_staff_establishment('a0000000-0000-0000-0000-00000000000a', 'not_a_role', 'X', 1)$$, 'Unknown role', 'only real roles can be given posts');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((public.centre_manager_staffing() -> 'establishment' -> 0 ->> 'approved')::int = 5 and (public.centre_manager_staffing() -> 'establishment' -> 0 ->> 'vacant')::int <= 5, 'vacancies come from approved posts against people holding the role');

select set_config('request.jwt.claim.sub', :'pa', false);
select public.save_centre_target(:'orgA', 'collection_rate', 85);
select public.expect_error($$select public.save_centre_target('a0000000-0000-0000-0000-00000000000a', 'invented', 1)$$, 'violates|check', 'only the known indicators can have targets');
select public.assert((public.centre_targets_list() ->> 'collection_rate')::numeric = 85, 'the PA''s target is stored');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((public.centre_targets_list() ->> 'collection_rate')::numeric = 85, 'the Centre Manager reads it');

-- who may open them
select set_config('request.jwt.claim.sub', :'adm', false);
select public.expect_error($$select public.centre_manager_finance()$$, 'Not authorised', 'the IT administrator cannot read the finance panel');
select public.expect_error($$select public.centre_manager_quality()$$, 'Not authorised', 'nor the quality panel');
select public.expect_error($$select public.centre_manager_executive()$$, 'Not authorised', 'nor the executive view');
select set_config('request.jwt.claim.sub', :'pa', false);
select public.expect_error($$select public.centre_manager_staffing()$$, 'Not authorised', 'the PA does not see staffing figures');
select set_config('request.jwt.claim.sub', :'cmB', false);
select public.expect_error(format('select public.centre_manager_finance(%L)', :'orgA'), 'Not authorised', 'another centre''s manager is refused');
select public.expect_error(format('select public.centre_targets_list(%L)', :'orgA'), 'Not authorised', 'and cannot read its targets');
reset role;
select public.assert(pg_get_functiondef('public.requisition_fulfilment(uuid)'::regprocedure) like '%''order_value'', p.order_value%', 'the requisition page carries the order value');
select 'OK centre manager dashboard';
