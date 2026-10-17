\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
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

-- ===== borrower, application, documents, assessment =====
set role authenticated; select set_config('request.jwt.claim.sub', :'lo', false);
select public.expect_error($$insert into loan_borrowers (organization_id, full_name, national_id) values ('a0000000-0000-0000-0000-00000000000a','x','y')$$, 'row-level security', 'clients cannot write loan records directly');
select public.register_loan_borrower('other', null, 'Jane Borrower', 'ID-1001', '0811111111', null, 'Windhoek', 'Acme', 8000) as bor \gset
select public.expect_error($$select public.register_loan_borrower('other', null, 'Jane Again', 'ID-1001', null, null, null, null, 1)$$, 'already registered', 'a borrower is registered once');
select public.expect_error(format('select public.register_loan_application(%L, ''Tools'', 100, 12)', :'bor'), 'between', 'the amount must be within the centre''s limits');
select public.register_loan_application(:'bor', 'Buy tools', 6000, 12) as app \gset
select public.assert((select application_number from loan_applications where id = :'app') ~ '^LA-[0-9]{4}-0001$' and (select interest_rate from loan_applications where id = :'app') = 12, 'application numbered, default rate applied');
select public.expect_error(format('select public.assess_loan_application(%L, 500)', :'app'), 'Verify the borrower', 'assessment needs verified documents');
select public.add_loan_document(:'app', 'identity', 'a/id.pdf', 'id.pdf') as d1 \gset
select public.add_loan_document(:'app', 'proof_of_income', 'a/pay.pdf', 'payslip.pdf') as d2 \gset
select public.verify_loan_document(:'d1');
select public.expect_error(format('select public.assess_loan_application(%L, 500)', :'app'), 'Verify the borrower', 'both documents must be verified');
select public.verify_loan_document(:'d2');
select public.assess_loan_application(:'app', 500) as outcome \gset
select public.assert(:'outcome' = 'eligible' and (select installment from loan_applications where id = :'app') between 533.0 and 533.2, 'eligible with the computed installment');
select public.expect_error(format('select public.request_loan_disbursement(%L)', :'app'), 'approved loan', 'cannot disburse before approval');

-- not eligible: a second application too large for the income
select public.register_loan_application(:'bor', 'Big purchase', 40000, 12) as app2 \gset
select public.add_loan_document(:'app2', 'identity', 'a/i2.pdf', 'i2.pdf') as f1 \gset
select public.add_loan_document(:'app2', 'proof_of_income', 'a/p2.pdf', 'p2.pdf') as f2 \gset
select public.verify_loan_document(:'f1'); select public.verify_loan_document(:'f2');
select public.assess_loan_application(:'app2', 500) as out2 \gset
select public.assert(:'out2' = 'not_eligible', 'an unaffordable loan is not eligible');
select public.expect_error(format('select public.recommend_loan_application(%L)', :'app2'), 'eligible', 'a not-eligible application cannot be recommended');
select public.decline_loan_application(:'app2', 'Too large for the income');
select public.assert((select status from loan_applications where id = :'app2') = 'declined', 'it can be declined');

-- ===== recommendation approved by the Head of Finance and Administration =====
select public.recommend_loan_application(:'app') as wf \gset
select public.assert((select count(*) from workflow_attachments where instance_id = :'wf') = 2, 'the verified documents travel with the request');
select public.workflow_submit(:'wf');
select public.expect_error(format('select public.workflow_act((select id from workflow_tasks where instance_id = %L and status = ''pending''), ''approve'', ''ok'')', :'wf'), 'not an approver', 'the loan officer cannot approve their own recommendation');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'wf' and status = 'pending'), 'approve', 'Approved') as r \gset
select public.assert((select status from loan_applications where id = :'app') = 'approved', 'approval is recorded on the application');

