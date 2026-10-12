\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set adminA '11111111-0000-0000-0000-000000000001'
\set hotsA '66666666-0000-0000-0000-000000000001'
\set roA '66666666-0000-0000-0000-000000000002'
\set hotsB '66666666-0000-0000-0000-000000000003'
\set applicant '66666666-0000-0000-0000-000000000004'

-- ===== setup =====
insert into auth.users (id,email) values (:'hotsA','hotsa@a.test'),(:'roA','roa@a.test'),(:'hotsB','hotsb@b.test'),(:'applicant','app@x.test');
insert into user_roles (user_id, role, organization_id) values
 (:'hotsA','head_of_trainee_support',:'orgA'), (:'roA','registration_officer',:'orgA'), (:'hotsB','head_of_trainee_support',:'orgB');
insert into trades (name, code, organization_id) values ('Office Administration', 'OAD', :'orgA'), ('Wholesale and Retail', 'WRT', :'orgA')
 on conflict do nothing;
insert into trades (name, code, organization_id) select 'Electrical', 'ELE', null where not exists (select 1 from trades where code = 'ELE' and organization_id is null);
insert into trades (name, code, organization_id) select 'Hospitality', 'HOS', null where not exists (select 1 from trades where code = 'HOS' and organization_id is null);
insert into symbol_points (organization_id, exam_level, symbol, points) values (:'orgA', 'NSSCO', 'E', 3) on conflict do nothing;

-- ===== the standard rules (the migration is run again now that the trades exist; it must not duplicate anything) =====
\ir ../migrations/20261019090000_entry_requirements_seed_and_approval.sql
\ir ../migrations/20261019090000_entry_requirements_seed_and_approval.sql
select public.assert((select count(*) from entry_requirements where organization_id = :'orgA' and trade_id is null) = 2, 'two general minimum rules per centre');
select public.assert((select count(*) from entry_requirements where organization_id = :'orgB' and trade_id is null) = 2, 'the other centre gets them too');
select public.assert((select count(*) from entry_requirements e join trades t on t.id = e.trade_id where e.organization_id = :'orgA' and t.code = 'ICT' and e.level = 2) = 2, 'ICT Level 2 has two alternative rules');
select public.assert((select count(*) from entry_requirements e join trades t on t.id = e.trade_id where e.organization_id = :'orgA' and t.code = 'OAD') = 1, 'Office Administration has its Level 1 rule');
select public.assert((select count(*) from entry_requirements e join trades t on t.id = e.trade_id where e.organization_id = :'orgB' and t.code = 'OAD') = 0, 'a centre without the trade gets no rule for it');
select public.assert((select count(*) from entry_requirements e join trades t on t.id = e.trade_id where e.organization_id = :'orgA' and t.code = 'HOS') = 4, 'Hospitality has two Level 2 alternatives and Levels 3 and 4');
select public.assert((select min_points from entry_requirements where organization_id = :'orgA' and requirement_name like 'General minimum: old%') = 23, 'old curriculum needs 23 points');
select public.assert((select english_symbol || maths_symbol || science_symbol from entry_requirements where organization_id = :'orgA' and requirement_name like 'General minimum: old%') = 'EEE', 'and E in English, Mathematics and Science');
select public.assert((select required_subjects->0->>'subject' from entry_requirements e join trades t on t.id = e.trade_id where e.organization_id = :'orgA' and t.code = 'WRT' and e.requirement_name like '%Accounting') = 'Accounting', 'Wholesale and Retail accepts Accounting instead of Mathematics');
select public.assert((select previous_level_required from entry_requirements e join trades t on t.id = e.trade_id where e.organization_id = :'orgA' and t.code = 'HOS' and e.level = 4) = 3, 'Level 4 needs the Level 3 certificate');

-- ===== applicants (no centre of their own) can read the rules and the points table =====
set role authenticated; select set_config('request.jwt.claim.sub', :'applicant', false);
select public.assert((select count(*) from entry_requirements where organization_id = :'orgA') > 0, 'an applicant can read the centre''s entry requirements');
select public.assert((select count(*) from symbol_points where organization_id = :'orgA') > 0, 'and the points table');
reset role;

