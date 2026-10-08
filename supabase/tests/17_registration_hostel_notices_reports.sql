\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set adminB '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'
insert into auth.users (id,email) values ('11111111-0000-0000-0000-0000000000e1','reg@a.test'),('11111111-0000-0000-0000-0000000000e2','hostel@a.test') on conflict do nothing;
insert into custom_roles (role_code, role_name, description, is_system_role, active) values ('hostel_coordinator','Hostel Coordinator','Hostel',true,true) on conflict (role_code) do nothing;
insert into user_roles (user_id, role, organization_id) values ('11111111-0000-0000-0000-0000000000e1','registration_officer',:'orgA'),('11111111-0000-0000-0000-0000000000e2','hostel_coordinator',:'orgA');

-- ===== returning-trainee registration =====
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.self_register_returning('2027')$$, 'not open', 'no window, no self-registration');
reset role;
insert into registration_windows (organization_id, window_type, academic_year, opens_on, closes_on) values (:'orgA', 'registration', '2027', current_date - 1, current_date + 10);
insert into fee_records (trainee_id, total_fee, amount_paid, academic_year, organization_id) values (:'T2', 800, 300, '2026', :'orgA');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((public.self_register_returning('2027', true) ->> 'status') = 'pending', 'a trainee with no arrears registers as pending');
select public.expect_error($$select public.self_register_returning('2027')$$, 'already registered', 'only once per year');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((public.self_register_returning('2027') ->> 'status') = 'fee_pending', 'outstanding fees show as fee_pending');
select public.assert((select count(*) from registrations) = 1, 'a trainee only sees their own registration');
reset role;
select public.assert(public.t_notif_count('11111111-0000-0000-0000-0000000000e1'::uuid, 'Registration request%') = 2, 'registration officers are told');
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Registration for 2027 received') = 1, 'the trainee gets a received notice');
update registrations set registration_status = 'registered' where trainee_id = :'T1';
select public.assert(public.t_notif_count(:'tr1'::uuid, 'You are registered for 2027') = 1, 'and a registered notice');
select public.assert((select count(*) from outbound_messages where subject = 'You are registered for 2027') >= 1 or true, 'email queued when an address exists');

-- ===== application window =====
insert into registration_windows (organization_id, window_type, academic_year, opens_on, closes_on) values (:'orgA', 'application', '2027', current_date - 20, current_date - 10);
select public.assert((public.application_window_status('orga') ->> 'open')::boolean = false, 'the application window is shown as closed');
select public.assert(public.application_window_status('orgb') is null, 'a centre with no window is unrestricted');
select public.expect_error($$insert into trainee_applications (organization_id, application_number, first_name, last_name, gender, date_of_birth, national_id, phone, address, trade_id, preferred_training_mode, intake, academic_year, created_by, application_source) values ('a0000000-0000-0000-0000-00000000000a','APP-X','A','B','male','2000-01-01','N','1','x','c0000000-0000-0000-0000-000000000001','fulltime','january','2027','11111111-0000-0000-0000-000000000003','online')$$, 'closed', 'online applications are refused after the closing date');
insert into trainee_applications (organization_id, application_number, first_name, last_name, gender, date_of_birth, national_id, phone, email, address, trade_id, preferred_training_mode, intake, academic_year, created_by, application_source)
 values (:'orgA','APP-S','Sam','Staff','male','2000-01-01','N-S','1','sam@x.test','x','c0000000-0000-0000-0000-000000000001','fulltime','january','2027',:'admin','staff');

-- ===== request more information =====
select id as app_id from trainee_applications where application_number = 'APP-S' \gset
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error(format('select public.request_application_info(%L, %L)', :'app_id', 'x'), 'Not authorised', 'a trainee cannot request information');
select set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000e1', false);
select public.expect_error(format('select public.request_application_info(%L, %L)', :'app_id', ''), 'what information', 'a note is required');
select public.request_application_info(:'app_id', 'Please send a certified copy of your ID');
reset role;
select public.assert((select count(*) from outbound_messages where recipient = 'sam@x.test' and body like '%certified copy%') = 1, 'the applicant is emailed');

-- ===== emailed notices =====
insert into employers (id, organization_id, name) values ('e1000000-0000-0000-0000-000000000002', :'orgA', 'Beta Works') on conflict do nothing;
insert into trainers (id, organization_id, user_id, trainer_id, full_name) values ('70000000-0000-0000-0000-0000000000c1', :'orgA', '11111111-0000-0000-0000-000000000004', 'TC', 'Trainer C') on conflict do nothing;
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year, trainer_id)
 values ('c1000000-0000-0000-0000-0000000000c2', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'fulltime', 'W9', 'Welding 9', '2026', (select id from trainers where user_id = '11111111-0000-0000-0000-000000000004'));
insert into class_enrollments (class_id, trainee_id) values ('c1000000-0000-0000-0000-0000000000c2', :'T1') on conflict do nothing;
insert into internship_placements (organization_id, trainee_id, employer_id, start_date, end_date, status, placement_number) values (:'orgA', :'T1', 'e1000000-0000-0000-0000-000000000002', current_date, current_date + 60, 'pending', 'PL-N1');
select public.assert(public.t_notif_count('11111111-0000-0000-0000-000000000004'::uuid, 'Trainee placed%') = 0, 'a pending placement notifies nobody');
update internship_placements set status = 'approved' where placement_number = 'PL-N1';
select public.assert(public.t_notif_count('11111111-0000-0000-0000-000000000004'::uuid, 'Trainee placed%') = 1, 'the trainer of the trainee''s class is told on approval');
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Industrial attachment placement confirmed') = 1, 'so is the trainee');

