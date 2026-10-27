\set ON_ERROR_STOP on
\set adminA '11111111-0000-0000-0000-000000000001'
\set adminB '11111111-0000-0000-0000-000000000007'
\set trainerA '11111111-0000-0000-0000-000000000004'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set sa '33333333-0000-0000-0000-000000000001'
\set debtor '33333333-0000-0000-0000-000000000002'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set T1 'd0000000-0000-0000-0000-000000000001'

-- ===== setup (as the database owner) =====
insert into auth.users (id,email) values (:'sa','super@x.test'),(:'debtor','debtor@a.test');
update profiles p set full_name = split_part(u.email,'@',1), email = u.email from auth.users u where u.id = p.user_id and u.id::text like '33333333%';
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'sa','super_admin',null);
alter table user_roles enable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'debtor','debtor_officer',:'orgA');
-- the seed admins carry the retired 'admin' role; make A's an Organization Admin too so both spellings are exercised
insert into trainers (id, user_id, organization_id, full_name, email, phone, designation, employment_type, gender, trainer_id, active)
 values ('e0000000-0000-0000-0000-00000000000a', :'trainerA', :'orgA', 'Trainer A', 'ta@a.test', '1', 'Instructor', 'fulltime', 'other', 'TA-1', true),
        ('e0000000-0000-0000-0000-00000000000b', null, :'orgB', 'Trainer B', 'tb@b.test', '2', 'Instructor', 'fulltime', 'other', 'TB-1', true);
insert into fee_records (id, trainee_id, organization_id, total_fee, academic_year) values
 ('f1000000-0000-0000-0000-00000000000a', :'T1', :'orgA', 1000, '2026');
insert into trades (id, name, code, organization_id) values ('c1000000-0000-0000-0000-00000000000b', 'B-only trade', 'BT', :'orgB'), ('c1000000-0000-0000-0000-00000000000c', 'Shared trade', 'ST', null);
insert into messages (sender_id, receiver_id, subject, message, organization_id) values (:'trainerA', :'tr1', 'private', 'hello', :'orgA');

-- ===== helper facts =====
select public.assert(public.is_org_admin_only(:'adminA') and public.is_org_admin_only(:'adminB'), 'centre admins are recognised');
select public.assert(not public.is_org_admin_only(:'sa') and not public.is_org_admin_only(:'trainerA'), 'super admins and staff are not centre-admin-only');

-- ===== centre confinement =====
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert((select count(*) from trainers where organization_id = :'orgA') = 1, 'a centre admin sees their own centre''s trainers');
select public.assert((select count(*) from trainers where organization_id = :'orgB') = 0, 'a centre admin cannot see another centre''s trainers');
select public.assert((select count(*) from trades where organization_id = :'orgB') = 0, 'a centre admin cannot see another centre''s trades');
select public.assert(exists (select 1 from trades where name = 'Shared trade'), 'shared (no-centre) rows stay visible');
update trainers set designation = 'Hacked' where organization_id = :'orgB';
update trades set name = 'Hacked' where organization_id is null;
reset role;
select public.assert((select designation from trainers where organization_id = :'orgB') = 'Instructor', 'another centre''s trainer is untouched');
select public.assert((select count(*) from trades where name = 'Hacked') = 0 and (select name from trades where code = 'ST') = 'Shared trade', 'a centre admin cannot edit shared rows');

-- ===== privacy =====
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert((select count(*) from messages) = 0, 'a centre admin cannot read other people''s messages');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from messages) = 1, 'the sender still reads their own message');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert((select count(*) from trainers) = 2, 'a super admin still sees every centre');
reset role;

