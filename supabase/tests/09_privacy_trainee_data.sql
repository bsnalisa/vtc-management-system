\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set trainerA '11111111-0000-0000-0000-000000000004'
\set outsider '11111111-0000-0000-0000-000000000007'
\set debtor '33333333-0000-0000-0000-000000000001'
\set trainerB '33333333-0000-0000-0000-000000000002'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set Q 'e0000000-0000-0000-0000-000000000001'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'

insert into auth.users (id,email) values (:'debtor','debtor@a.test'), (:'trainerB','trainerb@b.test');
insert into user_roles (user_id, role, organization_id) values (:'debtor','debtor_officer',:'orgA'), (:'trainerB','trainer',:'orgB');
insert into trainers (id, organization_id, user_id, trainer_id, full_name) values ('70000000-0000-0000-0000-0000000000a1', :'orgA', :'trainerA', 'TA', 'Trainer A'), ('70000000-0000-0000-0000-0000000000b1', :'orgB', :'trainerB', 'TB', 'Trainer B');

insert into trainee_financial_accounts (id, organization_id, trainee_id, account_number, total_fees) values
 ('fa000000-0000-0000-0000-000000000001', :'orgA', :'T1', 'ACC1', 1000), ('fa000000-0000-0000-0000-000000000002', :'orgA', :'T2', 'ACC2', 5000);
insert into financial_transactions (organization_id, account_id, transaction_type, amount, balance_after) values
 (:'orgA','fa000000-0000-0000-0000-000000000001','charge',1000,1000), (:'orgA','fa000000-0000-0000-0000-000000000002','charge',5000,5000);
insert into attendance_registers (id, trade_id, trainer_id, level, training_mode, academic_year, start_date, end_date, created_by, organization_id)
 values ('ab000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-0000000000a1',1,'fulltime','2026',current_date,current_date+30,:'admin',:'orgA');
insert into attendance_records (register_id, trainee_id, attendance_date, present) values
 ('ab000000-0000-0000-0000-000000000001', :'T1', current_date, true), ('ab000000-0000-0000-0000-000000000001', :'T2', current_date, false);
insert into proof_of_registrations (organization_id, trainee_id, qualification_id, reference_number, academic_year, generated_by) values
 (:'orgA', :'T1', :'Q', 'POR-1', '2026', :'admin'), (:'orgA', :'T2', :'Q', 'POR-2', '2026', :'admin');
insert into transcripts (organization_id, trainee_id, transcript_number, academic_year, generated_by) values
 (:'orgA', :'T1', 'TR-1', '2026', :'admin'), (:'orgA', :'T2', 'TR-2', '2026', :'admin');
insert into alumni (organization_id, trainee_id, graduation_year) values (:'orgA', :'T1', 2026), (:'orgA', :'T2', 2026);
insert into hostel_fees (organization_id, trainee_id, fee_month, fee_amount, due_date) values (:'orgA', :'T1', current_date, 100, current_date), (:'orgA', :'T2', current_date, 200, current_date);
insert into exam_timetables (organization_id, qualification_id, academic_year, subject_name, exam_date, created_by, published) values (:'orgA', :'Q', '2026', 'Welding theory', current_date + 10, :'admin', false);
insert into assessment_templates (id, organization_id, qualification_id, created_by) values ('a7000000-0000-0000-0000-000000000001', :'orgA', :'Q', :'admin');
insert into assessment_template_components (id, template_id, component_name, component_type) values ('a8000000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000001','Module 1','theory'), ('a8000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000001','Module 2','theory');
insert into ca_final_results (organization_id, template_component_id, trainee_id, qualification_id, academic_year) values (:'orgA', 'a8000000-0000-0000-0000-000000000001', :'T1', :'Q', '2026'), (:'orgA', 'a8000000-0000-0000-0000-000000000001', :'T2', :'Q', '2026');
select 'seeded';