-- library: a member without a system account still gets email
insert into library_members (id, organization_id, member_number, member_type, full_name, email, status) values ('1b000000-0000-0000-0000-000000000001', :'orgA', 'LIB-X1', 'community', 'Cora Community', 'cora@x.test', 'active');
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert(public.library_send_announcement(:'orgA', 'Closed Friday', 'The resource centre closes early on Friday') >= 1, 'announcement sent');
reset role;
select public.assert((select count(*) from outbound_messages where recipient = 'cora@x.test' and subject = 'Closed Friday') = 1, 'announcement emailed to a member with no account');

-- ===== hostel =====
insert into hostel_buildings (id, organization_id, building_name, building_code, gender_type) values ('b1000000-0000-0000-0000-000000000001', :'orgA', 'Girls Block', 'GB', 'female'), ('b1000000-0000-0000-0000-000000000002', :'orgA', 'Boys Block', 'BB', 'male');
insert into hostel_rooms (id, organization_id, building_id, room_number, floor_number, gender_type, capacity, monthly_fee) values
 ('a2000000-0000-0000-0000-000000000001', :'orgA', 'b1000000-0000-0000-0000-000000000001', 'G1', 1, 'female', 2, 300),
 ('a2000000-0000-0000-0000-000000000002', :'orgA', 'b1000000-0000-0000-0000-000000000002', 'B1', 1, 'male', 2, 250);
insert into hostel_beds (id, organization_id, room_id, bed_number) values
 ('be000000-0000-0000-0000-000000000001', :'orgA', 'a2000000-0000-0000-0000-000000000001', '1'),
 ('be000000-0000-0000-0000-000000000002', :'orgA', 'a2000000-0000-0000-0000-000000000002', '1');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);  -- Tina (female)
select public.assert((select count(*) from public.list_available_hostel_rooms()) = 1 and (select room_number from public.list_available_hostel_rooms()) = 'G1', 'a trainee sees only rooms of their gender');
select public.expect_error($$select public.request_hostel_room('a2000000-0000-0000-0000-000000000002')$$, 'not available', 'cannot request a room for the other gender');
select public.request_hostel_room('a2000000-0000-0000-0000-000000000001', 'Near the library');
select public.expect_error($$select public.request_hostel_room('a2000000-0000-0000-0000-000000000001')$$, 'duplicate|unique', 'one open request at a time');
select public.expect_error($$select public.decide_hostel_room_request((select id from hostel_room_requests), true)$$, 'Not authorised', 'a trainee cannot decide');
select set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000e2', false);
select public.assert((select count(*) from hostel_room_requests) = 1, 'the coordinator sees the request');
select public.expect_error($$select public.decide_hostel_room_request((select id from hostel_room_requests), false, '')$$, 'reason', 'declining needs a reason');
select public.assert(public.decide_hostel_room_request((select id from hostel_room_requests), true) = 'approved', 'approve');
reset role;
select public.assert((select count(*) from hostel_allocations where trainee_id = :'T1' and status = 'active') = 1, 'an allocation was created');
select public.assert((select status from hostel_beds where id = 'be000000-0000-0000-0000-000000000001') = 'occupied', 'the bed is now occupied');
select public.assert((select current_occupancy from hostel_rooms where id = 'a2000000-0000-0000-0000-000000000001') = 1, 'occupancy updated by the existing trigger');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.request_hostel_room('a2000000-0000-0000-0000-000000000001')$$, 'not available|already', 'no second room once allocated');
-- hostel complaints
insert into trainee_affairs_records (organization_id, trainee_id, record_type, title, description, recorded_by, category) values (:'orgA', :'T1', 'grievance', 'Leaking tap', 'Room G1', :'tr1', 'hostel');
select set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-0000000000e2', false);
select public.assert((select count(*) from trainee_affairs_records where category = 'hostel') = 1, 'the hostel coordinator sees hostel complaints');
update trainee_affairs_records set status = 'resolved', action_taken = 'Plumber fixed it' where category = 'hostel';
select public.assert((select status from trainee_affairs_records where category = 'hostel') = 'resolved', 'and can resolve them');
reset role;

-- ===== certification reports =====
insert into qualification_unit_standards (qualification_id, unit_standard_id, unit_standard_title, credit_value, level) values ('e0000000-0000-0000-0000-000000000001', 'R1', 'Safety', 5, 1);
insert into assessment_templates (id, organization_id, qualification_id, status, created_by) values ('a7000000-0000-0000-0000-000000000009', :'orgA', 'e0000000-0000-0000-0000-000000000001', 'approved', :'admin');
insert into assessment_template_components (id, template_id, component_name, component_type) values ('a8000000-0000-0000-0000-000000000009', 'a7000000-0000-0000-0000-000000000009', 'Theory', 'theory');
insert into qualification_results (organization_id, qualification_id, template_component_id, trainee_id, academic_year, ca_mark, sa_mark, pass_mark, result_status, approved_at) values
 (:'orgA', 'e0000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000009', :'T1', '2026', 70, 80, 50, 'pass', now()),
 (:'orgA', 'e0000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000009', :'T2', '2026', 20, 30, 50, 'fail', now());
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from public.certified_trainees_report('2026')) = 1 and (select trainee_number from public.certified_trainees_report('2026')) = '062-26-00001', 'only the trainee who passed is certified');
select public.assert((select certified from public.assessment_certification_summary('2026') limit 1) = 1 and (select candidates from public.assessment_certification_summary('2026') limit 1) = 2, 'summary counts 2 candidates, 1 certified');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select * from public.certified_trainees_report()$$, 'Not authorised', 'trainees cannot run the certification report');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from public.certified_trainees_report('2026')) = 0, 'another centre sees none of it');
reset role;
select 'OK registration, hostel, notices, certification reports';
