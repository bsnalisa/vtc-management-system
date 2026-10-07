\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set trainerA '11111111-0000-0000-0000-000000000004'
\set outsider '11111111-0000-0000-0000-000000000007'
\set regoff '44444444-0000-0000-0000-000000000001'
\set hot '44444444-0000-0000-0000-000000000002'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set Q 'e0000000-0000-0000-0000-000000000001'

insert into auth.users (id,email) values (:'regoff','regoff@a.test'), (:'hot','hot@a.test');
update profiles p set full_name = split_part(u.email,'@',1), email = u.email from auth.users u where u.id = p.user_id and u.id in (:'regoff',:'hot');
insert into user_roles (user_id, role, organization_id) values (:'regoff','registration_officer',:'orgA'), (:'hot','head_of_training',:'orgA');

-- ===== applications =====
-- (applications may prefer any training mode, including the newer ones)
insert into trainee_applications (organization_id, first_name, last_name, gender, date_of_birth, national_id, phone, address, trade_id, preferred_training_mode, intake, academic_year, created_by, application_source)
 values (:'orgA', 'Mo', 'Apprentice', 'male', '2005-01-01', 'APPM', '0810', 'x', 'c0000000-0000-0000-0000-000000000001', 'apprenticeship', 'january', '2026', :'admin', 'manual'),
        (:'orgA', 'Ro', 'Rpl', 'male', '2005-01-01', 'APPR', '0809', 'x', 'c0000000-0000-0000-0000-000000000001', 'rpl', 'july', '2026', :'admin', 'manual');
select public.assert((select count(*) from trainee_applications where preferred_training_mode in ('apprenticeship','rpl')) = 2, 'applications can prefer apprenticeship or RPL');
delete from trainee_applications; delete from notifications; delete from outbound_messages;

insert into trainee_applications (id, organization_id, first_name, last_name, gender, date_of_birth, national_id, phone, address, trade_id, preferred_training_mode, intake, academic_year, created_by, email, application_source)
 values ('a9000000-0000-0000-0000-000000000001', :'orgA', 'Anna', 'Applicant', 'female', '2005-01-01', 'APP1', '0811', 'x', 'c0000000-0000-0000-0000-000000000001', 'fulltime', 'january', '2026', :'admin', 'anna@example.com', 'online');
select public.assert((select count(*) from outbound_messages where recipient = 'anna@example.com' and subject like 'Application received: %') = 1, 'applicant emailed on submission');
select public.assert((select body from outbound_messages where recipient = 'anna@example.com') like '%' || (select application_number from trainee_applications where id='a9000000-0000-0000-0000-000000000001') || '%', 'email quotes the reference number');
select public.assert(public.t_notif_count(:'regoff'::uuid, 'New online application%', 'application') = 1, 'registration officer notified in-app');
select public.assert((select count(*) from outbound_messages where recipient = 'regoff@a.test' and subject like 'New online application%') = 1, 'registration officer emailed');
select public.assert(public.t_notif_count(:'admin'::uuid, null, 'application') = 0, 'other staff are not notified');
-- staff-captured application: applicant told, officers not
insert into trainee_applications (id, organization_id, first_name, last_name, gender, date_of_birth, national_id, phone, address, trade_id, preferred_training_mode, intake, academic_year, created_by, email, application_source)
 values ('a9000000-0000-0000-0000-000000000002', :'orgA', 'Bob', 'Manual', 'male', '2005-01-01', 'APP2', '0812', 'x', 'c0000000-0000-0000-0000-000000000001', 'fulltime', 'january', '2026', :'admin', 'bob@example.com', 'manual');
select public.assert((select count(*) from outbound_messages where recipient = 'bob@example.com') = 1, 'applicant of a staff-captured application is emailed');
select public.assert(public.t_notif_count(:'regoff'::uuid, 'New online application%', 'application') = 1, 'officers are not told about applications they captured themselves');
-- no email address / bad address: no error, nothing queued
insert into trainee_applications (id, organization_id, first_name, last_name, gender, date_of_birth, national_id, phone, address, trade_id, preferred_training_mode, intake, academic_year, created_by, email, application_source)
 values ('a9000000-0000-0000-0000-000000000003', :'orgA', 'Cy', 'NoMail', 'male', '2005-01-01', 'APP3', '0813', 'x', 'c0000000-0000-0000-0000-000000000001', 'fulltime', 'january', '2026', :'admin', null, 'manual'),
        ('a9000000-0000-0000-0000-000000000004', :'orgA', 'Di', 'BadMail', 'female', '2005-01-01', 'APP4', '0814', 'x', 'c0000000-0000-0000-0000-000000000001', 'fulltime', 'january', '2026', :'admin', 'not-an-email', 'manual');