-- ===== disbursement: request, approve, record =====
select set_config('request.jwt.claim.sub', :'lo', false);
select public.request_loan_disbursement(:'app') as dwf \gset
select public.workflow_submit(:'dwf');
select public.assert((select status from loan_applications where id = :'app') = 'disbursement_requested', 'sent for disbursement approval');
select public.expect_error(format('select public.record_loan_disbursement(%L, ''EFT1'')', :'app'), 'approved disbursement', 'a request is not a disbursement');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'dwf' and status = 'pending'), 'approve', 'Release') as r \gset
select public.expect_error(format('select public.record_loan_disbursement(%L, ''EFT1'')', :'app'), 'Not authorised', 'the approver cannot record the disbursement');
select set_config('request.jwt.claim.sub', :'lo', false);
select public.record_loan_disbursement(:'app', 'EFT-9001', current_date - 100) as loan \gset
select public.assert((select count(*) from loan_schedule where loan_id = :'loan') = 12, 'a 12-month schedule is created');
select public.assert((select sum(principal_due) from loan_schedule where loan_id = :'loan') = 6000, 'the principal repayments add up to the loan');
select public.assert((select status from loan_applications where id = :'app') = 'active' and (select status from workflow_instances where id = :'dwf') = 'completed', 'the loan is active and the request completed');

-- ===== repayments and arrears =====
select public.assert(public.loan_outstanding(:'loan') = (select sum(amount_due) from loan_schedule where loan_id = :'loan'), 'outstanding starts as the whole schedule');
select public.expect_error(format('select public.record_loan_repayment(%L, 99999)', :'loan'), 'more than the outstanding', 'cannot overpay');
select public.record_loan_repayment(:'loan', 600, current_date, 'RCPT1');
select public.assert((select amount_paid from loan_schedule where loan_id = :'loan' and installment_no = 1) = (select amount_due from loan_schedule where loan_id = :'loan' and installment_no = 1)
   and (select amount_paid from loan_schedule where loan_id = :'loan' and installment_no = 2) > 0, 'payments go to the oldest installments first');
select public.assert((select count(*) from public.loan_arrears()) = 1 and (select days_overdue from public.loan_arrears()) >= 30, 'overdue installments show as arrears');
reset role;
select public.expect_error($$update loan_repayments set amount = 1$$, 'cannot be changed', 'a recorded repayment cannot be edited');
select public.expect_error($$delete from loans$$, 'cannot be deleted', 'loans cannot be deleted');
set role authenticated; select set_config('request.jwt.claim.sub', :'lo', false);

-- ===== interest waiver, restructure, write-off =====
select public.request_loan_adjustment(:'loan', 'interest_waiver', 20, null, 'Hardship') as awf \gset
select public.expect_error(format('select public.request_loan_adjustment(%L, ''write_off'', 10, null, ''x'')', :'loan'), 'still in progress', 'one adjustment at a time');
insert into workflow_attachments (instance_id, file_path, file_name) values (:'awf', 'a/x.pdf', 'support.pdf');
select public.workflow_submit(:'awf');
select public.expect_error(format('select public.apply_loan_adjustment(%L)', (select id from loan_adjustments where workflow_instance_id = :'awf')), 'approved adjustment', 'it cannot be applied before approval');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'awf' and status = 'pending'), 'approve', 'ok') as r \gset
select set_config('request.jwt.claim.sub', :'lo', false);
select public.loan_outstanding(:'loan') as before_w \gset
select public.apply_loan_adjustment((select id from loan_adjustments where workflow_instance_id = :'awf'));
select public.assert(public.loan_outstanding(:'loan') = :'before_w'::numeric - 20, 'the waiver reduces what is owed');

