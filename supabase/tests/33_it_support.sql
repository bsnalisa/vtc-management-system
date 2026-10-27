-- The Organization Admin as the centre's IT Systems Administrator: ticket handling, escalation, dashboards, and the limits on finance,
-- trainee records and the audit trail.
\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set req '98888888-0000-0000-0000-000000000001'
\set admA '98888888-0000-0000-0000-000000000002'
\set admA2 '98888888-0000-0000-0000-000000000003'
\set admB '98888888-0000-0000-0000-000000000004'
\set sup '98888888-0000-0000-0000-000000000005'
\set staff '98888888-0000-0000-0000-000000000006'
\set deb '98888888-0000-0000-0000-000000000007'
\set req2 '98888888-0000-0000-0000-000000000008'

insert into auth.users (id,email) values (:'req','req@a.test'),(:'admA','adma@a.test'),(:'admA2','adma2@a.test'),(:'admB','admb@b.test'),(:'sup','sup@x.test'),(:'staff','staff@a.test'),(:'deb','deb@a.test'),(:'req2','req2@a.test') on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '98888888%' on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'req','trainee',:'orgA'),(:'req2','trainee',:'orgB'),(:'admA','organization_admin',:'orgA'),(:'admA2','organization_admin',:'orgA'),
  (:'admB','organization_admin',:'orgB'),(:'sup','super_admin',null),(:'staff','registration_officer',:'orgA'),(:'deb','debtor_officer',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;

-- ===== raising a ticket =====
set role authenticated; select set_config('request.jwt.claim.sub', :'req', false);
insert into support_tickets (organization_id, user_id, subject, description, priority, status, assigned_to, resolution_notes, escalation_status)
  values (:'orgA', :'req', 'I cannot sign in', 'My password is not accepted', 'high', 'resolved', :'admA', 'forged', 'escalated');
reset role;
select id as tid from support_tickets where subject = 'I cannot sign in' \gset
select public.assert((select status = 'open' and assigned_to is null and resolution_notes is null and escalation_status = 'none' and reference ~ '^TKT-[0-9]{4}-[0-9]{6}$' from support_tickets where id = :'tid'), 'a new ticket always starts open and unassigned, with a reference, whatever the client sent');

-- the requester cannot edit tickets directly (everything goes through the ticket functions)
set role authenticated; select set_config('request.jwt.claim.sub', :'req', false);
update support_tickets set status = 'resolved', assigned_to = :'req' where id = :'tid';
reset role;
select public.assert((select status = 'open' and assigned_to is null from support_tickets where id = :'tid'), 'the requester cannot change status or assignment directly');

-- ===== who can see it =====
set role authenticated; select set_config('request.jwt.claim.sub', :'admA', false);
select public.assert((select count(*) from support_tickets where id = :'tid') = 1, 'the centre''s administrator sees the ticket');
select set_config('request.jwt.claim.sub', :'admB', false);
select public.assert((select count(*) from support_tickets where id = :'tid') = 0, 'another centre''s administrator does not');
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert((select count(*) from support_tickets where id = :'tid') = 0, 'other staff of the centre do not');
select set_config('request.jwt.claim.sub', :'sup', false);
select public.assert((select count(*) from support_tickets where id = :'tid') = 1, 'the Super Admin sees every centre''s tickets');

-- ===== conversation =====
select set_config('request.jwt.claim.sub', :'admB', false);
select public.expect_error(format('select public.support_ticket_add_message(%L, ''I should not see this'', false)', :'tid'), 'not found', 'an administrator of another centre cannot reply');
select set_config('request.jwt.claim.sub', :'admA', false);
select public.support_ticket_add_message(:'tid', 'Checked the account: it was locked after too many attempts.', true);
select public.support_ticket_add_message(:'tid', 'I have reset your password. Please try again.', false);
select public.assert((select status from support_tickets where id = :'tid') = 'in_progress', 'a public reply moves an open ticket to in progress');
select set_config('request.jwt.claim.sub', :'req', false);
select public.assert((select count(*) from support_ticket_messages where ticket_id = :'tid') = 1, 'the requester sees the public reply but not the internal note');
select public.support_ticket_add_message(:'tid', 'Still not working, it says invalid credentials.', true);
select public.assert((select count(*) from support_ticket_messages where ticket_id = :'tid' and kind = 'reply' and not internal) = 2, 'a requester''s message is always public');
select set_config('request.jwt.claim.sub', :'admA', false);
select public.assert((select count(*) from support_ticket_messages where ticket_id = :'tid') = 3, 'the administrator sees the whole thread');
select public.assert((select (it_dashboard()->'tickets'->>'awaiting_response')::int from (select 1) x) = 1, 'the requester''s last reply puts the ticket in "awaiting response"');
reset role;
select public.expect_error($$update support_ticket_messages set body = 'edited'$$, 'cannot be changed', 'messages cannot be edited');
select public.expect_error($$delete from support_ticket_messages$$, 'cannot be changed', 'messages cannot be deleted');
set role authenticated; select set_config('request.jwt.claim.sub', :'admA', false);
select public.expect_error($$insert into support_ticket_messages (ticket_id, organization_id, kind, body) select id, organization_id, 'reply', 'forged' from support_tickets$$, 'permission denied|row-level security', 'messages cannot be written directly');

-- ===== assignment =====
select public.expect_error(format('select public.support_ticket_assign(%L, %L)', :'tid', :'staff'), 'Organization Admin of this centre', 'a ticket can only be assigned to an administrator of the centre');
select public.expect_error(format('select public.support_ticket_assign(%L, %L)', :'tid', :'admB'), 'Organization Admin of this centre', 'not to an administrator of another centre');
select public.support_ticket_assign(:'tid', :'admA');
select public.assert((select assigned_to from support_tickets where id = :'tid') = :'admA', 'assigned');
select public.assert((select (it_dashboard()->'tickets'->>'assigned_to_me')::int from (select 1) x) = 1, 'the dashboard counts tickets assigned to me');

-- ===== resolution =====
select public.expect_error(format('select public.support_ticket_set_status(%L, ''resolved'', ''ok'')', :'tid'), 'how the problem was resolved', 'resolving needs a recorded resolution');
select public.support_ticket_set_status(:'tid', 'resolved', 'Password reset and account unlocked; confirmed with the user.');
select public.assert((select status = 'resolved' and resolved_at is not null and resolution_notes like 'Password reset%' from support_tickets where id = :'tid'), 'resolved with the notes recorded');
select set_config('request.jwt.claim.sub', :'req', false);
select public.assert((select count(*) from support_ticket_messages where ticket_id = :'tid' and kind = 'resolution') = 1, 'the requester sees the resolution');
select public.support_ticket_add_message(:'tid', 'It happened again this morning.', false);
select public.assert((select status from support_tickets where id = :'tid') = 'open', 'a reply from the requester reopens a resolved ticket');

-- ===== escalation =====
select set_config('request.jwt.claim.sub', :'req', false);
select public.expect_error(format('select public.support_ticket_escalate(%L, %L)', :'tid', 'Not an administrator but trying to escalate this'), 'Organization Admin can escalate', 'the requester cannot escalate');
select set_config('request.jwt.claim.sub', :'admA', false);
select public.expect_error(format('select public.support_ticket_escalate(%L, %L)', :'tid', 'too short'), 'at least 20', 'an escalation needs a real description');
select public.support_ticket_escalate(:'tid', 'Reset the password twice and the account keeps locking; looks like an authentication service fault.');
select public.assert((select escalation_status = 'escalated' and escalated_by = :'admA' from support_tickets where id = :'tid'), 'escalated to the Super Admin');
select public.expect_error(format('select public.support_ticket_escalate(%L, %L)', :'tid', 'Escalating it a second time for the same problem'), 'already been escalated', 'a ticket is escalated once at a time');
select public.expect_error(format('select public.support_ticket_set_status(%L, ''resolved'', ''Trying to resolve it myself while escalated'')', :'tid'), 'with the Super Admin', 'the centre cannot resolve a ticket while it is with the Super Admin');
select public.assert((select (it_dashboard()->'tickets'->>'escalated')::int from (select 1) x) = 1, 'the dashboard counts escalated tickets');
reset role;
select public.assert((select count(*) from notifications where user_id = :'sup' and title like 'Escalated ticket%') = 1, 'the Super Admin is notified');
set role authenticated; select set_config('request.jwt.claim.sub', :'admA', false);
select set_config('request.jwt.claim.sub', :'req', false);
select public.assert((select count(*) from support_ticket_messages where ticket_id = :'tid' and kind = 'escalation') = 0, 'the escalation note is internal (the requester does not see it)');

select set_config('request.jwt.claim.sub', :'admA', false);
select public.expect_error(format('select public.support_ticket_super_action(%L, ''return'', ''Trying to answer my own escalation'')', :'tid'), 'Only the Super Admin', 'only the Super Admin responds to an escalation');
select set_config('request.jwt.claim.sub', :'sup', false);
select public.expect_error(format('select public.support_ticket_super_action(%L, ''return'', ''short'')', :'tid'), 'at least 10', 'the response must say something');
select public.support_ticket_super_action(:'tid', 'return', 'The auth service lockout threshold is per centre; clear the failed attempts from Role Management and retry.');
select public.assert((select escalation_status from support_tickets where id = :'tid') = 'returned', 'returned to the centre with guidance');
select set_config('request.jwt.claim.sub', :'admA', false);
select public.assert((select count(*) from support_ticket_messages where ticket_id = :'tid' and kind = 'escalation_response') = 1, 'the centre reads the guidance');
select public.assert((select (it_dashboard()->'tickets'->>'returned')::int from (select 1) x) = 1, 'the dashboard shows tickets returned with guidance');
select public.support_ticket_set_status(:'tid', 'resolved', 'Cleared the failed attempts as advised; the user can sign in again.');
select public.assert((select status from support_tickets where id = :'tid') = 'resolved', 'the centre resolves a ticket the Super Admin returned');

-- a second ticket resolved by the Super Admin
set role authenticated; select set_config('request.jwt.claim.sub', :'req', false);
insert into support_tickets (organization_id, user_id, subject, description, priority) values (:'orgA', :'req', 'Report export fails', 'The export shows an error', 'medium');
reset role;
select id as tid2 from support_tickets where subject = 'Report export fails' \gset
set role authenticated; select set_config('request.jwt.claim.sub', :'admA2', false);
select public.support_ticket_escalate(:'tid2', 'Export error persists after clearing the cache and retrying; needs a server-side look.');
select set_config('request.jwt.claim.sub', :'sup', false);
select public.support_ticket_super_action(:'tid2', 'resolve', 'Fixed a configuration fault on the server; the export works again.');
select public.assert((select status = 'resolved' and escalation_status = 'resolved' from support_tickets where id = :'tid2'), 'the Super Admin can resolve an escalated ticket');
reset role;

-- ===== dashboards: the administrator only =====
set role authenticated; select set_config('request.jwt.claim.sub', :'staff', false);
select public.expect_error($$select public.it_dashboard()$$, 'Not authorised', 'other staff cannot read the IT dashboard');
select public.expect_error($$select public.it_system_status()$$, 'Not authorised', 'nor the system status');
select set_config('request.jwt.claim.sub', :'admA', false);
select public.assert(jsonb_typeof(it_dashboard()->'queue') = 'array' and jsonb_typeof(it_dashboard()->'activity') = 'array' and jsonb_typeof(it_system_status()->'account_setup_failures') = 'array', 'the dashboard and system status return real lists');
select public.assert((select (it_dashboard()->'accounts'->>'total')::int from (select 1) x) >= 4, 'the account overview counts the centre''s users');
select set_config('request.jwt.claim.sub', :'admB', false);
select public.assert((select (it_dashboard()->'tickets'->>'escalated')::int from (select 1) x) = 0, 'another centre''s dashboard shows none of this centre''s tickets');
reset role;

-- ===== finance: read-only, no override =====
insert into financial_queue (organization_id, entity_type, entity_id, amount, amount_paid, status, description) values (:'orgA', 'APPLICATION', gen_random_uuid(), 100, 0, 'pending', 'test');
insert into billing_records (organization_id, amount, status, invoice_no) values (:'orgA', 10, 'pending', 'T-1');
insert into department_budgets (organization_id, department, budget_year, total_budget, spent_amount) values (:'orgA', 'IT', '2027', 1000, 0);
insert into finance_settings (organization_id, auto_draft_invoices, invoice_due_days) values (:'orgA', false, 14) on conflict (organization_id) do update set auto_draft_invoices = false, invoice_due_days = 14;
insert into trainee_financial_accounts (organization_id, account_number, total_fees, total_paid) values (:'orgA', 'ACC-T1', 100, 0);
set role authenticated; select set_config('request.jwt.claim.sub', :'admA', false);
select public.assert((select count(*) from financial_queue where organization_id = 'a0000000-0000-0000-0000-00000000000a') = 1, 'the administrator can read the fee queue');
update financial_queue set amount_paid = 100, status = 'cleared';
update billing_records set status = 'paid';
update department_budgets set total_budget = 1;
update finance_settings set invoice_due_days = 1;
update trainee_financial_accounts set total_paid = 100;
select public.expect_error($$insert into financial_queue (organization_id, entity_type, entity_id, amount, status) values ('a0000000-0000-0000-0000-00000000000a','APPLICATION', gen_random_uuid(), 1, 'pending')$$, 'row-level security', 'the administrator cannot add to the fee queue');
delete from financial_queue; delete from billing_records; delete from department_budgets; delete from trainee_financial_accounts;
reset role;
select public.assert((select status = 'pending' and amount_paid = 0 from financial_queue where organization_id = :'orgA'), 'the administrator cannot mark a fee as paid');
select public.assert((select status = 'pending' from billing_records where organization_id = :'orgA') and (select total_budget = 1000 from department_budgets where organization_id = :'orgA')
  and (select invoice_due_days = 14 from finance_settings where organization_id = :'orgA') and (select total_paid = 0 from trainee_financial_accounts where organization_id = :'orgA'), 'nor change billing, budgets, finance settings or a trainee''s financial account');
select public.assert((select count(*) from financial_queue where organization_id = :'orgA') = 1 and (select count(*) from billing_records where organization_id = :'orgA') = 1 and (select count(*) from department_budgets where organization_id = :'orgA') = 1 and (select count(*) from trainee_financial_accounts where organization_id = :'orgA') = 1, 'nor delete any of them');
set role authenticated; select set_config('request.jwt.claim.sub', :'deb', false);
update financial_queue set amount_paid = 100, status = 'cleared' where organization_id = 'a0000000-0000-0000-0000-00000000000a';
reset role;
select public.assert((select status = 'cleared' from financial_queue where organization_id = :'orgA'), 'the debtor officer can still process the fee queue');

-- ===== trainee records: the administrator cannot delete them =====
select count(*) as n_tr from trainees where organization_id = :'orgA' \gset
select count(*) as n_ap from trainee_applications where organization_id = :'orgA' \gset
select count(*) as n_rg from registrations where organization_id = :'orgA' \gset
set role authenticated; select set_config('request.jwt.claim.sub', :'admA', false);
delete from trainees where organization_id = 'a0000000-0000-0000-0000-00000000000a';
delete from trainee_applications where organization_id = 'a0000000-0000-0000-0000-00000000000a';
delete from registrations where organization_id = 'a0000000-0000-0000-0000-00000000000a';
reset role;
select public.assert((select count(*) from trainees where organization_id = :'orgA') = :n_tr and (select count(*) from trainee_applications where organization_id = :'orgA') = :n_ap and (select count(*) from registrations where organization_id = :'orgA') = :n_rg, 'the administrator cannot delete trainee, application or registration records');

-- ===== audit: what an administrator changes in these tables is recorded =====
select public.assert((select count(*) from admin_audit_log where actor_id = :'admA' and action in ('support_tickets.update')) >= 1, 'ticket handling by the administrator appears in the audit trail');
select public.assert((select count(*) from admin_audit_log where action = 'ticket.escalated' and actor_id = :'admA') = 1, 'the escalation is logged');
select public.assert((select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgname = 'trg_audit_admin_change' and c.relname in ('trainees','trainee_applications','registrations','financial_queue','trainee_financial_accounts','billing_records','finance_settings','department_budgets','password_policies','support_tickets')) = 10, 'the sensitive administrator-writable tables are audited');
select 'OK it support, escalation, finance limits and audit';
