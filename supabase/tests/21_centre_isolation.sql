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
insert into payments (fee_record_id, amount, recorded_by) values ('f1000000-0000-0000-0000-00000000000a', 100, :'debtorA'), ('f1000000-0000-0000-0000-00000000000b', 200, :'debtorB');
insert into trades (id, name, code, organization_id) values ('c1000000-0000-0000-0000-00000000000a','A trade','AT',:'orgA'),('c1000000-0000-0000-0000-00000000000b','B trade','BT',:'orgB'),('c1000000-0000-0000-0000-00000000000c','Shared trade','ST',null);

-- ===== who is confined =====
select set_config('request.jwt.claim.sub', :'debtorA', false);
select public.assert(public.is_centre_scoped_user(), 'centre staff are confined');
select set_config('request.jwt.claim.sub', :'multi', false);
select public.assert(public.is_centre_scoped_user() and public.my_centre_ids() @> array[:'orgA'::uuid, :'orgB'::uuid], 'a user in two centres belongs to both');
select set_config('request.jwt.claim.sub', :'applicant', false);
select public.assert(not public.is_centre_scoped_user(), 'applicants (no centre role) are not confined');
select set_config('request.jwt.claim.sub', :'vms', false);
select public.assert(not public.is_centre_scoped_user(), 'platform staff are not confined');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert(not public.is_centre_scoped_user(), 'super admins are not confined');
select set_config('request.jwt.claim.sub', :'debtorA', false);
select public.assert(public.user_visible_to_my_centres(:'applicant') and public.user_visible_to_my_centres(:'trainerA') and not public.user_visible_to_my_centres(:'trainerB'), 'people are visible to their own centre and applicants, not to other centres');

-- ===== a debtor officer is global in the old policies; now confined to their centre =====
set role authenticated; select set_config('request.jwt.claim.sub', :'debtorA', false);
select public.assert((select count(*) from fee_records) = 1 and (select organization_id from fee_records) = :'orgA', 'centre A debtor sees only centre A fee records');
select public.assert((select count(*) from payments) = 1 and (select amount from payments) = 100, 'payments are confined through their fee record');
select public.expect_error($$insert into fee_records (trainee_id, organization_id, total_fee, academic_year) values ('d0000000-0000-0000-0000-0000000000bb','b0000000-0000-0000-0000-00000000000b', 5, '2027')$$, 'row-level security', 'cannot create a fee record in another centre');
update fee_records set total_fee = 1 where organization_id = :'orgB';
delete from fee_records where organization_id = :'orgB';
reset role;
select public.assert((select total_fee from fee_records where organization_id = :'orgB') = 2000, 'another centre''s fee record is untouched (update and delete)');
set role authenticated; select set_config('request.jwt.claim.sub', :'debtorA', false);
update fee_records set total_fee = 1100 where organization_id = :'orgA';
reset role;
select public.assert((select total_fee from fee_records where organization_id = :'orgA') = 1100, 'the debtor can still change their own centre''s fee record');

-- ===== shared rows stay visible; other centres' rows do not =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from trades where name = 'A trade') = 1, 'a trainer sees their centre''s trade');
select public.assert((select count(*) from trades where name = 'B trade') = 0, 'a trainer does not see another centre''s trade');
select public.assert((select count(*) from trades where name = 'Shared trade') = 1, 'shared trades stay visible');
select set_config('request.jwt.claim.sub', :'multi', false);
select public.assert((select count(*) from trades where name in ('A trade','B trade')) = 2, 'a user in two centres sees both');
select set_config('request.jwt.claim.sub', :'vms', false);
select public.assert((select count(*) from trades where name in ('A trade','B trade')) = 2, 'platform staff are not narrowed');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert((select count(*) from fee_records) = 2, 'a super admin still sees every centre');
select set_config('request.jwt.claim.sub', :'applicant', false);
select public.assert((select count(*) from trades where name in ('A trade','B trade')) = 2, 'applicants are not narrowed');
reset role;
set role anon;
select public.assert((select count(*) from trades where name in ('A trade','B trade')) = 2, 'anonymous visitors are not narrowed');
reset role;

-- ===== people =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from profiles where user_id = :'trainerB') = 0, 'another centre''s people are not visible');
select public.assert((select count(*) from profiles where user_id = :'trainerA') = 1, 'you can always see yourself');
select public.assert((select count(*) from user_roles where user_id = :'trainerB') = 0, 'another centre''s role rows are not visible');
reset role;
select 'OK centre isolation';
