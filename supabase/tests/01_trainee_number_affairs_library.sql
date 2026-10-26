\set ON_ERROR_STOP on
select set_config('app.legacy_import', 'on', false);
\set admin '11111111-0000-0000-0000-000000000001'
\set lib '11111111-0000-0000-0000-000000000002'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set outsider '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'

-- ===== trainee numbers: one global format, issued only by the identity service =====
select public.expect_error($$select public.generate_trainee_number('a0000000-0000-0000-0000-00000000000a')$$, 'Retired', 'the per-centre generator is retired');
select public.expect_error($$select public.generate_trainee_id('a0000000-0000-0000-0000-00000000000a')$$, 'Retired', 'generate_trainee_id is retired');
select public.expect_error($$select public.generate_continuous_trainee_number('a0000000-0000-0000-0000-00000000000a')$$, 'Retired', 'generate_continuous_trainee_number is retired');
-- a row inserted with a made-up number gets a real one (the number is never taken from the caller)
reset role;
select set_config('app.legacy_import', 'off', false);
insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id)
 values (:'orgA','Auto','Number','male','2000-01-01','ID-AUTO-0001','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','MADE-UP-1');
select public.assert((select trainee_id from trainees where first_name='Auto') ~ '^[0-9]{9}$' and (select trainee_id from trainees where first_name='Auto') <> 'MADE-UP-1', 'the database issues a nine-digit number');
select set_config('app.legacy_import', 'on', false);
select 'OK trainee number';

-- ===== Trainee affairs RLS =====
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
insert into trainee_affairs_records (organization_id, trainee_id, record_type, title, description)
 values (:'orgA','d0000000-0000-0000-0000-000000000001','incident','Fight','details');
select public.assert((select count(*) from trainee_affairs_records) = 1, 'staff sees affairs record');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from trainee_affairs_records) = 0, 'trainee cannot see incidents');
select public.expect_error($$insert into trainee_affairs_records (organization_id, trainee_id, record_type, title, description, recorded_by) values ('a0000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-000000000001','discipline','x','y','11111111-0000-0000-0000-000000000003')$$, 'row-level security', 'trainee cannot self-record discipline');
insert into trainee_affairs_records (organization_id, trainee_id, record_type, title, description, recorded_by)
 values (:'orgA','d0000000-0000-0000-0000-000000000001','grievance','Noise','loud', :'tr1');
select public.assert((select count(*) from trainee_affairs_records) = 1, 'trainee sees own grievance only');
select public.expect_error($$insert into trainee_affairs_records (organization_id, trainee_id, record_type, title, description, recorded_by) values ('a0000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-000000000002','grievance','x','y','11111111-0000-0000-0000-000000000003')$$, 'row-level security', 'trainee cannot file grievance as another trainee');
-- anonymous suggestion: insert ok, cannot read back, no author column
insert into anonymous_submissions (organization_id, kind, message) values (:'orgA','suggestion','more tools');
select public.assert((select count(*) from anonymous_submissions) = 0, 'submitter cannot read anonymous submissions');
select public.assert(not exists (select 1 from information_schema.columns where table_name='anonymous_submissions' and column_name ilike '%user%'), 'no user column on anonymous submissions');
select public.expect_error($$insert into anonymous_submissions (organization_id, kind, message) values ('b0000000-0000-0000-0000-00000000000b','suggestion','x')$$, 'row-level security', 'cannot submit into another org');
select public.expect_error($$insert into anonymous_submissions (organization_id, kind, message) values ('a0000000-0000-0000-0000-00000000000a','trainer_evaluation','no trainer')$$, 'check constraint', 'evaluation needs trainer and rating');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from anonymous_submissions) = 1, 'staff reads anonymous submissions');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from trainee_affairs_records) = 0 and (select count(*) from anonymous_submissions) = 0, 'other org sees nothing');
reset role;
select 'OK trainee affairs';

