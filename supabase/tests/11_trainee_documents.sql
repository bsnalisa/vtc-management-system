\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set outsider '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set Q 'e0000000-0000-0000-0000-000000000001'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'

insert into registrations (id, organization_id, trainee_id, qualification_id, academic_year, registration_status, registered_at) values
 ('b1000000-0000-0000-0000-000000000001', :'orgA', :'T1', :'Q', '2026', 'registered', now()),
 ('b1000000-0000-0000-0000-000000000002', :'orgA', :'T2', :'Q', '2026', 'fee_pending', null);

-- ===== proof of registration =====
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.issue_proof_of_registration('b1000000-0000-0000-0000-000000000001') as p1 \gset
select public.assert(:'p1'::jsonb->>'reference_number' ~ '^POR-[0-9]{2}-[0-9]{5}$', 'proof gets a reference number');
select public.assert(:'p1'::jsonb->>'trainee_number' = '062-26-00001' and :'p1'::jsonb->>'qualification' = 'Welding L1' and :'p1'::jsonb->>'trade' = 'Welding', 'proof carries the trainee, trade and qualification');
select public.issue_proof_of_registration('b1000000-0000-0000-0000-000000000001') as p2 \gset
select public.assert(:'p2'::jsonb->>'reference_number' = :'p1'::jsonb->>'reference_number', 'asking again returns the same reference, not a new one');
select public.assert((select count(*) from proof_of_registrations) = 1, 'only one proof record is created');
select public.expect_error($$select public.issue_proof_of_registration('b1000000-0000-0000-0000-000000000002')$$, 'Registration not found', 'a trainee cannot get a proof for someone elses registration');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.expect_error($$select public.issue_proof_of_registration('b1000000-0000-0000-0000-000000000002')$$, 'not complete', 'no proof while fees are outstanding');
select public.expect_error($$select public.issue_proof_of_registration('b1000000-0000-0000-0000-000000000001')$$, 'Registration not found', 'and not for the other trainee either');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.expect_error($$select public.issue_proof_of_registration('b1000000-0000-0000-0000-000000000001')$$, 'Registration not found', 'another centre cannot issue it');
reset role;
select 'OK proof of registration';

-- ===== statement of results =====
insert into assessment_templates (id, organization_id, qualification_id, created_by) values ('a7000000-0000-0000-0000-000000000001', :'orgA', :'Q', :'admin');
insert into assessment_template_components (id, template_id, component_name, component_type) values
 ('a8000000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000001','Module A','theory'),
 ('a8000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000001','Module B','practical'),
 ('a8000000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000001','Module C','practical');
insert into qualification_results (organization_id, qualification_id, template_component_id, trainee_id, academic_year, ca_mark, sa_mark, pass_mark, result_status, approved_at) values
 (:'orgA', :'Q', 'a8000000-0000-0000-0000-000000000001', :'T1', '2026', 70, 65, 50, 'competent', now()),
 (:'orgA', :'Q', 'a8000000-0000-0000-0000-000000000002', :'T1', '2026', 40, 35, 50, 'not_yet_competent', now()),
 (:'orgA', :'Q', 'a8000000-0000-0000-0000-000000000003', :'T1', '2026', 90, 90, 50, 'competent', null),   -- not approved yet
 (:'orgA', :'Q', 'a8000000-0000-0000-0000-000000000001', :'T2', '2026', 55, 55, 50, 'competent', now());
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.my_statement_of_results() as s \gset
select public.assert(jsonb_array_length(:'s'::jsonb) = 1, 'one qualification/year group');
select public.assert(jsonb_array_length(:'s'::jsonb->0->'results') = 2, 'only approved results are included (the unapproved module is hidden)');
select public.assert(:'s'::jsonb->0->>'trainee_number' = '062-26-00001' and :'s'::jsonb->0->>'qualification' = 'Welding L1', 'statement identifies the trainee and qualification');
select public.assert(not (:'s'::jsonb::text like '%Module C%'), 'unapproved module name never leaves the database');
select public.assert((:'s'::jsonb->0->'results'->0->>'ca_mark')::numeric = 70, 'marks are present');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.my_statement_of_results() as s2 \gset
select public.assert(jsonb_array_length(:'s2'::jsonb->0->'results') = 1 and :'s2'::jsonb->0->>'trainee_number' = '062-26-00002', 'the other trainee sees only their own results');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert(public.my_statement_of_results() = '[]'::jsonb, 'someone with no trainee record gets an empty statement');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert(public.my_statement_of_results() = '[]'::jsonb, 'staff do not get other peoples results from this function');
reset role;
select 'OK statement of results';