select public.assert((select count(*) from outbound_messages where recipient in ('not-an-email','')) = 0, 'no email queued for a missing or invalid address');
-- applicant with an account gets an in-app notice
insert into trainee_applications (id, organization_id, first_name, last_name, gender, date_of_birth, national_id, phone, address, trade_id, preferred_training_mode, intake, academic_year, created_by, email, application_source, user_id)
 values ('a9000000-0000-0000-0000-000000000005', :'orgA', 'Eve', 'Account', 'female', '2005-01-01', 'APP5', '0815', 'x', 'c0000000-0000-0000-0000-000000000001', 'fulltime', 'january', '2026', :'admin', null, 'manual', :'tr1');
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Application received%', 'application') = 1, 'applicant with an account gets an in-app notice');
-- screening
update trainee_applications set qualification_status = 'provisionally_qualified' where id = 'a9000000-0000-0000-0000-000000000001';
select public.assert((select count(*) from outbound_messages where recipient = 'anna@example.com' and subject like '%screened') = 1, 'applicant emailed when screened');
select public.assert((select body from outbound_messages where subject like '%screened' and recipient = 'anna@example.com') like '%provisionally qualify%', 'provisional wording');
update trainee_applications set phone = '0999' where id = 'a9000000-0000-0000-0000-000000000001';
update trainee_applications set qualification_status = 'provisionally_qualified' where id = 'a9000000-0000-0000-0000-000000000001';
select public.assert((select count(*) from outbound_messages where recipient = 'anna@example.com' and subject like '%screened') = 1, 'no repeat email for unrelated edits or an unchanged status');
update trainee_applications set qualification_status = 'does_not_qualify' where id = 'a9000000-0000-0000-0000-000000000002';
select public.assert((select body from outbound_messages where recipient = 'bob@example.com' and subject like '%screened') like '%does not currently meet%', 'not-qualified wording is neutral and offers contact');
select 'OK application notifications';

-- ===== exam timetables =====
update trainees set email = 'tina@example.com' where id = 'd0000000-0000-0000-0000-000000000001';
insert into trainers (id, organization_id, user_id, trainer_id, full_name) values ('70000000-0000-0000-0000-0000000000a1', :'orgA', :'trainerA', 'TA', 'Trainer A');
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year, qualification_id, trainer_id)
 values ('71000000-0000-0000-0000-0000000000a1', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'fulltime', 'W1', 'Welding A', '2026', :'Q', '70000000-0000-0000-0000-0000000000a1');
delete from notifications; delete from outbound_messages;
insert into invigilators (id, organization_id, full_name, email) values ('1a000000-0000-0000-0000-000000000001', :'orgA', 'Ivan Invigilator', 'ivan@example.com');
insert into exam_timetables (id, organization_id, qualification_id, academic_year, subject_name, exam_date, start_time, end_time, venue, created_by, published, invigilator_id, level)
 values ('ea000000-0000-0000-0000-000000000001', :'orgA', :'Q', '2026', 'Welding theory', current_date + 14, '09:00', '12:00', 'Hall A', :'admin', false, '1a000000-0000-0000-0000-000000000001', 1);
select public.assert((select count(*) from notifications) = 0 and (select count(*) from outbound_messages) = 0, 'saving an unpublished timetable notifies nobody');
update exam_timetables set published = true, published_at = now() where id = 'ea000000-0000-0000-0000-000000000001';
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Exam timetable: Welding theory', 'assessment') = 1 and public.t_notif_count(:'tr2'::uuid, 'Exam timetable: Welding theory', 'assessment') = 1, 'both candidates notified in-app');
select public.assert(public.t_notif_count(:'hot'::uuid, 'Exam timetable: Welding theory', 'assessment') = 1, 'Head of Training notified');
select public.assert(public.t_notif_count(:'trainerA'::uuid, 'Exam timetable: Welding theory', 'assessment') = 1, 'class trainer notified exactly once');
select public.assert((select count(*) from outbound_messages where recipient = 'ivan@example.com') = 1, 'external invigilator emailed once');
select public.assert(public.t_notif_count(:'admin'::uuid, null, 'assessment') = 0 and public.t_notif_count(:'regoff'::uuid, null, 'assessment') = 0, 'unrelated staff are not notified');
select public.assert((select count(*) from outbound_messages where recipient = 'tina@example.com') = 1 and (select count(*) from outbound_messages where recipient = 'hot@a.test') = 1, 'emails go to candidates with an address and to staff');
select public.assert((select body from outbound_messages where recipient = 'tina@example.com') like '%09:00-12:00 at Hall A%', 'message carries date, time and venue');
update exam_timetables set notes = 'bring tools' where id = 'ea000000-0000-0000-0000-000000000001';
select public.assert(public.t_notif_count(:'tr1'::uuid, null, 'assessment') = 1, 'an unrelated edit does not re-notify');
update exam_timetables set venue = 'Hall B', start_time = '10:00' where id = 'ea000000-0000-0000-0000-000000000001';
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Exam timetable changed: Welding theory', 'assessment') = 1, 'a change after publication re-notifies candidates');
select public.assert((select body from outbound_messages where recipient = 'tina@example.com' and subject like 'Exam timetable changed%') like '%10:00-12:00 at Hall B%', 'change message has the new details');
-- level filter: a level 2 exam does not reach level 1 trainees
delete from notifications;
insert into exam_timetables (organization_id, qualification_id, academic_year, subject_name, exam_date, created_by, published, level)
 values (:'orgA', :'Q', '2026', 'Level 2 practical', current_date + 20, :'admin', true, 2);