-- ===== Library =====
set role authenticated; select set_config('request.jwt.claim.sub', :'lib', false);
insert into library_items (id, organization_id, title, total_copies, available_copies, barcode)
 values ('aa000000-0000-0000-0000-000000000001', :'orgA', 'Welding 101', 1, 1, 'BC1');
insert into library_members (id, organization_id, member_type, full_name, user_id, status)
 values ('bb000000-0000-0000-0000-000000000001', :'orgA', 'trainee', 'Tina One', :'tr1', 'active'),
        ('bb000000-0000-0000-0000-000000000002', :'orgA', 'trainee', 'Tom Two', :'tr2', 'active');
select public.assert((select member_number from library_members where id='bb000000-0000-0000-0000-000000000001') ~ '^LIB[0-9]{7}$', 'member number generated');
insert into library_borrowing (organization_id, library_item_id, borrower_id, due_date, issued_by)
 values (:'orgA','aa000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000001', current_date - 5, :'lib');
select public.assert((select available_copies from library_items where id='aa000000-0000-0000-0000-000000000001') = 0, 'borrow decrements copies');
select public.expect_error($$insert into library_borrowing (organization_id, library_item_id, borrower_id, due_date, issued_by) values ('a0000000-0000-0000-0000-00000000000a','aa000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000002', current_date+7, '11111111-0000-0000-0000-000000000002')$$, 'No copies', 'cannot borrow with no copies');
-- overdue sweep
select public.assert(public.library_process_overdue(:'orgA') = 1, 'sweep finds one overdue loan');
select public.assert((select status from library_borrowing limit 1)::text = 'overdue', 'loan flagged overdue');
select public.assert((select fine_amount from library_fines limit 1) = 5.00 and (select days_overdue from library_fines limit 1) = 5, 'fine = 5 days x 1.00');
select public.assert(public.library_process_overdue(:'orgA') = 1 and (select count(*) from library_fines) = 1, 'second sweep does not duplicate fine');
select public.assert(public.t_notif_count(:'tr1'::uuid, null, 'library') >= 1, 'overdue notification sent');
-- Tom reserves, Tina returns => Tom notified & hold ready
select set_config('request.jwt.claim.sub', :'tr2', false);
insert into library_reservations (organization_id, library_item_id, member_id) values (:'orgA','aa000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000002');
select public.expect_error($$insert into library_reservations (organization_id, library_item_id, member_id) values ('a0000000-0000-0000-0000-00000000000a','aa000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000001')$$, 'row-level security', 'cannot reserve for another member');
select set_config('request.jwt.claim.sub', :'lib', false);
update library_borrowing set status='returned', return_date=current_date, returned_to=:'lib';
select public.assert((select available_copies from library_items where id='aa000000-0000-0000-0000-000000000001') = 1, 'return restores copy');
select public.assert((select status from library_reservations limit 1) = 'ready', 'reservation becomes ready');
select public.assert(public.t_notif_count(:'tr2'::uuid, 'Reserved item available') = 1, 'reserver notified');
-- fine payment trigger
update library_fines set amount_paid = 5.00;
select public.assert((select status from library_fines limit 1)::text = 'paid' and (select balance from library_fines limit 1) = 0, 'paying fine in full marks it paid');
-- lost items stop accruing
select set_config('request.jwt.claim.sub', :'lib', false);
-- non-staff cannot run sweep
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.library_process_overdue('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'trainee cannot run overdue sweep');
select public.expect_error($$select public.library_send_announcement('a0000000-0000-0000-0000-00000000000a','t','m')$$, 'Not authorised', 'trainee cannot announce');
select set_config('request.jwt.claim.sub', :'lib', false);
select public.assert(public.library_send_announcement(:'orgA','Closed','Library closed Friday') = 2, 'announcement reaches active members with accounts');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from library_members) = 0 and (select count(*) from library_items) = 0, 'other org sees no library data');
reset role;
select 'OK library';
