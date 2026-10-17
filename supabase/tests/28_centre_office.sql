\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set cm '98888888-0000-0000-0000-000000000001'
\set pa '98888888-0000-0000-0000-000000000002'
\set acc '98888888-0000-0000-0000-000000000003'
\set paB '98888888-0000-0000-0000-000000000004'

insert into auth.users (id,email) values (:'cm','cm5@a.test'),(:'pa','pa5@a.test'),(:'acc','acc5@a.test'),(:'paB','pab5@b.test') on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id in (:'cm',:'pa',:'acc',:'paB') on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'cm','centre_manager',:'orgA'),(:'pa','pa_to_centre_manager',:'orgA'),(:'acc','accountant',:'orgA'),(:'paB','pa_to_centre_manager',:'orgB');
alter table user_roles enable trigger trg_guard_privileged_roles;

set role authenticated; select set_config('request.jwt.claim.sub', :'pa', false);
select public.expect_error($$insert into office_tasks (organization_id, title) values ('a0000000-0000-0000-0000-00000000000a','x')$$, 'row-level security', 'clients cannot write the register directly');
select public.office_log_correspondence('incoming', 'Ministry circular', 'Ministry of Education', 'letter', current_date - 3, current_date - 1) as c1 \gset
select public.office_log_correspondence('outgoing', 'Reply to Ministry', 'Ministry of Education') as c2 \gset
select public.assert((select reference ~ '^COR-[0-9]{4}-0001$' and status = 'received' from office_correspondence where id = :'c1'), 'incoming item numbered and received');
select public.assert((select reference ~ '-0002$' and status = 'replied' from office_correspondence where id = :'c2'), 'outgoing item numbered and logged as replied');
select public.expect_error($$select public.office_log_correspondence('incoming', ' ', 'x')$$, 'subject', 'subject required');
select public.expect_error($$select public.office_log_correspondence('incoming', 's', 'p', 'letter', current_date, current_date - 5)$$, 'due date', 'due date cannot precede the item');
select public.expect_error($$select public.office_log_correspondence('incoming', 's', 'p', 'letter', current_date, null, 'b0000000-0000-0000-0000-00000000000b/x.pdf')$$, 'centre', 'documents stay in the centre folder');
select public.office_set_correspondence_status(:'c1', 'in_progress', 'Drafting reply');
select public.office_add_meeting('Heads of department', current_date + 2, '09:00', '10:00', 'Boardroom') as m1 \gset
select public.expect_error($$select public.office_add_meeting('Bad', current_date, '10:00', '09:00')$$, 'end_time|violates', 'meeting must end after it starts');
select public.office_add_task('Prepare briefing', current_date - 1, null, 'centre_manager', :'c1', :'m1') as t1 \gset
select public.office_set_task_status(:'t1', 'done');
select public.assert((select status = 'done' and completed_at is not null from office_tasks where id = :'t1'), 'task completed');

-- the PA cannot see anything outside the office registers
select public.assert((select count(*) from fee_records) = 0 and (select count(*) from funding_records) = 0 and (select count(*) from qualification_results) = 0, 'PA reads no finance, funding or results records');
select public.expect_error($$select public.centre_manager_executive()$$, 'Not authorised', 'PA has no executive view');
select public.assert(jsonb_typeof(public.office_delegation_log()->'delegations') = 'array', 'PA sees the delegation log');

-- Centre Manager: reads, cannot change
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((select count(*) from office_correspondence) = 2 and (select count(*) from office_meetings) = 1, 'Centre Manager reads the office registers');
select public.expect_error($$select public.office_add_task('nope')$$, 'Not authorised', 'Centre Manager does not edit the register');
select public.expect_error(format('select public.office_set_task_status(%L, ''open'')', :'t1'), 'Not authorised', 'Centre Manager cannot reopen tasks');
select public.assert(jsonb_array_length(public.centre_manager_executive()->'departments') = 4, 'executive view lists four departments');
select public.assert(jsonb_typeof(public.centre_manager_executive()->'escalated') = 'array', 'executive view lists escalated approvals');
select public.assert((public.centre_manager_executive()->'office'->>'correspondence_overdue')::int = 1 and (public.centre_manager_executive()->'office'->>'correspondence_open')::int = 1, 'office figures reach the executive view');
select public.assert(public.centre_manager_executive()->'departments'->0->'kpis' ? 'collection_rate', 'finance department carries its indicators');

-- other roles and other centres
select set_config('request.jwt.claim.sub', :'acc', false);
select public.assert((select count(*) from office_correspondence) = 0 and (select count(*) from office_tasks) = 0, 'other staff read nothing');
select public.expect_error($$select public.centre_manager_executive()$$, 'Not authorised', 'executive view is for the Centre Manager');
select public.expect_error($$select public.office_delegation_log()$$, 'Not authorised', 'delegation log is for the office');
select set_config('request.jwt.claim.sub', :'paB', false);
select public.assert((select count(*) from office_correspondence) = 0, 'another centre''s PA sees nothing');
select public.expect_error(format('select public.office_set_task_status(%L, ''open'')', :'t1'), 'Not authorised', 'cannot touch another centre''s tasks');

reset role;
select public.expect_error($$delete from office_tasks$$, 'cannot be deleted', 'office records are never deleted');
select 'OK centre office';
