-- The IT administrator reads but does not write academic records, and the dashboard reports whether message delivery is set up.
\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set adm '99999999-0000-0000-0000-000000000001'
\set hot '99999999-0000-0000-0000-000000000002'
insert into auth.users (id,email) values (:'adm','bounds-admin@a.test'),(:'hot','bounds-hot@a.test') on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '99999999%' on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'adm','organization_admin',:'orgA'),(:'hot','head_of_training',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;

-- every listed table carries the three restrictive policies
select public.assert((select count(*) from pg_policy where not polpermissive and polname like 'IT administrators do not change academic records%') = 63, 'insert, update and delete are closed to the IT administrator on the 21 academic tables');

-- the check itself
set role authenticated; select set_config('request.jwt.claim.sub', :'adm', false);
select public.assert(not public.not_it_admin(), 'the administrator is recognised');
select set_config('request.jwt.claim.sub', :'hot', false);
select public.assert(public.not_it_admin(), 'the Head of Training is not restricted');
reset role;
select public.assert(public.not_it_admin(), 'database functions and the service role are not restricted');

-- behaviour: an organisation's own trade
insert into trades (id, name, code, organization_id) values ('c0000000-0000-0000-0000-0000000000b1', 'Bounds Trade', 'BNDT', :'orgA');
set role authenticated; select set_config('request.jwt.claim.sub', :'adm', false);
select public.assert((select count(*) from trades where id = 'c0000000-0000-0000-0000-0000000000b1') = 1, 'the administrator can still read it');
update trades set name = 'Changed by admin' where id = 'c0000000-0000-0000-0000-0000000000b1';
delete from trades where id = 'c0000000-0000-0000-0000-0000000000b1';
select public.expect_error($$insert into trades (name, code, organization_id) values ('Admin trade', 'ADMT', 'a0000000-0000-0000-0000-00000000000a')$$, 'row-level security', 'the administrator cannot add a trade');
reset role;
select public.assert((select name from trades where id = 'c0000000-0000-0000-0000-0000000000b1') = 'Bounds Trade', 'the administrator could neither change nor delete the trade');

-- centre set-up the role still owns is untouched
set role authenticated; select set_config('request.jwt.claim.sub', :'adm', false);
select public.assert(public.has_org_role(:'adm', :'orgA', array['organization_admin']), 'the administrator keeps their role');
reset role;

-- message delivery state is reported (Vault is not set up in the test database)
select public.assert(not public.message_delivery_configured(), 'delivery is reported as not set up when the Vault settings are missing');
set role authenticated; select set_config('request.jwt.claim.sub', :'adm', false);
select public.assert((it_dashboard()->'system'->>'delivery_configured')::boolean = false and (it_dashboard()->'system'->>'messages_sent_7d')::int = 0, 'the dashboard carries the delivery state and the number sent this week');
select public.assert((it_system_status()->'counts') ? 'delivery_configured', 'the diagnostics page carries it too');
reset role;
select 'OK IT administrator boundaries and delivery state';
