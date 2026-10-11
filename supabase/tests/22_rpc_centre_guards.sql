\set ON_ERROR_STOP on
\set trainerA '11111111-0000-0000-0000-000000000004'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set trainerB '44444444-0000-0000-0000-000000000001'
\set debtorA '44444444-0000-0000-0000-000000000002'
\set debtorB '44444444-0000-0000-0000-000000000003'
\set vms '44444444-0000-0000-0000-000000000004'
\set applicant '44444444-0000-0000-0000-000000000005'
\set multi '44444444-0000-0000-0000-000000000006'
\set sa '44444444-0000-0000-0000-000000000007'
\set TB 'd0000000-0000-0000-0000-0000000000bb'

-- ===== setup (as the database owner) =====
insert into auth.users (id,email) values (:'trainerB','tb@b.test'),(:'debtorA','da@a.test'),(:'debtorB','db@b.test'),(:'vms','vms@x.test'),(:'applicant','applicant@x.test'),(:'multi','multi@x.test'),(:'sa','sa@x.test');
update profiles p set full_name = split_part(u.email,'@',1), email = u.email from auth.users u where u.id = p.user_id and u.id::text like '44444444%';
insert into user_roles (user_id, role, organization_id) values
 (:'trainerB','trainer',:'orgB'), (:'debtorA','debtor_officer',:'orgA'), (:'debtorB','debtor_officer',:'orgB'),
 (:'vms','vms_support',null), (:'sa','super_admin',null),
 (:'multi','librarian',:'orgA'), (:'multi','trainer',:'orgB');
-- a trainee at centre B (copy of the centre A trainee with its unique fields changed)
create temp table tb as select * from trainees where id = :'T1';
update tb set id = :'TB', trainee_id = 'B-0001', national_id = 'B-NATID', user_id = null, organization_id = :'orgB', email = null, system_email = null;
insert into trainees select * from tb;
insert into fee_records (id, trainee_id, organization_id, total_fee, academic_year) values
 ('f1000000-0000-0000-0000-00000000000a', :'T1', :'orgA', 1000, '2026'),
 ('f1000000-0000-0000-0000-00000000000b', :'TB', :'orgB', 2000, '2026');
\set trainee1 '11111111-0000-0000-0000-000000000003'

-- ===== a trainer cannot reach another centre's trainee through the functions =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert(public.calculate_trainee_gpa(:'T1') is not null, 'a trainer can use the function for their own centre''s trainee');
select public.expect_error($$select public.calculate_trainee_gpa('d0000000-0000-0000-0000-0000000000bb')$$, 'Not authorised', 'a trainer cannot use it for another centre''s trainee');
select public.expect_error($$select * from public.check_trainee_progression('d0000000-0000-0000-0000-0000000000bb')$$, 'Not authorised', 'progression check is confined to the centre');
select public.assert(not public.trainee_has_outstanding_fees('d0000000-0000-0000-0000-0000000000bb', '2026'), 'outstanding fees of another centre''s trainee read as nothing');
select public.assert(public.trainee_has_outstanding_fees(:'T1', '2026'), 'outstanding fees of an own-centre trainee are still found');
select public.assert(not exists (select 1 from public.get_trainee_exam_eligibility('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-0000000000bb')), 'exam eligibility of another centre''s trainee is empty');

-- search always stays inside the centre, even when no centre (or another one) is asked for
select public.assert((select count(*) from public.global_search('Tina', null, 50) where result_type = 'trainee') = 1, 'search without a centre is limited to the caller''s centre');
select public.assert((select count(*) from public.global_search('Tina', :'orgB'::uuid, 50) where result_type = 'trainee' and (result_data->>'id')::uuid = :'TB') = 0, 'asking for another centre does not search it');

-- the trainee themselves
select set_config('request.jwt.claim.sub', :'trainee1', false);
select public.assert(public.calculate_trainee_gpa(:'T1') is not null, 'a trainee can use the function for themselves');
select public.expect_error($$select public.calculate_trainee_gpa('d0000000-0000-0000-0000-0000000000bb')$$, 'Not authorised', 'a trainee cannot use it for someone at another centre');

-- ===== centre-id functions =====
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.expect_error($$select public.log_assessment_audit('b0000000-0000-0000-0000-00000000000b', null, 'x', null, 'forged')$$, 'Not authorised', 'cannot write an audit entry for another centre');
select public.expect_error($$select public.lock_assessment_cycle('a0000000-0000-0000-0000-00000000000a', null, '2026')$$, 'Not authorised', 'a trainer cannot lock an assessment cycle');
select public.expect_error($$select public.seed_symbol_points_for_organization('b0000000-0000-0000-0000-00000000000b')$$, 'Not authorised', 'cannot seed another centre''s data');
select public.assert((select count(*) from public.check_subscription_expiry() where organization_id = 'b0000000-0000-0000-0000-00000000000b') = 0, 'subscription list hides other centres');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert(public.calculate_trainee_gpa('d0000000-0000-0000-0000-0000000000bb') is not null, 'a super admin can use the functions for any centre');
select public.assert(public.get_asset_categories_count(null) >= 0, 'a super admin can count across centres');
reset role;

-- ===== visitors who are not signed in =====
set role anon;
select public.expect_error($$select public.calculate_trainee_gpa('d0000000-0000-0000-0000-000000000001')$$, 'permission denied', 'a visitor cannot call internal functions');
select public.expect_error($$select public.lock_assessment_cycle('a0000000-0000-0000-0000-00000000000a', null, '2026')$$, 'permission denied', 'a visitor cannot lock a cycle');
select public.expect_error($$select * from public.global_search('Tina', null, 5)$$, 'permission denied', 'a visitor cannot search');
select public.application_window_status('no-such-centre'); -- public application functions stay open
reset role;

-- ===== roles need a centre =====
select public.expect_error($$insert into user_roles (user_id, role, organization_id) values ('44444444-0000-0000-0000-000000000005', 'librarian', null)$$, 'user_roles_centre_required', 'a centre role cannot be created without a centre');
select 'OK rpc centre guards';
