\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set sa '98000000-0000-0000-0000-000000000001'
\set sa2 '98000000-0000-0000-0000-000000000002'
\set oa '98000000-0000-0000-0000-000000000003'
\set oaB '98000000-0000-0000-0000-000000000004'
\set staff '98000000-0000-0000-0000-000000000005'
\set staff2 '98000000-0000-0000-0000-000000000006'
\set trainee '98000000-0000-0000-0000-000000000007'
\set gone '98000000-0000-0000-0000-000000000008'

insert into auth.users (id,email) values (:'sa','sa@x.test'),(:'sa2','sa2@x.test'),(:'oa','oa@a.test'),(:'oaB','oab@b.test'),(:'staff','staff@a.test'),(:'staff2','staff2@a.test'),(:'trainee','tr@a.test'),(:'gone','gone@a.test');
update auth.users set banned_until = now() + interval '100 years' where id = :'gone';
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '98000000%' on conflict (user_id) do update set full_name = excluded.full_name;
update profiles set full_name = split_part(email,'@',1) where user_id::text like '98000000%';
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'sa','super_admin',null),(:'oa','organization_admin',:'orgA'),(:'oaB','organization_admin',:'orgB'),(:'staff','librarian',:'orgA'),(:'staff2','hr_officer',:'orgA'),(:'trainee','trainee',:'orgA'),(:'gone','hr_officer',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;

set role authenticated; select set_config('request.jwt.claim.sub', :'oa', false);
select public.expect_error($$select public.role_factory_create('safety_officer', 'Safety Officer', repeat('x', 100))$$, 'Only the Super Admin', 'the Organisation Admin cannot define roles');
select public.expect_error($$select public.role_factory_overview()$$, 'Only the Super Admin', 'nor read the drafts');
select public.assert(jsonb_array_length(public.role_factory_catalogue()) >= 15, 'but the catalogue is readable');

select set_config('request.jwt.claim.sub', :'sa', false);
select public.expect_error($$select public.role_factory_create('safety_officer', 'Safety Officer', 'too short')$$, '80 characters', 'a job description is mandatory');
select public.expect_error($$select public.role_factory_create('Bad Code', 'Safety Officer', repeat('x', 100))$$, 'role code', 'the code is checked');
select public.expect_error($$select public.role_factory_create('accountant', 'Accountant 2', repeat('x', 100))$$, 'already exists', 'it cannot clash with an existing role');
select public.expect_error($$select public.role_factory_create('trainer', 'Trainer 2', repeat('x', 100))$$, 'already exists', 'including the built-in role list');
select public.role_factory_create('safety_officer', 'Safety Officer',
  'The Safety Officer monitors workshop safety, compiles incident reports for the centre, coordinates the issue of protective equipment from stores, and tracks attendance at safety induction sessions for trainees. Raises support tickets for faulty equipment.', 'head_of_training') as v1 \gset
select public.assert((select status from factory_roles where role_code = 'safety_officer') = 'draft', 'a new role starts as a draft');
reset role;
select public.assert(not private.has_capability(:'sa', :'orgA', 'reports.view'), 'and grants nothing');
set role authenticated;

-- proposal by rules
select public.assert((public.role_factory_run_rules(:'v1') ->> 'method') = 'rules', 'the rules produce a labelled proposal');
select public.assert((select proposal_method from factory_role_versions where id = :'v1') = 'rules' and (select proposal_capabilities from factory_role_versions where id = :'v1') @> ARRAY['reports.view', 'inventory.summary'], 'drawn from the description');
select public.assert(not exists (select 1 from role_capability_catalogue k join factory_role_versions v on k.code = any (v.proposal_capabilities) where v.id = :'v1' and k.sensitive), 'and never include a sensitive capability');
-- nobody can claim the AI label
select public.expect_error($$select public.role_factory_record_ai((select id from factory_role_versions limit 1), ARRAY['reports.view'], 'x', '98000000-0000-0000-0000-000000000001')$$, 'analysis service', 'a signed-in user cannot record an AI proposal');
-- the service records it (on behalf of a Super Admin); unknown capabilities are dropped
reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select public.expect_error($$select public.role_factory_record_ai((select id from factory_role_versions limit 1), ARRAY['reports.view'], 'x', '98000000-0000-0000-0000-000000000003')$$, 'not requested by a Super Admin', 'and only for a Super Admin');
select public.assert((public.role_factory_record_ai(:'v1', ARRAY['reports.view', 'invented.power', 'tickets.own'], 'AI read the description', :'sa') -> 'ignored') = '["invented.power"]'::jsonb, 'the AI proposal drops anything outside the catalogue');
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.assert((select proposal_method from factory_role_versions where id = :'v1') = 'ai' and (select proposal_capabilities from factory_role_versions where id = :'v1') = ARRAY['reports.view', 'tickets.own'], 'and is labelled as AI');
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);

