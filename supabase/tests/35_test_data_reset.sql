\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set sa '97777777-0000-0000-0000-000000000001'
\set trT '97777777-0000-0000-0000-000000000002'
\set trR '97777777-0000-0000-0000-000000000003'
\set stT '97777777-0000-0000-0000-000000000004'
\set stR '97777777-0000-0000-0000-000000000005'

insert into auth.users (id,email) values (:'sa','sa@x.test'),(:'trT','tt@a.test'),(:'trR','tr@a.test'),(:'stT','reg@vms-test.example'),(:'stR','real@a.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '97777777%' on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'sa','super_admin',null),(:'trT','trainee',:'orgA'),(:'trR','trainee',:'orgA'),(:'stT','registration_officer',:'orgA'),(:'stR','registration_officer',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;

select set_config('app.legacy_import', 'off', false);
insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,user_id,status) values
 (:'orgA','Tina','Testing','female','2001-02-03','NAT-RESET-T','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x',:'trT','active'),
 (:'orgA','Rita','Real','female','2001-02-04','NAT-RESET-R','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x',:'trR','active');
select trainee_id as tno from trainees where national_id = 'NAT-RESET-T' \gset
select trainee_id as rno from trainees where national_id = 'NAT-RESET-R' \gset
insert into fee_records (trainee_id, total_fee, amount_paid, academic_year, organization_id) select id, 1000, 0, '2026', :'orgA' from trainees where national_id in ('NAT-RESET-T','NAT-RESET-R');
insert into outbound_messages (organization_id, channel, recipient, subject, body) values (:'orgA','email','tt@a.test','s','b'),(:'orgA','email','x@vms-test.example','s','b'),(:'orgA','email','tr@a.test','s','b');

insert into admin_audit_log (organization_id, actor_id, action, entity, entity_id, summary) select :'orgA', :'stR', 'trainee.updated', 'trainees', id::text, 'edited a test trainee' from trainees where national_id = 'NAT-RESET-T';
insert into admin_audit_log (organization_id, actor_id, action, entity, entity_id, summary) values (:'orgA', :'stT', 'x.did', 'things', 'abc', 'by a test login'), (:'orgA', :'stR', 'x.did', 'things', 'abc', 'by a real login');
insert into storage.objects (bucket_id, name, owner) values ('organization-logos', 'test/logo.png', :'stT'), ('organization-logos', 'real/logo.png', :'stR');

set role authenticated; select set_config('request.jwt.claim.sub', :'stR', false);
select public.expect_error($$select public.reset_test_data(true, false)$$, 'Only the Super Admin', 'staff cannot run the reset');
select public.expect_error($$select public.mark_test_identities(array['1'])$$, 'Only the Super Admin', 'staff cannot mark test trainees');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert(public.mark_test_identities(array[:'tno']) = 1, 'the Super Admin marks a test trainee');
select public.assert((select count(*) from public.list_test_identities()) = 1 and (select trainee_number from public.list_test_identities()) = :'tno', 'the list shows the marked trainee');

-- preview changes nothing
select public.assert((public.reset_test_data(true, false) ->> 'identities')::int = 1 and (public.reset_test_data(true, false) -> 'rows' ->> 'trainees')::int = 1, 'the preview counts the test trainee');
reset role;
select public.assert((select count(*) from trainees where national_id = 'NAT-RESET-T') = 1 and (select count(*) from auth.users where id = '97777777-0000-0000-0000-000000000002') = 1, 'a preview removes nothing');
select public.assert((select setting from pg_settings where name = 'session_replication_role') = 'origin', 'triggers are back on after a preview');

-- real run, trainees only
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.reset_test_data(false, false);
reset role;
select public.assert((select count(*) from trainees where national_id = 'NAT-RESET-T') = 0, 'the test trainee is gone');
select public.assert((select count(*) from fee_records where trainee_id not in (select id from trainees)) = 0 and (select count(*) from fee_records f join trainees t on t.id = f.trainee_id where t.national_id = 'NAT-RESET-R') = 1, 'their fee records went, the real trainee''s stayed');
select public.assert((select count(*) from auth.users where id = '97777777-0000-0000-0000-000000000002') = 0 and (select count(*) from user_roles where user_id = '97777777-0000-0000-0000-000000000002') = 0 and (select count(*) from profiles where user_id = '97777777-0000-0000-0000-000000000002') = 0, 'the login, role and profile are gone');
select public.assert((select count(*) from admin_audit_log where summary = 'edited a test trainee') = 0, 'log entries about the removed trainee are gone');
select public.assert((select count(*) from trainee_number_ledger where number = :'tno') = 0 and (select count(*) from trainee_identities where trainee_number = :'tno') = 0, 'the identity and its number are removed');
select public.assert((select count(*) from trainees where national_id = 'NAT-RESET-R') = 1 and (select count(*) from trainee_identities where trainee_number = :'rno') = 1 and (select count(*) from auth.users where id = '97777777-0000-0000-0000-000000000003') = 1, 'the real trainee, identity and login are untouched');
select public.assert((select count(*) from auth.users where id = '97777777-0000-0000-0000-000000000004') = 1, 'staff logins stay unless asked for');
select public.assert((select count(*) from outbound_messages where recipient = 'tt@a.test') = 0 and (select count(*) from outbound_messages where recipient = 'tr@a.test') = 1, 'queued messages to test people are removed');
select public.assert((select count(*) from test_data_purges) = 1, 'the run is logged');
select public.expect_error($$delete from test_data_purges$$, 'never be changed', 'the log cannot be erased');
select public.assert((select setting from pg_settings where name = 'session_replication_role') = 'origin', 'triggers are back on after a run');

-- staff arm
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.reset_test_data(false, true);
reset role;
select public.assert((select count(*) from auth.users where id = '97777777-0000-0000-0000-000000000004') = 0 and (select count(*) from user_roles where user_id = '97777777-0000-0000-0000-000000000004') = 0, 'test staff logins are removed on request');
select public.assert((select count(*) from auth.users where id in ('97777777-0000-0000-0000-000000000001','97777777-0000-0000-0000-000000000005','97777777-0000-0000-0000-000000000003')) = 3, 'the Super Admin and real logins stay');
select public.assert((select count(*) from admin_audit_log where summary = 'by a test login') = 0 and (select count(*) from admin_audit_log where summary = 'by a real login') = 1, 'actions by test logins are removed, real ones stay');
select public.assert((select count(*) from test_storage_queue where name = 'test/logo.png') = 1 and (select count(*) from test_storage_queue where name = 'real/logo.png') = 0, 'files uploaded by test logins are queued for removal');
select public.assert((select count(*) from outbound_messages where recipient = 'x@vms-test.example') = 0, 'messages to the test domain are removed');

-- the test number is free again, a numbered TEST- identity is marked on its own
insert into trainee_identities (trainee_number, number_format, first_registration_year) values ('TEST-AUTO-01', 'legacy', 2026);
select public.assert((select is_test from trainee_identities where trainee_number = 'TEST-AUTO-01'), 'a TEST- number is marked as a test identity automatically');
select 'OK test data reset';
