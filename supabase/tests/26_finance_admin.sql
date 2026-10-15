\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set cm '88888888-0000-0000-0000-000000000001'
\set hofa '88888888-0000-0000-0000-000000000002'
\set acc '88888888-0000-0000-0000-000000000003'
\set cr '88888888-0000-0000-0000-000000000004'
\set deb '88888888-0000-0000-0000-000000000005'
\set ast '88888888-0000-0000-0000-000000000006'
\set trn '88888888-0000-0000-0000-000000000007'
\set accB '88888888-0000-0000-0000-000000000008'

insert into auth.users (id,email) values (:'cm','cm2@a.test'),(:'hofa','hofa2@a.test'),(:'acc','acc2@a.test'),(:'cr','cr2@a.test'),(:'deb','deb2@a.test'),(:'ast','ast2@a.test'),(:'trn','trn2@a.test'),(:'accB','accb2@b.test') on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id in (:'cm',:'hofa',:'acc',:'cr',:'deb',:'ast',:'trn',:'accB') on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values
 (:'cm','centre_manager',:'orgA'),(:'hofa','head_of_finance_admin',:'orgA'),(:'acc','accountant',:'orgA'),(:'cr','creditors_officer',:'orgA'),
 (:'deb','debtor_officer',:'orgA'),(:'ast','asset_maintenance_coordinator',:'orgA'),(:'trn','trainer',:'orgA'),(:'accB','accountant',:'orgB');
alter table user_roles enable trigger trg_guard_privileged_roles;
insert into suppliers (id, organization_id, name) values ('55000000-0000-0000-0000-000000000001', :'orgA', 'Acme Supplies');
insert into fee_records (id, trainee_id, organization_id, total_fee, amount_paid, academic_year) values ('f2000000-0000-0000-0000-000000000001', :'T1', :'orgA', 1000, 300, '2026');
insert into asset_categories (id, organization_id, name, code) values ('ac000000-0000-0000-0000-000000000001', :'orgA', 'IT', 'IT');
insert into assets (id, organization_id, category_id, asset_code, asset_name) values ('a5000000-0000-0000-0000-000000000001', :'orgA', 'ac000000-0000-0000-0000-000000000001', 'PC-1', 'Lab PC');

-- ===== supplier invoice: record, verify, request, approve, pay =====
set role authenticated; select set_config('request.jwt.claim.sub', :'cr', false);
select public.expect_error($$insert into supplier_invoices (organization_id, supplier_id, invoice_number, due_date, subtotal, total_amount) values ('a0000000-0000-0000-0000-00000000000a','55000000-0000-0000-0000-000000000001','X1', current_date, 10, 10)$$, 'row-level security', 'clients cannot write invoices directly');
select public.record_supplier_invoice('55000000-0000-0000-0000-000000000001', 'INV-1', current_date, current_date + 30, 4000, 600) as inv \gset
select public.assert((select total_amount from supplier_invoices where id = :'inv') = 4600 and (select status from supplier_invoices where id = :'inv') = 'recorded', 'invoice recorded with its total');
select public.expect_error($$select public.record_supplier_invoice('55000000-0000-0000-0000-000000000001', 'INV-1', current_date, current_date + 30, 1, 0)$$, 'already been recorded', 'a duplicate supplier invoice is refused');
select public.expect_error(format('select public.request_invoice_payment(%L)', :'inv'), 'Verify the invoice', 'payment cannot be requested before verification');
select public.verify_supplier_invoice(:'inv');
select public.request_invoice_payment(:'inv') as wf \gset
select public.assert((select status from workflow_instances where id = :'wf') = 'draft' and (select status from supplier_invoices where id = :'inv') = 'requested', 'a payment request starts as a draft');
select public.expect_error(format('select public.workflow_submit(%L)', :'wf'), 'Attach the supporting', 'a payment request needs its supporting document');
insert into workflow_attachments (instance_id, file_path, file_name) values (:'wf', 'a0000000-0000-0000-0000-00000000000a/workflow/x.pdf', 'invoice.pdf');
select public.workflow_submit(:'wf');
select public.assert(exists (select 1 from workflow_task_assignees a join workflow_tasks t on t.id = a.task_id where t.instance_id = :'wf' and a.user_id = :'hofa'), 'it goes to the Head of Finance and Administration');
select public.expect_error(format('select public.record_supplier_payment(%L, ''REF1'')', :'inv'), 'approved payment request', 'submitted is not approved or paid');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.assert((select count(*) from workflow_attachments where instance_id = :'wf') = 1, 'the approver sees the supporting document');
select public.workflow_act((select id from workflow_tasks where instance_id = :'wf' and status = 'pending'), 'approve', 'Pay it') = 'approved' as ok \gset
select public.assert((select status from supplier_invoices where id = :'inv') = 'approved', 'approval is recorded on the invoice');
select public.expect_error(format('select public.record_supplier_payment(%L, ''REF1'')', :'inv'), 'Not authorised', 'the approver cannot record the payment');
select set_config('request.jwt.claim.sub', :'cr', false);
select public.expect_error(format('select public.record_supplier_payment(%L, '' '')', :'inv'), 'payment reference', 'a payment needs a reference');
select public.record_supplier_payment(:'inv', 'EFT-77');
select public.assert((select status from supplier_invoices where id = :'inv') = 'paid' and (select status from workflow_instances where id = :'wf') = 'completed', 'payment is a separate stage and completes the request');
reset role;
select public.expect_error(format('update supplier_invoices set total_amount = 1 where id = %L', :'inv'), 'Finalised', 'a paid invoice cannot be edited');
select public.expect_error(format('delete from supplier_invoices where id = %L', :'inv'), 'cannot be deleted', 'a financial record cannot be deleted');