select public.request_loan_adjustment(:'loan', 'restructure', null, 24, 'Income dropped') as rwf \gset
insert into workflow_attachments (instance_id, file_path, file_name) values (:'rwf', 'a/x.pdf', 'support.pdf');
select public.workflow_submit(:'rwf');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'rwf' and status = 'pending'), 'approve', 'ok') as r \gset
select set_config('request.jwt.claim.sub', :'lo', false);
select public.loan_outstanding(:'loan') as before_r \gset
select public.apply_loan_adjustment((select id from loan_adjustments where workflow_instance_id = :'rwf'));
select public.assert((select count(*) from loan_schedule where loan_id = :'loan' and not superseded and amount_due - amount_paid - amount_adjusted > 0) = 24, 'a 24-month schedule replaces the unpaid rows');
select public.assert((select sum(principal_due) from loan_schedule where loan_id = :'loan' and installment_no > 12) between 4500 and 5900 and public.loan_outstanding(:'loan') > :'before_r'::numeric - 1, 'the new schedule carries the remaining principal, with interest re-based over the longer term');
select public.assert((select term_months from loans where id = :'loan') = 24, 'the loan shows its new term');

select public.request_loan_adjustment(:'loan', 'write_off', public.loan_outstanding(:'loan'), null, 'Borrower untraceable') as wwf \gset
insert into workflow_attachments (instance_id, file_path, file_name) values (:'wwf', 'a/x.pdf', 'support.pdf');
select public.workflow_submit(:'wwf');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'wwf' and status = 'pending'), 'approve', 'ok') as r \gset
select set_config('request.jwt.claim.sub', :'lo', false);
select public.apply_loan_adjustment((select id from loan_adjustments where workflow_instance_id = :'wwf'));
select public.assert((select status from loans where id = :'loan') = 'written_off' and public.loan_outstanding(:'loan') = 0, 'a full write-off closes the loan as written off');

-- ===== approval limit sends a large recommendation on to the Centre Manager =====
reset role;
insert into workflow_escalation_limits (organization_id, process_type, limit_amount) values (:'orgA', 'loan_request', 5000);
set role authenticated; select set_config('request.jwt.claim.sub', :'lo', false);
select public.register_loan_borrower('other', null, 'Big Borrower', 'ID-2002', null, null, null, null, 30000) as bor2 \gset
select public.register_loan_application(:'bor2', 'Equipment', 9000, 12) as app3 \gset
select public.add_loan_document(:'app3', 'identity', 'a/i.pdf', 'i.pdf') as e1 \gset
select public.add_loan_document(:'app3', 'proof_of_income', 'a/p.pdf', 'p.pdf') as e2 \gset
select public.verify_loan_document(:'e1'); select public.verify_loan_document(:'e2');
select public.assess_loan_application(:'app3', 0) as out3 \gset
select public.recommend_loan_application(:'app3') as lwf \gset
select public.workflow_submit(:'lwf');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'lwf' and status = 'pending'), 'approve', 'ok') as r2 \gset
select public.assert(:'r2' = 'escalated' and (select status from loan_applications where id = :'app3') = 'recommended', 'a large loan also needs the Centre Manager');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'lwf' and status = 'pending'), 'approve', 'ok') as r3 \gset
select public.assert((select status from loan_applications where id = :'app3') = 'approved', 'the Centre Manager''s approval completes it');

-- ===== dashboard figures and access =====
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.assert((public.loan_overview()->'portfolio'->>'disbursed_total')::numeric = 6000, 'portfolio figures follow the loans');
select public.assert((public.loan_overview()->'applications'->>'approved')::int = 1, 'applications are counted by stage');
select set_config('request.jwt.claim.sub', :'trn', false);
select public.expect_error($$select public.loan_overview()$$, 'Not authorised', 'a trainer cannot open the loan figures');
select public.expect_error($$select * from public.loan_arrears()$$, 'Not authorised', 'nor the arrears list');
select set_config('request.jwt.claim.sub', :'loB', false);
select public.assert((select count(*) from loans) = 0 and (select count(*) from loan_applications) = 0 and (select count(*) from loan_borrowers) = 0, 'another centre sees none of it');
select 'OK loans' as result;