select public.assert(public.t_notif_count(:'tr1'::uuid, null, 'assessment') = 0, 'candidates on another level are not notified');
select public.assert(public.t_notif_count(:'hot'::uuid, null, 'assessment') = 1, 'Head of Training still notified');
-- withdrawn / inactive trainees are skipped
update trainees set status = 'withdrawn' where id = 'd0000000-0000-0000-0000-000000000002';
delete from notifications;
insert into exam_timetables (organization_id, qualification_id, academic_year, subject_name, exam_date, created_by, published, level)
 values (:'orgA', :'Q', '2026', 'Safety', current_date + 30, :'admin', true, 1);
select public.assert(public.t_notif_count(:'tr2'::uuid, null, 'assessment') = 0 and public.t_notif_count(:'tr1'::uuid, null, 'assessment') = 1, 'only active trainees are candidates');
-- another centre is untouched
select public.assert(public.t_notif_count(:'outsider'::uuid, null, 'assessment') = 0, 'other centre not notified');
-- what they were told about must be visible to them in the portal
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from exam_timetables where subject_name = 'Welding theory') = 1, 'candidate can see the published timetable they were notified about');
select public.assert((select count(*) from exam_timetables where subject_name = 'Level 2 practical') = 0, 'but not an exam for another level');
reset role;
update exam_timetables set published = false where subject_name = 'Welding theory';
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from exam_timetables where subject_name = 'Welding theory') = 0, 'unpublishing hides it again');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from exam_timetables) = 0, 'other centres see no timetables');
reset role;
update exam_timetables set published = true where subject_name = 'Welding theory';
delete from notifications where type = 'assessment';
select 'OK exam timetable notifications';

-- ===== event reminders =====
update trainees set status = 'active' where id = 'd0000000-0000-0000-0000-000000000002';
delete from notifications; delete from outbound_messages;
insert into extracurricular_events (id, organization_id, title, category, start_date, location, reminder_days_before, created_by) values
 ('ee000000-0000-0000-0000-000000000001', :'orgA', 'Sports day', 'sport', now() + interval '2 days', 'Field', 3, :'admin'),
 ('ee000000-0000-0000-0000-000000000002', :'orgA', 'Career fair', 'trade_fair', now() + interval '10 days', 'Hall', 1, :'admin'),
 ('ee000000-0000-0000-0000-000000000003', :'orgA', 'Past event', 'other', now() - interval '1 day', null, 2, :'admin');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.extracurricular_send_reminders('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'trainees cannot trigger reminders');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert(public.extracurricular_send_reminders(:'orgA') = 1, 'only the event inside its reminder window is sent');
reset role;
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Reminder: Sports day', 'general') = 1 and public.t_notif_count(:'tr2'::uuid, 'Reminder: Sports day', 'general') = 1, 'active trainees get the reminder');
select public.assert((select count(*) from outbound_messages where recipient = 'tina@example.com' and subject = 'Reminder: Sports day') = 1, 'and an email when they have an address');
select public.assert((select reminder_sent from extracurricular_events where id = 'ee000000-0000-0000-0000-000000000001') and not (select reminder_sent from extracurricular_events where id = 'ee000000-0000-0000-0000-000000000002'), 'sent event marked, later event untouched');
select public.assert((select reminder_sent from extracurricular_events where id = 'ee000000-0000-0000-0000-000000000003') and public.t_notif_count(:'tr1'::uuid, 'Reminder: Past event', null) = 0, 'past events are closed silently, nobody is told about the past');
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert(public.extracurricular_send_reminders(:'orgA') = 0, 'a reminder is sent only once');
-- moving the date queues a fresh reminder
update extracurricular_events set start_date = now() + interval '1 day' where id = 'ee000000-0000-0000-0000-000000000001';
select public.assert(public.extracurricular_send_reminders(:'orgA') = 1, 'rescheduled event is reminded again');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.expect_error($$select public.extracurricular_send_reminders('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'another centre cannot trigger our reminders');
reset role;
-- the scheduler (service role) can run it
update extracurricular_events set reminder_sent = false, start_date = now() + interval '1 day' where id = 'ee000000-0000-0000-0000-000000000002';
set role service_role; select set_config('request.jwt.claim.role', 'service_role', false); select set_config('request.jwt.claim.sub', '', false);
select public.assert(public.extracurricular_send_reminders(:'orgA') = 1, 'the scheduled job (service role) can send reminders');
reset role; select set_config('request.jwt.claim.role', '', false);
select 'OK event reminders';