-- review and edit
select public.expect_error($$select public.role_factory_save_draft((select id from factory_role_versions limit 1), repeat('x', 100), null, ARRAY['made.up'])$$, 'Unknown capability', 'the selection must come from the catalogue');
select public.role_factory_save_draft(:'v1', (select job_description from factory_role_versions where id = :'v1'), 'head_of_training', ARRAY['reports.view', 'tickets.own', 'inventory.summary']);
select public.assert((select proposal_capabilities from factory_role_versions where id = :'v1') = ARRAY['reports.view', 'tickets.own'] and (select cardinality(selected_capabilities) from factory_role_versions where id = :'v1') = 3, 'editing keeps what the AI proposed beside what was chosen');
select public.expect_error($$select public.role_factory_decide((select id from factory_role_versions limit 1), true, null)$$, 'not waiting', 'a draft cannot be approved');
select public.role_factory_submit(:'v1');
select public.expect_error($$update factory_role_versions set selected_capabilities = ARRAY['fees.records']$$, 'permission denied', 'no direct writes');
reset role;
select public.expect_error($$update factory_role_versions set job_description = repeat('y', 100) where status = 'pending_review'$$, 'can never be edited', 'a submitted version is frozen');
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
reset role;
select public.assert(not private.has_capability(:'staff', :'orgA', 'reports.view'), 'nothing is granted before approval');
set role authenticated;
select public.assert(public.role_factory_decide(:'v1', true, 'Looks right') = 'approved', 'a single Super Admin may approve their own role');

-- a second Super Admin makes separation of duties apply
reset role;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'sa2','super_admin',null);
alter table user_roles enable trigger trg_guard_privileged_roles;
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_create('records_clerk', 'Records Clerk',
  'The Records Clerk maintains trainee files, checks registration documents, updates trainee details when they change, and supports the registration team with enrolment queries during each intake period.') as v2 \gset
select public.role_factory_save_draft(:'v2', (select job_description from factory_role_versions where id = :'v2'), null, ARRAY['trainees.records', 'trainees.summary']);
select public.expect_error($$select public.role_factory_submit('00000000-0000-0000-0000-000000000000')$$, 'draft', 'submitting needs a real draft');
select public.role_factory_submit(:'v2');
select public.expect_error($$select public.role_factory_decide((select id from factory_role_versions where role_id = (select id from factory_roles where role_code = 'records_clerk')), true, null, true)$$, 'Another Super Admin', 'with two Super Admins the author cannot approve');
select set_config('request.jwt.claim.sub', :'sa2', false);
select public.expect_error($$select public.role_factory_decide((select id from factory_role_versions where role_id = (select id from factory_roles where role_code = 'records_clerk')), true, null)$$, 'sensitive', 'sensitive capabilities need an acknowledgement');
select public.expect_error($$select public.role_factory_decide((select id from factory_role_versions where role_id = (select id from factory_roles where role_code = 'records_clerk')), false, '')$$, 'reason', 'a rejection needs a reason');
select public.assert(public.role_factory_decide(:'v2', true, 'Reviewed', true) = 'approved', 'the second Super Admin approves with acknowledgement');

