\set ON_ERROR_STOP on
select set_config('app.legacy_import', 'on', false);
\set trainerA '11111111-0000-0000-0000-000000000004'
\set adminA '11111111-0000-0000-0000-000000000001'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set cmA '55555555-0000-0000-0000-000000000001'
\set cmB '55555555-0000-0000-0000-000000000002'
\set sa '55555555-0000-0000-0000-000000000003'
\set TB 'd0000000-0000-0000-0000-0000000000bb'

-- ===== setup =====
insert into auth.users (id,email) values (:'cmA','cma@a.test'),(:'cmB','cmb@b.test'),(:'sa','sa@x.test');
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'cmA','centre_manager',:'orgA'),(:'cmB','centre_manager',:'orgB'),(:'sa','super_admin',null);
alter table user_roles enable trigger trg_guard_privileged_roles;
create temp table tb as select * from trainees where id = :'T1';
update tb set id = :'TB', identity_id = null, trainee_id = 'B-0001', national_id = 'B-NATID', user_id = null, organization_id = :'orgB', email = null, system_email = null;
insert into trainees select * from tb;
insert into fee_records (id, trainee_id, organization_id, total_fee, amount_paid, academic_year) values
 ('f1000000-0000-0000-0000-00000000000a', :'T1', :'orgA', 1000, 400, '2026'),
 ('f1000000-0000-0000-0000-00000000000b', :'TB', :'orgB', 5000, 5000, '2026');

-- ===== the role exists and is assignable =====
select public.assert(exists (select 1 from custom_roles where role_code = 'centre_manager' and active), 'Centre Manager is an assignable role');

-- ===== the overview =====
set role authenticated; select set_config('request.jwt.claim.sub', :'cmA', false);
select public.assert((public.centre_manager_overview()->'finance'->>'billed')::numeric = 1000, 'the manager sees their own centre''s billed total only');
select public.assert((public.centre_manager_overview()->'finance'->>'collected')::numeric = 400, 'collected total is the centre''s own');
select public.assert((public.centre_manager_overview()->'finance'->>'collection_rate')::numeric = 40.0, 'collection rate is worked out');
select public.assert((public.centre_manager_overview()->'finance'->>'debtors')::int = 1, 'debtors are counted');
select public.assert((public.centre_manager_overview()->'trainees'->>'total')::int = (select count(*) from trainees where organization_id = :'orgA'), 'trainee total is the centre''s own');
select public.assert(jsonb_typeof(public.centre_manager_overview()->'applications'->'trend') = 'array' and jsonb_array_length(public.centre_manager_overview()->'applications'->'trend') = 6, 'six-month application trend');
select public.assert(public.centre_manager_overview()->'attention' ? 'open_tickets' and public.centre_manager_overview()->'people' ? 'staff', 'attention and people sections exist');
select public.expect_error($$select public.centre_manager_overview('b0000000-0000-0000-0000-00000000000b')$$, 'Not authorised', 'a manager cannot open another centre''s overview');

-- ===== who may open it =====
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.expect_error($$select public.centre_manager_overview()$$, 'Not authorised', 'a trainer cannot open the overview');
select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert(public.centre_manager_overview() ? 'finance', 'an Organization Admin can preview the overview');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert((public.centre_manager_overview(:'orgB'::uuid)->'finance'->>'billed')::numeric = 5000, 'platform staff can open any centre');
reset role;
set role anon;
select public.expect_error($$select public.centre_manager_overview()$$, 'permission denied', 'visitors cannot open it');
reset role;

-- ===== read access is confined and read-only =====
set role authenticated; select set_config('request.jwt.claim.sub', :'cmA', false);
select public.assert((select count(*) from trainees where organization_id = :'orgA') > 0, 'the manager reads their centre''s trainees');
select public.assert((select count(*) from trainees where organization_id = :'orgB') = 0, 'the manager cannot read another centre''s trainees');
select public.assert((select count(*) from fee_records) = 1, 'fee records are limited to the centre');
update fee_records set total_fee = 1 where id = 'f1000000-0000-0000-0000-00000000000a';
update trainees set first_name = 'Changed' where organization_id = :'orgA';
reset role;
select public.assert((select total_fee from fee_records where id = 'f1000000-0000-0000-0000-00000000000a') = 1000, 'the manager cannot change a fee');
select public.assert((select count(*) from trainees where first_name = 'Changed') = 0, 'the manager cannot change a trainee');
set role authenticated; select set_config('request.jwt.claim.sub', :'cmA', false);
select public.expect_error($$insert into fee_records (trainee_id, organization_id, total_fee, academic_year) values ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a', 5, '2027')$$, 'row-level security', 'the manager cannot add a fee record');
reset role;

-- ===== only a super admin grants the role =====
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.expect_error($$insert into user_roles (user_id, role, organization_id) values ('11111111-0000-0000-0000-000000000008','centre_manager','a0000000-0000-0000-0000-00000000000a')$$, 'super admin', 'an Organization Admin cannot grant Centre Manager');
select set_config('request.jwt.claim.sub', :'sa', false);
insert into user_roles (user_id, role, organization_id) values ('11111111-0000-0000-0000-000000000008','centre_manager','a0000000-0000-0000-0000-00000000000a');
select public.assert((select count(*) from user_roles where user_id = '11111111-0000-0000-0000-000000000008' and role = 'centre_manager') = 1, 'a super admin can grant it');
reset role;

-- ===== an Organization Admin does not register trainees =====
create temp table newt as select * from trainees where id = :'T1';
update newt set id = gen_random_uuid(), identity_id = null, first_name = 'Newcomer', last_name = 'Person', date_of_birth = '1999-05-05', trainee_id = 'A-NEW', national_id = 'A-NEW-NATID', user_id = null, email = null, system_email = null;
grant select on newt to authenticated;
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.expect_error($$insert into trainees select * from newt$$, 'row-level security', 'an Organization Admin cannot register a trainee');
select set_config('request.jwt.claim.sub', :'cmA', false);
select public.expect_error($$insert into trainees select * from newt$$, 'row-level security', 'a Centre Manager cannot register a trainee');
reset role;
select public.assert((select count(*) from trainees where trainee_id = 'A-NEW') = 0, 'no trainee was created');
insert into trainees select * from newt;
select public.assert((select count(*) from trainees where trainee_id = 'A-NEW') = 1, 'the database owner (registration code running as service) can still insert');

-- someone who is both Organization Admin and registration officer may register
insert into user_roles (user_id, role, organization_id) values (:'adminA','registration_officer',:'orgA');
update newt set id = gen_random_uuid(), identity_id = null, first_name = 'Second', last_name = 'Newcomer', date_of_birth = '1998-04-04', trainee_id = 'A-NEW2', national_id = 'A-NEW2-NATID';
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
insert into trainees select * from newt;
reset role;
select public.assert((select count(*) from trainees where national_id = 'A-NEW2-NATID') = 1 and (select trainee_id from trainees where national_id = 'A-NEW2-NATID') ~ '^[0-9]{9}$', 'an admin who is also a registration officer can register, and the database issues the number');

-- ===== reports =====
set role authenticated; select set_config('request.jwt.claim.sub', :'cmA', false);
select * from public.certified_trainees_report();
select * from public.assessment_certification_summary();
select public.assert((select count(*) from assessment_results ar join trainees t on t.id = ar.trainee_id where t.organization_id = :'orgB') = 0, 'report tables show no other centre rows');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.expect_error($$select * from public.certified_trainees_report()$$, 'Not authorised', 'other staff still cannot run the certification report');
reset role;
select 'OK centre manager';
