\set ON_ERROR_STOP on
select set_config('app.legacy_import', 'on', false);
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set TB 'd0000000-0000-0000-0000-0000000000bb'
\set cm '99999999-0000-0000-0000-000000000001'
\set hofa '99999999-0000-0000-0000-000000000002'
\set lo '99999999-0000-0000-0000-000000000003'
\set acc '99999999-0000-0000-0000-000000000004'
\set trn '99999999-0000-0000-0000-000000000005'
\set loB '99999999-0000-0000-0000-000000000006'

insert into auth.users (id,email) values (:'cm','cm3@a.test'),(:'hofa','hofa3@a.test'),(:'lo','lo3@a.test'),(:'acc','acc3@a.test'),(:'trn','trn3@a.test'),(:'loB','lob3@b.test') on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id in (:'cm',:'hofa',:'lo',:'acc',:'trn',:'loB') on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values
 (:'cm','centre_manager',:'orgA'),(:'hofa','head_of_finance_admin',:'orgA'),(:'lo','loan_officer',:'orgA'),(:'acc','accountant',:'orgA'),(:'trn','trainer',:'orgA'),(:'loB','loan_officer',:'orgB');
alter table user_roles enable trigger trg_guard_privileged_roles;
create temp table tb2 as select * from trainees where id = :'T1';
update tb2 set id = :'TB', identity_id = null, trainee_id = 'B-0002', national_id = 'B-NATID2', user_id = null, organization_id = :'orgB', email = null, system_email = null;
insert into trainees select * from tb2 on conflict do nothing;

set role authenticated; select set_config('request.jwt.claim.sub', :'lo', false);
select public.expect_error($$insert into funding_records (organization_id, trainee_id, academic_year) values ('a0000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-000000000001','2026')$$, 'row-level security', 'clients cannot write funding records directly');
select public.expect_error(format('select public.create_funding_record(%L)', :'TB'), 'Not authorised', 'no records for another centre''s trainee');
select public.create_funding_record(:'T1', null, 'nsfaf_tuition', 'January') as rec \gset
select public.expect_error(format('select public.create_funding_record(%L)', :'T1'), 'already has a funding record', 'one record per trainee per year');
select public.assert((select application_status = 'not_applied' and award_status = 'none' and registration_status = 'not_verified' from funding_records where id = :'rec'), 'statuses start independent and neutral');

select public.expect_error(format('select public.update_funding_application(%L, null, ''submitted'')', :'rec'), 'date the application was submitted', 'submission needs a date');
select public.expect_error(format('select public.update_funding_application(%L, null, ''submitted'', current_date)', :'rec'), 'NSFAF application reference', 'submission needs a reference');
select public.update_funding_application(:'rec', 'NSF-001', 'submitted', current_date - 40);
select public.assert((select 'documents_missing' = any(attention) and 'registration_not_verified' = any(attention) and 'no_nsfaf_response' = any(attention) from public.funding_cases_base('2026') where id = :'rec'), 'attention reasons raised');
select public.assert((public.funding_register(null, 'NSF-001')->>'total')::int = 1, 'search by NSFAF reference');

select public.add_funding_document(:'rec', 'application_form', 'a0000000-0000-0000-0000-00000000000a/funding/x/form.pdf', 'form.pdf') as d1 \gset
select public.expect_error(format('select public.add_funding_document(%L, ''other'', ''b0000000-0000-0000-0000-00000000000b/x.pdf'', ''x.pdf'')', :'rec'), 'centre', 'documents stay in the centre folder');
select public.expect_error(format('select public.set_funding_document_status(%L, ''requires_correction'')', :'d1'), 'what needs to be corrected', 'corrections need a reason');
select public.set_funding_document_status(:'d1', 'verified');
select public.assert((select verified_by = auth.uid() and verified_at is not null from funding_documents where id = :'d1'), 'verifier and time recorded');
select public.set_funding_registration(:'rec', 'verified');

select public.expect_error(format('select public.record_nsfaf_decision(%L, ''confirmed'', current_date, ''Award letter'', 5000)', :'rec'), 'award letter or correspondence', 'no award without the NSFAF letter on file');
select public.add_funding_document(:'rec', 'award_letter', 'a0000000-0000-0000-0000-00000000000a/funding/x/award.pdf', 'award.pdf') as d2 \gset
select public.expect_error(format('select public.record_nsfaf_decision(%L, ''approved'', current_date, ''Letter'')', :'rec'), 'confirmed or rejected', 'the officer cannot approve');
select public.expect_error(format('select public.record_nsfaf_decision(%L, ''confirmed'', current_date, '' '')', :'rec'), 'where the NSFAF decision came from', 'source required');
select public.expect_error(format('select public.update_funding_application(%L, null, ''approved'')', :'rec'), 'Unknown application status', 'application status cannot be set to approved');
select public.expect_error(format('select public.record_funding_payment(%L, 100, current_date, ''TX1'')', :'rec'), 'confirmed NSFAF award', 'no payment before a confirmed award');
select public.record_nsfaf_decision(:'rec', 'confirmed', current_date, 'Award letter dated today', 5000, current_date, current_date + 300, 'Tuition only');
select public.assert((select award_status = 'confirmed' and application_status = 'submitted' and awarded_amount = 5000 from funding_records where id = :'rec'), 'award recorded separately from the application status');