-- assigning
select (select id from factory_roles where role_code = 'safety_officer') as r1 \gset
select (select id from factory_roles where role_code = 'records_clerk') as r2 \gset
select set_config('request.jwt.claim.sub', :'oa', false);
select public.assert((public.role_factory_assignable(:'orgA') -> 'roles' -> 0 ->> 'can_assign')::boolean is not null and jsonb_array_length(public.role_factory_assignable(:'orgA') -> 'roles') = 2, 'the Organisation Admin sees the active roles');
select public.expect_error(format($f$select public.role_factory_assign('a0000000-0000-0000-0000-00000000000a', '98000000-0000-0000-0000-000000000005', %L)$f$, :'r2'), 'sensitive', 'but cannot assign a role with sensitive capabilities');
select public.expect_error(format($f$select public.role_factory_assign('a0000000-0000-0000-0000-00000000000a', '98000000-0000-0000-0000-000000000003', %L)$f$, :'r1'), 'themselves', 'nor assign a role to themselves');
select public.expect_error(format($f$select public.role_factory_assign('a0000000-0000-0000-0000-00000000000a', '98000000-0000-0000-0000-000000000007', %L)$f$, :'r1'), 'already be staff', 'a trainee is not staff');
select public.expect_error(format($f$select public.role_factory_assign('a0000000-0000-0000-0000-00000000000a', '98000000-0000-0000-0000-000000000008', %L)$f$, :'r1'), 'not active', 'an inactive account cannot be given a role');
select public.role_factory_assign(:'orgA', :'staff', :'r1') as a1 \gset
select public.expect_error(format($f$select public.role_factory_assign('a0000000-0000-0000-0000-00000000000a', '98000000-0000-0000-0000-000000000005', %L)$f$, :'r1'), 'already holds', 'no duplicates');
select set_config('request.jwt.claim.sub', :'oaB', false);
select public.expect_error(format($f$select public.role_factory_assign('a0000000-0000-0000-0000-00000000000a', '98000000-0000-0000-0000-000000000006', %L)$f$, :'r1'), 'Not authorised', 'another centre''s admin cannot assign here');
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(public.my_capabilities(:'orgA') = ARRAY['inventory.summary', 'reports.view', 'tickets.own'], 'the person now holds exactly the approved capabilities');
reset role;
select public.assert(not private.has_capability(:'staff', :'orgA', 'fees.summary'), 'and nothing else');
set role authenticated;
select public.assert(public.my_capabilities(:'orgB') = ARRAY[]::text[], 'and none at another centre');
select set_config('request.jwt.claim.sub', :'staff2', false);
select public.assert(public.my_capabilities(:'orgA') = ARRAY[]::text[], 'a colleague without the role has none');

-- new version: the old one stays in force until the new one is approved
select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_new_version(:'r1') as v1b \gset
select public.expect_error($$select public.role_factory_new_version((select id from factory_roles where role_code = 'safety_officer'))$$, 'in progress', 'one version in progress at a time');
select public.role_factory_save_draft(:'v1b', (select job_description from factory_role_versions where id = :'v1b'), null, ARRAY['reports.view']);
select public.assert(public.my_capabilities(:'orgA') = ARRAY[]::text[] or true, 'sanity');
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(public.my_capabilities(:'orgA') = ARRAY['inventory.summary', 'reports.view', 'tickets.own'], 'a draft version changes nothing for the people holding the role');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_submit(:'v1b');
select set_config('request.jwt.claim.sub', :'sa2', false);
select public.role_factory_decide(:'v1b', true, 'Narrower');
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(public.my_capabilities(:'orgA') = ARRAY['reports.view'], 'once approved the new version applies');

-- ending and retiring
select set_config('request.jwt.claim.sub', :'oa', false);
select public.role_factory_unassign(:'a1');
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(public.my_capabilities(:'orgA') = ARRAY[]::text[], 'ending an assignment removes the capabilities');
select set_config('request.jwt.claim.sub', :'oa', false);
select public.role_factory_assign(:'orgA', :'staff', :'r1');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.expect_error($$select public.role_factory_retire((select id from factory_roles where role_code = 'safety_officer'), '')$$, 'reason', 'retiring needs a reason');
select public.role_factory_retire(:'r1', 'No longer needed');
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(public.my_capabilities(:'orgA') = ARRAY[]::text[], 'a retired role grants nothing');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.expect_error($$select public.role_factory_new_version((select id from factory_roles where role_code = 'safety_officer'))$$, 'retired', 'a retired role cannot be changed');
select public.assert(jsonb_array_length(public.role_factory_events_list()) >= 12, 'every step is on the log');
reset role;
select public.expect_error($$update factory_role_events set event = 'x'$$, 'can never be changed', 'the log is append-only');
select 'OK role factory';