-- ===== a trainee sees only their own rows =====
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from trainee_financial_accounts) = 1 and (select trainee_id from trainee_financial_accounts) = :'T1'::uuid, 'trainee sees only their own fee account');
select public.assert((select count(*) from financial_transactions) = 1 and (select amount from financial_transactions) = 1000, 'trainee sees only their own transactions');
select public.assert((select count(*) from attendance_records) = 1, 'trainee sees only their own attendance');
select public.assert((select count(*) from proof_of_registrations) = 1 and (select count(*) from transcripts) = 1, 'own proof of registration and transcript only');
select public.assert((select count(*) from alumni) = 1 and (select count(*) from hostel_fees) = 1 and (select count(*) from ca_final_results) = 1, 'own alumni, hostel fee and CA result only');
select public.assert((select count(*) from exam_timetables) = 0, 'trainee cannot see unpublished exam timetables');
select public.expect_error($$insert into ca_final_results (organization_id, template_component_id, trainee_id, qualification_id, academic_year) values ('a0000000-0000-0000-0000-00000000000a', 'a8000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2027')$$, 'row-level security', 'trainee cannot insert final CA results');
update ca_final_results set academic_year = 'hacked';
delete from ca_final_results;
reset role;
select public.assert((select count(*) from ca_final_results where academic_year = 'hacked') = 0 and (select count(*) from ca_final_results) = 2, 'trainee cannot change or delete final CA results');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from trainee_financial_accounts where account_number = 'ACC2') = 1 and (select count(*) from trainee_financial_accounts) = 1, 'the other trainee sees theirs');
reset role;
select 'OK trainees see only their own data';

-- ===== staff keep their access =====
set role authenticated; select set_config('request.jwt.claim.sub', :'debtor', false);
select public.assert((select count(*) from trainee_financial_accounts) = 2 and (select count(*) from financial_transactions) = 2, 'debtor officer still sees all accounts and transactions');
select public.assert((select count(*) from hostel_fees) = 2 and (select count(*) from alumni) = 2, 'staff still see centre-wide records');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from attendance_records) = 2 and (select count(*) from proof_of_registrations) = 2 and (select count(*) from exam_timetables) = 1, 'trainer still sees centre attendance, proofs and timetables');
select public.assert((select count(*) from attendance_registers) = 1, 'trainer sees the register');
insert into attendance_records (register_id, trainee_id, attendance_date, present) values ('ab000000-0000-0000-0000-000000000001', :'T1', current_date + 1, true);
select public.assert((select count(*) from attendance_records) = 3, 'trainer can record attendance in their own centre');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from transcripts) = 2 and (select count(*) from ca_final_results) = 2, 'admin still sees transcripts and CA results');
reset role;
select 'OK staff access preserved';

-- ===== nothing crosses organisations =====
set role authenticated; select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from trainee_financial_accounts) = 0 and (select count(*) from financial_transactions) = 0, 'other centre: no fee data');
select public.assert((select count(*) from attendance_records) = 0 and (select count(*) from attendance_registers) = 0, 'other centre: no attendance');
select public.assert((select count(*) from transcripts) = 0 and (select count(*) from proof_of_registrations) = 0 and (select count(*) from alumni) = 0 and (select count(*) from hostel_fees) = 0, 'other centre: no transcripts, proofs, alumni or hostel fees (admin of another centre included)');
select set_config('request.jwt.claim.sub', :'trainerB', false);
select public.assert((select count(*) from attendance_records) = 0, 'trainer of another centre sees no attendance');
select public.expect_error($$insert into attendance_records (register_id, trainee_id, attendance_date, present) values ('ab000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', current_date + 2, true)$$, 'row-level security', 'trainer of another centre cannot write attendance here');
select public.expect_error($$insert into attendance_registers (trade_id, trainer_id, level, training_mode, academic_year, start_date, end_date, created_by, organization_id) values ('c0000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-0000000000a1',1,'fulltime','2026',current_date,current_date,'33333333-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000000a')$$, 'row-level security', 'cannot create a register in another centre');
reset role;
select 'OK isolation between centres';