-- ===== finance is read-only for a centre admin until an override starts =====
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert((select count(*) from fee_records) = 1, 'a centre admin can read fee records');
select public.expect_error($$insert into fee_records (trainee_id, organization_id, total_fee, academic_year) values ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a', 50, '2027')$$, 'row-level security', 'a centre admin cannot add a fee record without an override');
update fee_records set total_fee = 1 where id = 'f1000000-0000-0000-0000-00000000000a';
reset role;
select public.assert((select total_fee from fee_records where id = 'f1000000-0000-0000-0000-00000000000a') = 1000, 'a centre admin cannot change a fee without an override');
set role authenticated; select set_config('request.jwt.claim.sub', :'debtor', false);
update fee_records set total_fee = 1200 where id = 'f1000000-0000-0000-0000-00000000000a';
reset role;
select public.assert((select total_fee from fee_records where id = 'f1000000-0000-0000-0000-00000000000a') = 1200, 'the debtor officer can still change fees');

-- ===== override =====
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
-- the administrator cannot start an override any more (finance and grades are not part of the IT administrator role)
select public.expect_error($$select public.start_admin_override('Fixing a wrong fee for trainee 1', 30)$$, 'not part of the Organization Admin role', 'an administrator cannot start an override');
reset role;
-- the gate itself still honours an override that exists (simulated here as a legacy row)
insert into admin_overrides (user_id, organization_id, reason, expires_at) values (:'adminA', 'a0000000-0000-0000-0000-00000000000a', 'Legacy override for the gate test', now() + interval '30 minutes');
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert(public.has_active_admin_override(:'adminA'), 'the override is active');
update fee_records set total_fee = 900 where id = 'f1000000-0000-0000-0000-00000000000a';
reset role;
select public.assert((select total_fee from fee_records where id = 'f1000000-0000-0000-0000-00000000000a') = 900, 'inside an override the centre admin can change a fee');
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert((select count(*) from admin_overrides where user_id = :'adminA') = 1, 'a centre admin sees their own override');
select set_config('request.jwt.claim.sub', :'debtor', false);
select public.expect_error($$select public.start_admin_override('I am not an admin at all', 30)$$, 'not part of the Organization Admin role', 'nobody else can start an override either');
select public.assert((select count(*) from admin_overrides) = 0, 'other staff cannot see overrides');
select set_config('request.jwt.claim.sub', :'adminA', false);
select public.end_admin_override();
select public.assert(not public.has_active_admin_override(:'adminA'), 'ending the override takes effect');
update fee_records set total_fee = 5 where id = 'f1000000-0000-0000-0000-00000000000a';
reset role;
select public.assert((select total_fee from fee_records where id = 'f1000000-0000-0000-0000-00000000000a') = 900, 'writes are blocked again after the override ends');
-- an expired override does not count
update admin_overrides set expires_at = now() - interval '1 minute', ended_at = null;
select public.assert(not public.has_active_admin_override(:'adminA'), 'an expired override does not count');

-- ===== audit trail =====
select public.assert((select count(*) from admin_audit_log where action = 'override.started') = 0 and (select count(*) from admin_audit_log where action = 'override.ended') = 1, 'ending an override is logged (none can be started any more)');
select public.assert((select count(*) from admin_audit_log where action = 'fee_records.update' and actor_id = :'adminA') = 1, 'the admin''s fee change is logged once (the blocked attempts are not)');
select public.assert((select (details->'changes'->'total_fee'->>'to')::numeric from admin_audit_log where action = 'fee_records.update') = 900, 'the log records what changed');
select public.assert((select (details->>'override')::boolean from admin_audit_log where action = 'fee_records.update'), 'the log says it was done under an override');
select public.assert((select count(*) from admin_audit_log where actor_id = :'debtor') = 0, 'other staff are not logged');
select public.expect_error($$update admin_audit_log set action = 'x'$$, 'cannot be changed', 'the audit log cannot be edited');
select public.expect_error($$delete from admin_audit_log$$, 'cannot be changed', 'the audit log cannot be deleted');
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert((select count(*) from admin_audit_log) >= 2, 'a centre admin reads their audit log');
select public.expect_error($$insert into admin_audit_log (action, entity) values ('forged', 'x')$$, 'permission denied|row-level security', 'clients cannot write audit entries');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from admin_audit_log where organization_id = 'a0000000-0000-0000-0000-00000000000a') = 0, 'another centre''s admin cannot read this audit log');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from admin_audit_log) = 0, 'other staff cannot read the audit log');
reset role;

-- ===== only super admins grant admin roles =====
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.expect_error($$insert into user_roles (user_id, role, organization_id) values ('11111111-0000-0000-0000-000000000008','organization_admin','a0000000-0000-0000-0000-00000000000a')$$, 'super admin', 'a centre admin cannot grant Organization Admin');
select public.expect_error($$update user_roles set role = 'organization_admin' where user_id = '11111111-0000-0000-0000-000000000004'$$, 'super admin', 'a centre admin cannot promote someone');
select public.expect_error($$delete from user_roles where user_id = '11111111-0000-0000-0000-000000000001'$$, 'super admin', 'a centre admin cannot remove an admin role');
insert into user_roles (user_id, role, organization_id) values ('11111111-0000-0000-0000-000000000008','librarian','a0000000-0000-0000-0000-00000000000a');
select public.assert((select count(*) from user_roles where user_id = '11111111-0000-0000-0000-000000000008' and role = 'librarian') = 1, 'a centre admin can still assign ordinary roles');
select set_config('request.jwt.claim.sub', :'sa', false);
update user_roles set role = 'organization_admin' where user_id = '11111111-0000-0000-0000-000000000008' and role = 'librarian';
select public.assert((select count(*) from user_roles where user_id = '11111111-0000-0000-0000-000000000008' and role = 'organization_admin') = 1, 'a super admin can grant Organization Admin');
reset role;
select public.assert((select count(*) from admin_audit_log where action like 'user_roles.%') >= 1, 'role changes are logged');

-- ===== shared reference data =====
set role authenticated; select set_config('request.jwt.claim.sub', :'adminA', false);
select public.expect_error($$insert into unit_standards (unit_no, module_title, level, credit) values ('US-X', 'Nope', 1, 1)$$, 'row-level security', 'a centre admin cannot add shared unit standards');
select set_config('request.jwt.claim.sub', :'sa', false);
insert into unit_standards (unit_no, module_title, level, credit) values ('US-OK', 'Fine', 1, 1);
select public.assert((select count(*) from unit_standards where unit_no = 'US-OK') = 1, 'a super admin can');
reset role;
select 'OK all admin scope, audit and override checks';
