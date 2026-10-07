\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set adminB '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'
\set Q 'e0000000-0000-0000-0000-000000000001'

-- ===== transcript =====
insert into qualification_unit_standards (qualification_id, unit_standard_id, unit_standard_title, credit_value, level) values (:'Q', 'US1', 'Safety', 6, 1), (:'Q', 'US2', 'Welding basics', 14, 1);
insert into assessment_templates (id, organization_id, qualification_id, status, created_by) values ('a7000000-0000-0000-0000-000000000001', :'orgA', :'Q', 'approved', :'admin');
insert into assessment_template_components (id, template_id, component_name, component_type, sequence_order) values
 ('a8000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'Theory', 'theory', 1),
 ('a8000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000001', 'Practical', 'practical', 2);
insert into qualification_results (organization_id, qualification_id, template_component_id, trainee_id, academic_year, ca_mark, sa_mark, pass_mark, result_status, approved_at) values
 (:'orgA', :'Q', 'a8000000-0000-0000-0000-000000000001', :'T1', '2026', 70, 80, 50, 'pass', now()),
 (:'orgA', :'Q', 'a8000000-0000-0000-0000-000000000002', :'T1', '2026', 60, null, 60, 'pass', now()),
 -- trainee 2: one component failed, one result not yet approved
 (:'orgA', :'Q', 'a8000000-0000-0000-0000-000000000001', :'T2', '2026', 40, 30, 50, 'fail', now()),
 (:'orgA', :'Q', 'a8000000-0000-0000-0000-000000000002', :'T2', '2026', 90, 90, 60, 'pass', null);
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((public.transcript_data(:'T1') ->> 'total_credits')::int = 20 and (public.transcript_data(:'T1') ->> 'completed_credits')::int = 20, 'all components passed: credits completed');
select public.assert((public.transcript_data(:'T1') ->> 'average_mark')::numeric = 67.5, 'average of final marks (75 and 60)');
select public.expect_error($$select public.transcript_data('d0000000-0000-0000-0000-000000000002')$$, 'not found', 'a trainee cannot read another trainee''s transcript');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((public.transcript_data(:'T2') ->> 'completed_credits')::int = 0, 'a failed component means no completed credits');
select public.assert(jsonb_array_length(public.transcript_data(:'T2') -> 'blocks' -> 0 -> 'components') = 1, 'unapproved results are left off');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.expect_error($$select public.transcript_data('d0000000-0000-0000-0000-000000000001')$$, 'not found', 'staff of another centre cannot read it');
select public.expect_error($$select public.issue_transcript('d0000000-0000-0000-0000-000000000001', '2026')$$, 'Not authorised', 'staff of another centre cannot issue it');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.issue_transcript('d0000000-0000-0000-0000-000000000001', '2026')$$, 'Not authorised', 'a trainee cannot issue their own transcript');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert(public.issue_transcript(:'T1', '2026') ->> 'transcript_number' like 'TR-%', 'staff issue a transcript with a number');
select public.assert((select public.issue_transcript(:'T1', '2026') ->> 'transcript_number') = (select transcript_number from transcripts where trainee_id = :'T1'), 'issuing again keeps the same number');
select public.assert((select count(*) from transcripts where trainee_id = :'T1') = 1, 'one transcript row per trainee and year');
select public.expect_error($$select public.issue_transcript('d0000000-0000-0000-0000-000000000001', '2031')$$, 'no approved results', 'no results, no transcript');
reset role;

-- ===== bank reconciliation =====
insert into fee_records (id, trainee_id, total_fee, amount_paid, academic_year, organization_id) values
 ('fe000000-0000-0000-0000-000000000001', :'T1', 1000, 0, '2026', :'orgA'),
 ('fe000000-0000-0000-0000-000000000002', :'T2', 500, 0, '2026', :'orgA'),
 ('fe000000-0000-0000-0000-000000000003', :'T2', 300, 0, '2025', :'orgA');
insert into auth.users (id,email) values ('11111111-0000-0000-0000-0000000000d1','debtor@a.test');
insert into user_roles (user_id, role, organization_id) values ('11111111-0000-0000-0000-0000000000d1','debtor_officer',:'orgA');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.bank_import_lines('x.csv', 'FNB', '[{"date":"2026-03-01","description":"d","reference":"r","amount":10}]'::jsonb)$$, 'Not authorised', 'a trainee cannot import statements');
select set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000d1', false);
select public.assert((public.bank_import_lines('march.csv', 'FNB', '[
  {"date":"2026-03-01","description":"EFT CREDIT","reference":"062 26 00001 TINA","amount":400},
  {"date":"2026-03-02","description":"Deposit 062-26-00002","reference":"fees","amount":100},
  {"date":"2026-03-03","description":"Cash deposit","reference":"unknown","amount":250},
  {"date":"2026-03-04","description":"Bank charges","reference":"062-26-00001","amount":-12.5},
  {"date":"2026-03-05","description":"EFT CREDIT","reference":"062 26 00001 TINA","amount":400}
]'::jsonb) ->> 'imported')::int = 5, 'five lines imported (identical lines on one statement are separate payments)');
select public.assert((select status from bank_statement_lines where reference like '062 26 00001%' and txn_date = '2026-03-01') = 'matched', 'a reference holding the trainee number (spaced) matches');
select public.assert((select matched_fee_record_id from bank_statement_lines where description = 'Deposit 062-26-00002') is null and (select matched_trainee_id from bank_statement_lines where description = 'Deposit 062-26-00002') = :'T2', 'two open fee records: trainee found, fee record left for the officer');
select public.assert((select status from bank_statement_lines where reference = 'unknown') = 'unmatched', 'an unknown reference stays unmatched');
select public.assert((select status from bank_statement_lines where amount < 0) = 'unmatched', 'money paid out is never matched to a fee');
select public.assert((public.bank_import_lines('march-again.csv', 'FNB', '[{"date":"2026-03-01","description":"EFT CREDIT","reference":"062 26 00001 TINA","amount":400}]'::jsonb) ->> 'duplicates')::int = 1, 're-importing the same line is detected');
select public.bank_apply_line((select id from bank_statement_lines where txn_date = '2026-03-01'));
select public.assert((select amount_paid from fee_records where id = 'fe000000-0000-0000-0000-000000000001') = 400, 'applying updates the fee record');
select public.assert((select count(*) from payments where reference_number like '062 26 00001%') = 1, 'and records a payment');
select public.expect_error($$select public.bank_apply_line((select id from bank_statement_lines where txn_date = '2026-03-01'))$$, 'already', 'a line cannot be applied twice');
select public.bank_apply_line((select id from bank_statement_lines where description = 'Deposit 062-26-00002'), 'fe000000-0000-0000-0000-000000000002');
select public.assert((select amount_paid from fee_records where id = 'fe000000-0000-0000-0000-000000000002') = 100, 'the officer chose the fee record');
select public.expect_error($$select public.bank_apply_line((select id from bank_statement_lines where txn_date = '2026-03-05'), 'fe000000-0000-0000-0000-000000000003')$$, 'more than the balance', 'a payment larger than the balance owing is refused') ;
select public.bank_set_line_status((select id from bank_statement_lines where reference = 'unknown'), true);
select public.assert((select status from bank_statement_lines where reference = 'unknown') = 'ignored', 'a line can be ignored');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from bank_statement_lines) = 0, 'another centre cannot see the lines');
reset role;
select 'OK transcript and bank reconciliation';
