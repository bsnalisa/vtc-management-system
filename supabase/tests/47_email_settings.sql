\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set oa '98400000-0000-0000-0000-000000000001'
\set oab '98400000-0000-0000-0000-000000000002'
\set po '98400000-0000-0000-0000-000000000003'
\set sa '98400000-0000-0000-0000-000000000004'

-- a minimal stand-in for Supabase Vault (the real one is not part of the local test database)
create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
create or replace view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create or replace function vault.create_secret(_secret text, _name text, _desc text default null) returns uuid language sql as $$ insert into vault.secrets (secret, name, description) values (_secret, _name, _desc) returning id $$;
create or replace function vault.update_secret(_id uuid, _secret text) returns void language sql as $$ update vault.secrets set secret = _secret where id = _id $$;

insert into auth.users (id,email) values (:'oa','oa@a.test'),(:'oab','oab@b.test'),(:'po','po@a.test'),(:'sa','sa@x.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '98400000%' on conflict (user_id) do update set full_name = excluded.full_name;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'oa','organization_admin',:'orgA'),(:'oab','organization_admin',:'orgB'),(:'po','procurement_officer',:'orgA'),(:'sa','super_admin',null);
alter table user_roles enable trigger trg_guard_privileged_roles;

-- the Organization Admin sees status only; nobody else sees anything; the Super Admin sets everything up
set role authenticated; select set_config('request.jwt.claim.sub', :'po', false);
select public.expect_error($$select public.email_settings_get('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'a procurement officer cannot read email settings');
select set_config('request.jwt.claim.sub', :'oab', false);
select public.expect_error($$select public.email_settings_get('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'nor another centre''s administrator');
select set_config('request.jwt.claim.sub', :'oa', false);
select public.expect_error($$select public.email_connection_save(null,'NTA','contoso.onmicrosoft.com','11111111-1111-1111-1111-111111111111','secret-value-123')$$, 'Only the Super Admin', 'the Organization Admin cannot create a connection');
select public.expect_error($$select public.email_connections_list()$$, 'Only the Super Admin', 'nor list connections');
select public.expect_error($$select public.email_settings_centres()$$, 'Only the Super Admin', 'nor list every centre');
select public.assert((public.email_settings_get(:'orgA') ->> 'configured')::boolean = false and not (public.email_settings_get(:'orgA') ->> 'can_edit')::boolean, 'a new centre has no email settings and the Organization Admin cannot edit');

-- connections: validation
select set_config('request.jwt.claim.sub', :'sa', false);
select public.expect_error($$select public.email_connection_save(null,'NTA','nope','11111111-1111-1111-1111-111111111111','secret-value-123')$$, 'tenant', 'a bad tenant is refused');
select public.expect_error($$select public.email_connection_save(null,'NTA','contoso.onmicrosoft.com','not-a-guid','secret-value-123')$$, 'client', 'a bad client id is refused');
select public.expect_error($$select public.email_connection_save(null,'NTA','contoso.onmicrosoft.com','11111111-1111-1111-1111-111111111111',null)$$, 'client secret', 'a new connection needs a secret');
select public.expect_error($$select public.email_connection_save(null,'NTA','contoso.onmicrosoft.com','11111111-1111-1111-1111-111111111111','short')$$, 'too short', 'a short secret is refused');

-- the shared NTA connection, and a VTC that already has its own tenant
select public.email_connection_save(null,'NTA Microsoft 365','contoso.onmicrosoft.com','11111111-1111-1111-1111-111111111111','secret-value-123') as nta \gset
select public.email_connection_save(null,'Valombola own tenant','fabrikam.onmicrosoft.com','22222222-2222-2222-2222-222222222222','another-secret-1') as own \gset
select public.expect_error($$select public.email_connection_save(null,'nta microsoft 365','contoso.onmicrosoft.com','11111111-1111-1111-1111-111111111111','secret-value-123')$$, 'already exists', 'connection names are unique');
select public.assert(jsonb_array_length(public.email_connections_list()) = 2 and public.email_connections_list()::text not like '%secret-value-123%' and public.email_connections_list()::text not like '%another-secret-1%', 'connections are listed without their secrets');
select public.assert(not exists (select 1 from information_schema.columns where table_name in ('email_settings', 'email_connections') and column_name like '%secret' and column_name <> 'secret_saved_at'), 'no table has a secret column');

-- centre settings: validation, then a centre on the shared connection
select public.expect_error(format($$select public.email_settings_save('a0000000-0000-0000-0000-00000000000a', %L, 'not a domain', 'no-reply@a.test', null, null, false)$$, :'nta'), 'domain', 'a bad domain is refused');
select public.expect_error(format($$select public.email_settings_save('a0000000-0000-0000-0000-00000000000a', %L, 'a.test', 'not-an-address', null, null, false)$$, :'nta'), 'mailbox', 'a bad sender is refused');
select public.expect_error(format($$select public.email_settings_save('a0000000-0000-0000-0000-00000000000a', %L, 'a.test', 'no-reply@other.test', null, null, false)$$, :'nta'), 'own domain', 'the sender must be on the centre''s own domain');
select public.expect_error($$select public.email_settings_save('a0000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'a.test', 'no-reply@a.test', null, null, false)$$, 'connection', 'an unknown connection is refused');
select public.email_settings_save(:'orgA', :'nta', 'A.test', 'No-Reply@A.test', 'Nakayale VTC', null, false);
select public.assert((select sender_address = 'no-reply@a.test' and email_domain = 'a.test' and not enabled and connection_id = :'nta'::uuid from email_settings where organization_id = :'orgA'), 'the domain and sender are normalised, the centre uses the shared connection and email starts off');
select public.expect_error(format($$select public.email_settings_save('a0000000-0000-0000-0000-00000000000a', %L, 'a.test', 'no-reply@a.test', null, null, true)$$, :'nta'), 'successful test', 'email cannot be switched on before a successful test');
select public.expect_error($$select private.email_secret_get(gen_random_uuid())$$, 'permission denied', 'not even the Super Admin can call the secret reader');
select public.expect_error($$select public.email_settings_credentials('a0000000-0000-0000-0000-00000000000a')$$, 'permission denied|Not authorised', 'nor read the credentials');
select public.assert(not exists (select 1 from email_settings where enabled), 'no direct write changed anything');

-- a second centre on its own tenant; a domain belongs to one centre
select public.email_settings_save('b0000000-0000-0000-0000-00000000000b', :'own', 'b.test', 'no-reply@b.test', 'Valombola VTC', null, false);
select public.expect_error(format($$select public.email_settings_save('b0000000-0000-0000-0000-00000000000b', %L, 'a.test', 'no-reply@a.test', null, null, false)$$, :'own'), 'already uses', 'two centres cannot share a domain');
select public.assert((select bool_and((c ->> 'configured')::boolean) from jsonb_array_elements(public.email_settings_centres()) c where c ->> 'name' in (select name from organizations where id in (:'orgA', 'b0000000-0000-0000-0000-00000000000b'))), 'the Super Admin sees every centre and its status');
select public.expect_error(format($$select public.email_connection_delete(%L)$$, :'own'), 'still use', 'a connection in use cannot be removed');

-- the dispatcher (service role) reads each centre's own connection credentials and records the test
reset role; select set_config('request.jwt.claim.role', 'service_role', false);
select public.assert(public.email_settings_credentials(:'orgA') ->> 'client_secret' = 'secret-value-123' and public.email_settings_credentials('b0000000-0000-0000-0000-00000000000b') ->> 'client_secret' = 'another-secret-1'
  and public.email_settings_credentials('b0000000-0000-0000-0000-00000000000b') ->> 'tenant_id' = 'fabrikam.onmicrosoft.com', 'each centre gets its own connection''s credentials');
select public.email_settings_record_test(:'orgA', false, 'AADSTS7000215 bad secret', 'sa@x.test', :'sa');
select public.assert((select last_test_ok = false and not enabled from email_settings where organization_id = :'orgA'), 'a failed test is recorded');
select public.email_settings_record_test(:'orgA', true, null, 'sa@x.test', :'sa');
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated; select set_config('request.jwt.claim.sub', :'oa', false);
select public.assert((public.email_settings_get(:'orgA') -> 'settings' ->> 'last_test_ok')::boolean and public.email_settings_get(:'orgA') -> 'settings' ->> 'connection_id' is null and public.email_settings_get(:'orgA')::text not like '%contoso%', 'the Organization Admin sees the test result but not the connection');

-- switched on after a test; any change to the mailbox, domain, connection or the connection's credentials switches it off again
select set_config('request.jwt.claim.sub', :'sa', false);
select public.email_settings_save(:'orgA', :'nta', 'a.test', 'no-reply@a.test', 'Nakayale VTC', 'help@a.test', true);
select public.assert((select enabled from email_settings where organization_id = :'orgA'), 'email is on after a successful test');
select public.email_settings_save(:'orgA', :'nta', 'a.test', 'other@a.test', 'Nakayale VTC', 'help@a.test', true);
select public.assert((select not enabled and last_test_ok is null from email_settings where organization_id = :'orgA'), 'changing the mailbox switches email off and clears the test');
reset role; select set_config('request.jwt.claim.role', 'service_role', false);
select public.email_settings_record_test(:'orgA', true, null, 'sa@x.test', :'sa');
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.email_settings_save(:'orgA', :'nta', 'a.test', 'other@a.test', 'Nakayale VTC', null, true);
select public.assert((select enabled from email_settings where organization_id = :'orgA'), 'on again after the test');
select public.email_connection_save(:'nta', 'NTA Microsoft 365', 'contoso.onmicrosoft.com', '11111111-1111-1111-1111-111111111111', 'new-secret-456');
select public.assert((select not enabled and last_test_ok is null from email_settings where organization_id = :'orgA'), 'replacing the connection''s secret switches off every centre that uses it');
select public.email_connection_save(:'nta', 'NTA Microsoft 365', 'contoso.onmicrosoft.com', '11111111-1111-1111-1111-111111111111', null);
reset role; select set_config('request.jwt.claim.role', 'service_role', false);
select public.assert(public.email_settings_credentials(:'orgA') ->> 'client_secret' = 'new-secret-456', 'the new secret is the one stored, and saving without one keeps it');
select set_config('request.jwt.claim.role', 'authenticated', false);

-- the Organization Admin may put its own centre's failed messages back in the queue, and no one else's
insert into outbound_messages (organization_id, channel, recipient, subject, body, status, attempts, error) values (:'orgA', 'email', 'x@a.test', 's', 'b', 'failed', 3, 'x');
set role authenticated; select set_config('request.jwt.claim.sub', :'oab', false);
select public.expect_error($$select public.email_requeue_failed('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'another centre''s administrator cannot requeue');
select set_config('request.jwt.claim.sub', :'oa', false);
select public.assert(public.email_requeue_failed(:'orgA') = 1, 'a failed message is requeued');
select public.assert((public.email_settings_get(:'orgA') -> 'queue' ->> 'queued')::int >= 1, 'the queue summary counts it');
select set_config('request.jwt.claim.sub', :'oab', false);
select public.assert((select count(*) from email_settings) = 0 and (select count(*) from email_events) = 0 and (select count(*) from email_connections) = 0, 'no administrator reads the settings tables directly');

-- removing an unused connection
select set_config('request.jwt.claim.sub', :'sa', false);
select public.email_connection_save(null,'Spare','spare.onmicrosoft.com','33333333-3333-3333-3333-333333333333','spare-secret-1') as spare \gset
select public.email_connection_delete(:'spare');
select public.assert(jsonb_array_length(public.email_connections_list()) = 2, 'an unused connection can be removed');

-- the job secret check
reset role; select set_config('request.jwt.claim.role', 'service_role', false);
insert into vault.secrets (name, secret) values ('vms_dispatch_secret', 'job-secret') on conflict (name) do update set secret = excluded.secret;
select public.assert(public.verify_dispatch_secret('job-secret') and not public.verify_dispatch_secret('wrong') and not public.verify_dispatch_secret(''), 'only the stored job secret is accepted');
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.assert((select count(*) from email_events where organization_id = :'orgA') >= 6 and (select count(*) from email_events where organization_id is null) >= 3, 'every step is logged');
select public.expect_error($$update email_events set note = 'x'$$, 'can never be changed', 'the log is append-only');