select public.expect_error(format('select public.record_funding_payment(%L, 0, current_date, ''TX1'')', :'rec'), 'greater than zero', 'amount must be positive');
select public.expect_error(format('select public.record_funding_payment(%L, 100, current_date + 5, ''TX1'')', :'rec'), 'date the payment was received', 'no future-dated payments');
select public.record_funding_payment(:'rec', 2500, current_date, 'TX-100', 'institution', null, 'Semester 1', 2500) as pay \gset
select public.expect_error(format('select public.record_funding_payment(%L, 10, current_date, ''tx-100'')', :'rec'), 'already recorded', 'transaction references are unique');
select public.expect_error(format('select public.reconcile_funding_payment(%L, ''reconciled'')', :'pay'), 'Not authorised', 'the officer cannot reconcile');
select public.send_payment_to_finance(:'pay');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.expect_error(format('select public.reconcile_funding_payment(%L, ''reconciled'')', :'pay'), 'Not authorised', 'the Centre Manager only reads');
select set_config('request.jwt.claim.sub', :'acc', false);
select public.expect_error(format('select public.reconcile_funding_payment(%L, ''discrepancy'')', :'pay'), 'Explain', 'a discrepancy needs a note');
select public.reconcile_funding_payment(:'pay', 'discrepancy', 'Bank shows N$2,000');
select public.assert((select payment_status = 'discrepancy' from public.funding_cases_base('2026') where id = :'rec'), 'payment status derived from reconciliation');
select set_config('request.jwt.claim.sub', :'lo', false);
select public.send_payment_to_finance(:'pay');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.reconcile_funding_payment(:'pay', 'reconciled');
select public.assert((select payment_status = 'reconciled' and amount_paid = 2500 from public.funding_cases_base('2026') where id = :'rec'), 'reconciled payment counted');

select set_config('request.jwt.claim.sub', :'lo', false);
select public.add_funding_followup(:'rec', 'enquiry', 'Trainee asks about allowance', current_date - 1) as fu \gset
select public.assert((select 'followup_overdue' = any(attention) and 'enquiry_open' = any(attention) from public.funding_cases_base('2026') where id = :'rec'), 'overdue enquiry raises attention');
select public.expect_error(format('select public.resolve_funding_followup(%L, '' '')', :'fu'), 'resolution note', 'resolution note required');
select public.resolve_funding_followup(:'fu', 'Answered by phone');
select public.add_funding_note(:'rec', 'nsfaf_correspondence', 'Called NSFAF, awaiting letter');
select public.assert(jsonb_array_length(public.funding_record_detail(:'rec')->'events') >= 8, 'audit trail records the changes');
select public.assert((public.funding_record_detail(:'rec')->'events'->0->>'actor') is not null, 'events show who acted');

reset role;
select public.expect_error($$delete from funding_events$$, 'cannot be changed', 'the audit trail is append-only');
select public.expect_error($$delete from funding_records$$, 'cannot be deleted', 'records are never deleted');
select public.expect_error($$update funding_payments set amount = 1$$, 'reconciled payment cannot be changed', 'reconciled payments are final');

set role authenticated; select set_config('request.jwt.claim.sub', :'loB', false);
select public.assert((select count(*) from funding_records) = 0, 'another centre sees no records');
select public.assert((public.funding_register(null)->>'total')::int = 0, 'register is centre-scoped');
select public.expect_error(format('select public.funding_record_detail(%L)', :'rec'), 'Not authorised', 'detail is centre-scoped');
select public.assert(jsonb_array_length(public.funding_search('NSF')) = 0, 'search is centre-scoped');
select set_config('request.jwt.claim.sub', :'trn', false);
select public.assert((select count(*) from funding_records) = 0, 'other roles read nothing');
select public.assert((public.funding_register(null)->>'total')::int = 0, 'other roles get an empty register');

select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((public.funding_overview('2026')->>'confirmed')::int = 1 and (public.funding_overview('2026')->>'tracked')::int = 1, 'centre manager reads the overview');
reset role;
select 'OK nsfaf funding';
