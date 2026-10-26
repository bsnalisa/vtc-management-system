-- A caller can ask the role helpers only about themselves; internal callers and the service role are unchanged.
\set ON_ERROR_STOP on
\set adm '97777777-0000-0000-0000-000000000001'
\set plain '97777777-0000-0000-0000-000000000002'
\set adm_org 'a0000000-0000-0000-0000-00000000000a'
insert into auth.users (id,email) values (:'adm','enum-admin@a.test'),(:'plain','enum-plain@a.test') on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '97777777%' on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'adm','organization_admin',:'adm_org'),(:'plain','registration_officer',:'adm_org');
alter table user_roles enable trigger trg_guard_privileged_roles;
select public.assert(public.has_role(:'adm', 'organization_admin') and public.has_org_role(:'adm', :'adm_org', array['organization_admin']), 'the database owner (trusted internal context) sees the real answer');

-- anonymous: the guarded functions are closed
set role anon;
select public.expect_error(format('select public.has_role(%L, ''organization_admin'')', :'adm'), 'permission denied', 'anonymous callers cannot call has_role');
select public.expect_error(format('select public.is_super_admin(%L)', :'adm'), 'permission denied', 'anonymous callers cannot call is_super_admin');
reset role;

-- signed in as someone else: other people's roles are not revealed, one's own are
set role authenticated; select set_config('request.jwt.claim.sub', :'plain', false);
select public.assert(not public.has_role(:'adm', 'organization_admin'), 'a signed-in user cannot ask whether another user is an organization admin');
select public.assert(not public.has_org_role(:'adm', :'adm_org', array['organization_admin']), 'nor ask has_org_role about another user');
select public.assert(not public.is_admin(:'adm') and public.get_user_organization(:'adm') is null, 'nor is_admin or get_user_organization');
select public.assert(public.get_user_organization(:'plain') is not null, 'but can ask about themselves');
reset role;
select set_config('request.jwt.claim.sub', :'adm', false);
set role authenticated;
select public.assert(public.has_role(:'adm', 'organization_admin') and public.has_org_role(:'adm', :'adm_org', array['organization_admin']), 'an organization admin still sees their own roles');
reset role;

-- the service role (edge functions) may ask about anyone
set role service_role;
select public.assert(public.has_role(:'adm', 'organization_admin'), 'the service role may ask about any user');
reset role;

-- a function that calls the helper by name from inside the database still gets the real answer for the user it was given
select public.assert((select public.is_finance_staff(:'adm', :'adm_org')) is not null, 'composed helpers keep working internally');

-- policies still use the original helpers, now in the private schema
select public.assert(exists (select 1 from pg_depend d join pg_policy pol on d.classid = 'pg_policy'::regclass and d.objid = pol.oid
                              join pg_proc p on d.refclassid = 'pg_proc'::regclass and d.refobjid = p.oid join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'private' and p.proname = 'has_role'), 'policies keep using the original helper');
select 'OK role helpers answer only about the caller';