-- ===== amount above the approval limit also needs the Centre Manager =====
insert into workflow_escalation_limits (organization_id, process_type, limit_amount) values (:'orgA', 'payment_request', 1000);
set role authenticated; select set_config('request.jwt.claim.sub', :'cr', false);
select public.record_supplier_invoice('55000000-0000-0000-0000-000000000001', 'INV-2', current_date, current_date + 30, 5000, 0) as inv2 \gset
select public.verify_supplier_invoice(:'inv2');
select public.request_invoice_payment(:'inv2') as wf2 \gset
insert into workflow_attachments (instance_id, file_path, file_name) values (:'wf2', 'a/x.pdf', 'inv2.pdf');
select public.workflow_submit(:'wf2');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'wf2' and status = 'pending'), 'approve', 'ok') = 'escalated' as ok \gset
select public.assert((select escalated from workflow_instances where id = :'wf2') and (select status from supplier_invoices where id = :'inv2') = 'requested', 'above the limit it is not approved yet');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'wf2' and status = 'pending'), 'approve', 'ok') = 'approved' as ok \gset
select public.assert((select status from supplier_invoices where id = :'inv2') = 'approved', 'the Centre Manager''s approval finishes it');

-- ===== cancelling a draft gives the invoice back =====
select set_config('request.jwt.claim.sub', :'cr', false);
select public.record_supplier_invoice('55000000-0000-0000-0000-000000000001', 'INV-3', current_date, current_date + 30, 100, 0) as inv3 \gset
select public.verify_supplier_invoice(:'inv3');
select public.request_invoice_payment(:'inv3') as wf3 \gset
select public.workflow_cancel(:'wf3', 'changed my mind');
select public.assert((select status from supplier_invoices where id = :'inv3') = 'verified', 'a cancelled request releases the invoice');

-- ===== journal entries =====
select set_config('request.jwt.claim.sub', :'acc', false);
select public.create_journal_entry(current_date, 'Accrue rent', 'Rent expense', 'Accruals', 2500) as je \gset
select public.expect_error($$select public.create_journal_entry(current_date, 'x', 'Same', 'Same', 5)$$, 'check constraint|different|violates', 'both sides must differ');
select public.submit_journal_entry(:'je') as jwf \gset
select public.workflow_submit(:'jwf');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'jwf' and status = 'pending'), 'approve', 'ok');
select public.assert((select status from journal_entries where id = :'je') = 'approved', 'an approved entry is not posted yet');
select set_config('request.jwt.claim.sub', :'acc', false);
select public.post_journal_entry(:'je');
select public.assert((select status from journal_entries where id = :'je') = 'posted' and (select status from workflow_instances where id = :'jwf') = 'completed', 'posting completes the request');
select public.reverse_journal_entry(:'je', 'Wrong period') as rev \gset
select public.assert((select debit_account from journal_entries where id = :'rev') = 'Accruals' and (select reversal_of from journal_entries where id = :'rev') = :'je'::uuid, 'the reversal swaps the accounts');
select public.submit_journal_entry(:'rev') as rwf \gset
select public.workflow_submit(:'rwf');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'rwf' and status = 'pending'), 'approve', 'ok');
select set_config('request.jwt.claim.sub', :'acc', false);
select public.post_journal_entry(:'rev');
select public.assert((select status from journal_entries where id = :'je') = 'reversed', 'posting the reversal marks the original reversed');
reset role;
select public.expect_error(format('update journal_entries set amount = 1 where id = %L', :'je'), 'Finalised', 'a posted or reversed entry cannot be edited');