-- ===== a registration officer proposes, the Head of Trainee Support decides =====
set role authenticated; select set_config('request.jwt.claim.sub', :'roA', false);
select public.assert((public.save_entry_requirement('create', null, jsonb_build_object('requirement_name', 'Test rule', 'min_points', 18, 'min_grade', 10)))->>'status' = 'pending', 'a registration officer''s new rule waits for approval');
select public.assert((select count(*) from entry_requirements where requirement_name = 'Test rule') = 0, 'and is not live yet');
select public.expect_error($$insert into entry_requirements (organization_id, requirement_name, created_by) values ('a0000000-0000-0000-0000-00000000000a', 'Direct', '66666666-0000-0000-0000-000000000002')$$, 'row-level security', 'a registration officer cannot add a rule directly');
update entry_requirements set min_points = 1 where organization_id = :'orgA' and trade_id is null;
select public.assert((select count(*) from requirement_change_requests where status = 'pending') = 1, 'the officer sees the waiting request');
select public.expect_error($$select public.review_requirement_change((select id from requirement_change_requests limit 1), true)$$, 'Not authorised', 'a registration officer cannot approve');
reset role;
select public.assert((select min(min_points) from entry_requirements where organization_id = :'orgA' and trade_id is null) = 20, 'the direct update changed nothing');

set role authenticated; select set_config('request.jwt.claim.sub', :'hotsB', false);
select public.assert((select count(*) from requirement_change_requests) = 0, 'another centre''s Head of Trainee Support cannot see the request');
select public.expect_error($$select public.review_requirement_change((select id from requirement_change_requests where status = 'pending' limit 1), true)$$, 'Request not found|Not authorised|null value', 'nor decide on it');
select set_config('request.jwt.claim.sub', :'hotsA', false);
select public.assert((select count(*) from requirement_change_requests where status = 'pending') = 1, 'the Head of Trainee Support sees it');
select public.review_requirement_change((select id from requirement_change_requests where status = 'pending'), true);
reset role;
select public.assert((select count(*) from entry_requirements where requirement_name = 'Test rule' and organization_id = :'orgA' and active) = 1, 'approving puts the rule live');
select public.assert((select count(*) from requirement_change_requests where status = 'approved') = 1, 'and records the decision');

-- decline needs a reason and changes nothing
set role authenticated; select set_config('request.jwt.claim.sub', :'roA', false);
select public.save_entry_requirement('update', (select id from entry_requirements where requirement_name = 'Test rule'), jsonb_build_object('min_points', 99));
select set_config('request.jwt.claim.sub', :'hotsA', false);
select public.expect_error($$select public.review_requirement_change((select id from requirement_change_requests where status = 'pending'), false)$$, 'reason', 'declining needs a reason');
select public.review_requirement_change((select id from requirement_change_requests where status = 'pending'), false, 'Too strict');
reset role;
select public.assert((select min_points from entry_requirements where requirement_name = 'Test rule') = 18, 'a declined change is not applied');

-- approvers change rules at once, and removing a rule keeps it in the history
set role authenticated; select set_config('request.jwt.claim.sub', :'hotsA', false);
select public.assert((public.save_entry_requirement('update', (select id from entry_requirements where requirement_name = 'Test rule'), jsonb_build_object('min_points', 21)))->>'status' = 'applied', 'the Head of Trainee Support''s change applies at once');
select public.assert((public.save_entry_requirement('deactivate', (select id from entry_requirements where requirement_name = 'Test rule'), '{}'))->>'status' = 'applied', 'removing a rule applies at once');
select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert((public.save_entry_requirement('create', null, jsonb_build_object('requirement_name', 'Admin rule', 'min_points', 20)))->>'status' = 'applied', 'an Organization Admin''s change applies at once');
select set_config('request.jwt.claim.sub', :'applicant', false);
select public.expect_error($$select public.save_entry_requirement('create', null, '{"requirement_name":"x"}')$$, 'Not authorised', 'an applicant cannot change rules');
reset role;
select public.assert((select active from entry_requirements where requirement_name = 'Test rule') = false and (select count(*) from entry_requirements_history where requirement_name = 'Test rule') >= 1, 'the removed rule stays in the history');
select 'OK entry requirements';
