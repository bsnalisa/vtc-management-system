\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set sa '98200000-0000-0000-0000-000000000001'
\set oa '98200000-0000-0000-0000-000000000002'
\set sm '98200000-0000-0000-0000-000000000003'
\set other '98200000-0000-0000-0000-000000000004'

insert into auth.users (id,email) values (:'sa','sa@x.test'),(:'oa','oa@a.test'),(:'sm','sm@a.test'),(:'other','other@a.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '98200000%' on conflict (user_id) do update set full_name = excluded.full_name;
update profiles set full_name = split_part(email,'@',1) where user_id::text like '98200000%';
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'sa','super_admin',null),(:'oa','organization_admin',:'orgA'),(:'other','librarian',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;

-- the base role exists and is assignable like any other
select public.assert(exists (select 1 from custom_roles where role_code = 'staff_member' and is_system_role and active), 'the Staff Member base role is available');
insert into user_roles (user_id, role, organization_id) values (:'sm', 'staff_member', :'orgA');
select public.assert((select count(*) from user_roles where user_id = :'sm' and role::text = 'staff_member') = 1, 'a person can be created with only that role');

-- on its own it opens nothing
reset role;
insert into fee_records (trainee_id, total_fee, amount_paid, academic_year, organization_id) select id, 1000, 100, '2026', organization_id from trainees where organization_id = :'orgA' limit 1;
select count(*) as ntr_all from trainees where organization_id = :'orgA' \gset
select public.assert(:ntr_all >= 1, 'there are trainees to protect');
-- a colleague with an ordinary role keeps the access they always had
set role authenticated; select set_config('request.jwt.claim.sub', :'other', false);
select public.assert((select count(*) from trainees) = :ntr_all and (select count(*) from fee_records) >= 1, 'a person with an ordinary role still reads the centre''s records');
set role authenticated; select set_config('request.jwt.claim.sub', :'sm', false);
select public.assert((select count(*) from trainees) = 0 and (select count(*) from fee_records) = 0 and (select count(*) from purchase_requisitions) = 0 and (select count(*) from classes) = 0 and (select count(*) from stock_items) = 0, 'a Staff Member alone cannot read trainees, fees, classes, stock or requisitions');
select public.expect_error($$insert into trades (organization_id, name, code) values ('a0000000-0000-0000-0000-00000000000a', 'X', 'XX')$$, 'row-level|violates', 'nor write to them');
select public.assert((select count(*) from user_roles where user_id = '98200000-0000-0000-0000-000000000003') = 1 and (select count(*) from organizations) >= 1, 'but can still see their own role and the centre');
select public.assert((select count(*) from user_roles) = 1, 'and sees no colleague''s roles');
select public.assert(public.my_capabilities(:'orgA') = ARRAY[]::text[] and jsonb_array_length(public.my_dashboard(:'orgA') -> 'widgets') = 0, 'and has no capabilities and an empty dashboard');

-- a brand-new position, defined from scratch and given to that person
select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_create('safety_officer', 'Safety Officer',
  'The Safety Officer monitors workshop safety, follows attendance at safety induction, checks protective equipment stock, and raises support tickets for faulty equipment. Reports on leave and incidents each month.') as v \gset
select public.role_factory_save_draft(:'v', (select job_description from factory_role_versions where id = :'v'), null, ARRAY['attendance.summary', 'inventory.summary', 'hr.own', 'tickets.own']);
select public.role_factory_save_widgets(:'v', ARRAY['attendance.rate', 'stock.levels', 'leave.mine', 'tickets.mine']);
select public.role_factory_submit(:'v');
select public.role_factory_decide(:'v', true, 'ok');
select id as r from factory_roles where role_code = 'safety_officer' \gset
select set_config('request.jwt.claim.sub', :'oa', false);
select public.role_factory_assign(:'orgA', :'sm', :'r');
-- own data only: a ticket and a leave request by someone else must not show
reset role;
insert into support_tickets (organization_id, user_id, subject, description) values (:'orgA', :'other', 'Other person ticket', 'x');
insert into support_tickets (organization_id, user_id, subject, description) values (:'orgA', :'sm', 'My ticket', 'x');
set role authenticated; select set_config('request.jwt.claim.sub', :'sm', false);
select public.assert((select array_agg(w ->> 'code' order by w ->> 'code') from jsonb_array_elements(public.my_dashboard(:'orgA') -> 'widgets') w) = ARRAY['attendance.rate', 'leave.mine', 'stock.levels', 'tickets.mine'], 'the new position has a dashboard with exactly its widgets');
select public.assert((public.dashboard_widget_data(:'orgA', 'tickets.mine') -> 'stats' -> 0 ->> 'value')::int = 1, 'my tickets counts only the person''s own');
select public.assert(jsonb_typeof(public.dashboard_widget_data(:'orgA', 'attendance.rate') -> 'stats') = 'array' and jsonb_typeof(public.dashboard_widget_data(:'orgA', 'stock.levels') -> 'stats') = 'array' and jsonb_typeof(public.dashboard_widget_data(:'orgA', 'leave.mine') -> 'stats') = 'array', 'the other new widgets answer');
select public.expect_error($$select public.dashboard_widget_data('a0000000-0000-0000-0000-00000000000a', 'trainees.recent')$$, 'not part of your dashboard', 'a named-record widget is refused without its capability');
select public.assert((select count(*) from trainees) = 0, 'and the Staff Member still reads no trainee rows directly');

-- sensitive widgets: the named-record ones need sensitive capabilities, so only the Super Admin can assign them
select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_create('records_viewer', 'Records Viewer',
  'The Records Viewer reviews recently registered trainees and the largest outstanding fee balances so that follow-up calls can be made by the finance and registration teams each week.') as v2 \gset
select public.role_factory_save_draft(:'v2', (select job_description from factory_role_versions where id = :'v2'), null, ARRAY['trainees.records', 'fees.records']);
select public.role_factory_save_widgets(:'v2', ARRAY['trainees.recent', 'fees.outstanding']);
select public.role_factory_submit(:'v2');
select public.role_factory_decide(:'v2', true, 'reviewed', true);
select id as r2 from factory_roles where role_code = 'records_viewer' \gset
select set_config('request.jwt.claim.sub', :'oa', false);
select public.expect_error(format($f$select public.role_factory_assign('a0000000-0000-0000-0000-00000000000a', '98200000-0000-0000-0000-000000000003', %L)$f$, :'r2'), 'sensitive', 'the Organisation Admin cannot assign a named-record role');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_assign(:'orgA', :'sm', :'r2');
select set_config('request.jwt.claim.sub', :'sm', false);
reset role;
select count(*) as ntr from trainees where organization_id = :'orgA' \gset
set role authenticated; select set_config('request.jwt.claim.sub', :'sm', false);
select public.assert(jsonb_array_length(public.dashboard_widget_data(:'orgA', 'trainees.recent') -> 'rows') = least(15, :ntr), 'once assigned by the Super Admin the recent-trainees table lists the centre''s trainees');
select public.assert(jsonb_typeof(public.dashboard_widget_data(:'orgA', 'fees.outstanding') -> 'rows') = 'array', 'and the outstanding fees table answers');
reset role;
-- every table that any role-holder at a centre can read is closed to a Staff Member alone
select public.assert(not exists (select 1 from private.org_wide_read_tables() t(name) where not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.name and p.policyname = 'Staff Member alone has no access')), 'no organisation-wide readable table is missing the Staff Member restriction');
select 'OK role factory gaps';