-- ===== debtor adjustments =====
set role authenticated; select set_config('request.jwt.claim.sub', :'deb', false);
select public.expect_error($$select public.request_debtor_adjustment('f2000000-0000-0000-0000-000000000001', 'write_off', 5000, 'too much')$$, 'more than the outstanding', 'cannot write off more than is owed');
select public.request_debtor_adjustment('f2000000-0000-0000-0000-000000000001', 'write_off', 200, 'Hardship') as awf \gset
insert into workflow_attachments (instance_id, file_path, file_name) values (:'awf', 'a/h.pdf', 'letter.pdf');
select public.workflow_submit(:'awf');
select public.assert((select total_fee from fee_records where id = 'f2000000-0000-0000-0000-000000000001') = 1000, 'nothing changes before approval');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'awf' and status = 'pending'), 'approve', 'ok');
select set_config('request.jwt.claim.sub', :'deb', false);
select public.apply_debtor_adjustment((select id from debtor_adjustments where workflow_instance_id = :'awf'));
select public.assert((select balance from fee_records where id = 'f2000000-0000-0000-0000-000000000001') = 500, 'the approved write-off reduces the balance');
select public.expect_error(format('select public.apply_debtor_adjustment(%L)', (select id from debtor_adjustments where workflow_instance_id = :'awf')), 'approved adjustment', 'it cannot be applied twice');
select public.request_debtor_adjustment('f2000000-0000-0000-0000-000000000001', 'credit_note', 50, 'Error') as awf2 \gset
select public.workflow_cancel(:'awf2');
select public.assert(not exists (select 1 from debtor_adjustments where workflow_instance_id = :'awf2'), 'a cancelled draft adjustment leaves nothing behind');
select set_config('request.jwt.claim.sub', :'trn', false);
select public.expect_error($$select public.request_debtor_adjustment('f2000000-0000-0000-0000-000000000001', 'write_off', 5, 'x')$$, 'Not authorised', 'only the debtor officer can request one');

-- ===== asset requests =====
select set_config('request.jwt.claim.sub', :'ast', false);
select public.expect_error($$select public.request_asset_approval('disposal', null, 'Scrap PC', 'old', 0)$$, 'Choose the asset', 'a disposal names its asset');
select public.request_asset_approval('disposal', 'a5000000-0000-0000-0000-000000000001', 'Scrap Lab PC', 'End of life', 0) as swf \gset
insert into workflow_attachments (instance_id, file_path, file_name) values (:'swf', 'a/q.pdf', 'quote.pdf');
select public.workflow_submit(:'swf');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.workflow_act((select id from workflow_tasks where instance_id = :'swf' and status = 'pending'), 'approve', 'ok');
select set_config('request.jwt.claim.sub', :'ast', false);
select public.complete_asset_request((select id from asset_requests where workflow_instance_id = :'swf'), 'Disposed');
select public.assert((select status from asset_requests where workflow_instance_id = :'swf') = 'completed' and (select status from workflow_instances where id = :'swf') = 'completed', 'a completed asset request closes the workflow');

-- ===== dashboard figures and access =====
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.assert((public.finance_overview()->'payables'->>'approved_unpaid')::int = 1, 'approved but unpaid invoices are counted');
select public.assert((public.finance_overview()->'receivables'->>'outstanding')::numeric = 500, 'receivables follow the fee records');
select public.assert((select count(*) from public.finance_monthly(6)) = 6, 'six months of income and expenditure');
select public.assert((select expenditure from public.finance_monthly(1)) = 4600, 'paid invoices are expenditure');
select set_config('request.jwt.claim.sub', :'trn', false);
select public.expect_error($$select public.finance_overview()$$, 'Not authorised', 'a trainer cannot open the finance overview');
select set_config('request.jwt.claim.sub', :'accB', false);
select public.assert((select count(*) from supplier_invoices) = 0 and (select count(*) from journal_entries) = 0, 'another centre sees none of this');
select public.assert((public.finance_overview()->'payables'->>'outstanding')::numeric = 0, 'another centre''s figures are its own');
select 'OK finance and administration' as result;
