\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set trainerA '11111111-0000-0000-0000-000000000004'
\set adminB '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'
\set proj '22222222-0000-0000-0000-000000000001'
\set hr '22222222-0000-0000-0000-000000000002'
\set bdl '22222222-0000-0000-0000-000000000003'
\set rpl '22222222-0000-0000-0000-000000000004'
\set liaison '22222222-0000-0000-0000-000000000005'
\set rc '22222222-0000-0000-0000-000000000006'
\set staff2 '22222222-0000-0000-0000-000000000007'

-- ===== every role can now be assigned =====
insert into auth.users (id,email) values (:'proj','proj@a.test'),(:'hr','hr@a.test'),(:'bdl','bdl@a.test'),(:'rpl','rpl@a.test'),(:'liaison','liaison@a.test'),(:'rc','rc@a.test'),(:'staff2','staff2@a.test');
update profiles p set full_name = split_part(u.email,'@',1), email = u.email from auth.users u where u.id = p.user_id and u.id::text like '22222222%';
insert into user_roles (user_id, role, organization_id) values
 (:'proj','projects_coordinator',:'orgA'),(:'hr','hr_officer',:'orgA'),(:'bdl','bdl_coordinator',:'orgA'),(:'rpl','rpl_coordinator',:'orgA'),
 (:'liaison','liaison_officer',:'orgA'),(:'rc','resource_center_coordinator',:'orgA'),(:'staff2','placement_officer',:'orgA');
select public.assert((select count(*) from custom_roles where role_code in ('placement_officer','head_of_trainee_support','projects_coordinator','hr_officer','bdl_coordinator','rpl_coordinator','liaison_officer','resource_center_coordinator')) = 8, 'all eight roles can be assigned');

-- ===== projects =====
set role authenticated; select set_config('request.jwt.claim.sub', :'proj', false);
insert into projects (organization_id, title, status, start_date, end_date, budget) values (:'orgA', 'New workshop', 'active', current_date, current_date + 90, 50000);
select public.assert((select project_code from projects) ~ '^PRJ-[0-9]{2}-001$', 'projects get a code');
insert into projects (organization_id, title) values (:'orgA', 'Second');
select public.assert((select count(distinct project_code) from projects) = 2, 'codes are unique');
insert into project_milestones (project_id, organization_id, title, due_date, owner_user_id) select id, :'orgA', 'Foundations', current_date + 10, :'trainerA' from projects where title = 'New workshop';
select public.assert((select organization_id from project_milestones) = :'orgA', 'milestones take the project''s centre');
insert into project_updates (project_id, organization_id, note, progress_percent, author_id) select id, :'orgA', 'Site cleared', 15, :'proj' from projects where title = 'New workshop';
select public.expect_error($$insert into projects (organization_id, title, start_date, end_date) values ('a0000000-0000-0000-0000-00000000000a', 'Bad', current_date, current_date - 1)$$, 'check', 'a project cannot end before it starts');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from projects) = 2, 'staff can read projects');
select public.expect_error($$insert into projects (organization_id, title) values ('a0000000-0000-0000-0000-00000000000a', 'Trainer project')$$, 'row-level security', 'trainers cannot create projects');
update project_milestones set status = 'done', title = 'Hacked', due_date = current_date + 400;
select public.assert((select status from project_milestones) = 'done' and (select title from project_milestones) = 'Foundations' and (select completed_on from project_milestones) = current_date, 'a milestone owner can only move the status; completion is stamped');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from projects) = 0, 'trainees cannot see projects');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from projects) = 0, 'another centre cannot see projects');
reset role;

-- ===== HR =====
insert into leave_types (organization_id, name, days_per_year) values (:'orgA', 'Annual leave', 20), (:'orgA', 'Unpaid leave', 0);
select id as lt_annual from leave_types where name = 'Annual leave' \gset
select id as lt_unpaid from leave_types where name = 'Unpaid leave' \gset
set role authenticated; select set_config('request.jwt.claim.sub', :'hr', false);
insert into staff_records (organization_id, user_id, employee_number, job_title, department) values (:'orgA', :'trainerA', 'E-100', 'Welding trainer', 'Engineering');
select public.expect_error($$insert into staff_records (organization_id, user_id) values ('a0000000-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000003')$$, 'not a staff member', 'a trainee cannot have a staff record');
select public.assert((select count(*) from public.hr_staff_directory()) >= 7, 'the directory lists staff');
select public.assert((select job_title from public.hr_staff_directory() where user_id = :'trainerA') = 'Welding trainer', 'with their HR details');
select public.assert(not exists (select 1 from public.hr_staff_directory() where user_id = :'tr1'), 'trainees are not in the staff directory');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.hr_staff_directory()$$, 'Not authorised', 'trainees cannot open the directory');
select public.expect_error(format('select public.request_leave(%L, current_date + 30, current_date + 31)', :'lt_annual'), 'Only staff', 'trainees cannot request staff leave');
select set_config('request.jwt.claim.sub', :'trainerA', false);
create temp table lv(id uuid); grant all on lv to public;
insert into lv select public.request_leave(:'lt_annual', date '2027-03-01', date '2027-03-05', 'Family');   -- Mon-Fri: 5 days
select public.assert((select days from leave_requests) = 5, 'working days are counted (Mon-Fri)');
select public.expect_error(format('select public.request_leave(%L, date %L, date %L)', :'lt_annual', '2027-03-04', '2027-03-08'), 'already have leave', 'overlapping leave is refused');
select public.expect_error(format('select public.request_leave(%L, date %L, date %L)', :'lt_annual', '2027-04-05', '2027-05-30'), 'remain', 'more than the balance is refused');
select public.expect_error(format('select public.request_leave(%L, date %L, date %L)', :'lt_annual', '2027-06-05', '2027-06-06'), 'no working days', 'a weekend has no working days');
select public.assert((select remaining from public.leave_balances(null, 2027) where leave_type = 'Annual leave') = 15, 'pending days count against the balance');
select public.expect_error(format('select public.decide_leave(%L, true)', (select id from lv)), 'Not authorised', 'staff cannot approve leave');
select set_config('request.jwt.claim.sub', :'hr', false);
select public.assert(public.t_notif_count(:'hr'::uuid, 'Leave request%') = 1, 'HR is told about the request');
select public.expect_error(format('select public.decide_leave(%L, false, %L)', (select id from lv), ''), 'reason', 'declining needs a reason');
select public.assert(public.decide_leave((select id from lv), true) = 'approved', 'HR approves');
select public.expect_error(format('select public.decide_leave(%L, true)', (select id from lv)), 'already', 'only once');
select public.assert((select taken from public.leave_balances(:'trainerA', 2027) where leave_type = 'Annual leave') = 5, 'HR sees the balance of any staff member');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert(public.t_notif_count(:'trainerA'::uuid, 'Leave approved') = 1, 'the staff member is told');
select public.assert((select count(*) from leave_requests) = 1, 'staff see only their own leave');
select set_config('request.jwt.claim.sub', :'staff2', false);
select public.assert((select count(*) from leave_requests) = 0 and (select count(*) from staff_records) = 0, 'other staff cannot see it');
-- recruitment and reviews
select set_config('request.jwt.claim.sub', :'hr', false);
insert into vacancies (organization_id, title, department, status) values (:'orgA', 'Electrical trainer', 'Engineering', 'open');
insert into vacancy_applicants (vacancy_id, organization_id, full_name, email) select id, :'orgA', 'Alex Applicant', 'alex@x.test' from vacancies;
select public.assert((select organization_id from vacancy_applicants) = :'orgA', 'applicants take the vacancy''s centre');
insert into performance_reviews (organization_id, employee_user_id, period, rating, goals, status) values (:'orgA', :'trainerA', '2026', 4, 'Mentor juniors', 'draft');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from performance_reviews) = 0, 'a draft review is hidden from the employee');
select set_config('request.jwt.claim.sub', :'hr', false);
update performance_reviews set status = 'submitted';
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from performance_reviews) = 1, 'a submitted review is visible');
select public.acknowledge_review((select id from performance_reviews));
select public.assert((select status from performance_reviews) = 'acknowledged', 'and can be acknowledged');
select set_config('request.jwt.claim.sub', :'staff2', false);
select public.assert((select count(*) from vacancies) = 0 and (select count(*) from performance_reviews) = 0, 'other staff see neither vacancies nor reviews');
reset role;

-- ===== blended learning =====
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year, trainer_id) values
 ('c1000000-0000-0000-0000-0000000000b1', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'bdl', 'BDL1', 'Blended welding', '2026', null),
 ('c1000000-0000-0000-0000-0000000000b2', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'fulltime', 'FT1', 'Full-time welding', '2026', null);
insert into class_enrollments (class_id, trainee_id) values ('c1000000-0000-0000-0000-0000000000b1', :'T1') on conflict do nothing;
delete from class_enrollments where class_id = 'c1000000-0000-0000-0000-0000000000b1' and trainee_id = :'T2';
set role authenticated; select set_config('request.jwt.claim.sub', :'bdl', false);
insert into learning_items (id, class_id, title, item_type, body, url, published) values
 ('b5000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-0000000000b1', 'Welcome', 'page', 'Hello', null, true),
 ('b5000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-0000000000b1', 'Safety video', 'link', null, 'https://video.example/safety', true);
select public.expect_error($$insert into learning_items (class_id, title, item_type, body, published) values ('c1000000-0000-0000-0000-0000000000b2', 'Not mine', 'page', 'x', true)$$, 'row-level security', 'the BDL coordinator cannot manage a full-time class');
insert into virtual_sessions (class_id, title, starts_at, meeting_url) values ('c1000000-0000-0000-0000-0000000000b1', 'Weld theory live', now() + interval '2 days', 'https://meet.example/abc');
select public.assert((select organization_id from virtual_sessions) = :'orgA', 'sessions take the class''s centre');
select public.expect_error($$insert into virtual_sessions (class_id, title, starts_at, meeting_url) values ('c1000000-0000-0000-0000-0000000000b1', 'Bad link', now(), 'javascript:alert(1)')$$, 'check', 'only web addresses');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Virtual session: %') = 1, 'trainees of the class are told');
select public.assert((select count(*) from virtual_sessions) = 1, 'and see the session');
select public.set_item_completed('b5000000-0000-0000-0000-000000000001');
select public.set_item_completed('b5000000-0000-0000-0000-000000000001');
select public.assert((select count(*) from learning_item_completions) = 1, 'ticking a page twice counts once');
select public.expect_error($$select * from public.class_progress('c1000000-0000-0000-0000-0000000000b1')$$, 'Not authorised', 'trainees cannot read class progress');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from virtual_sessions) = 0, 'trainees outside the class see no sessions');
select public.expect_error($$select public.set_item_completed('b5000000-0000-0000-0000-000000000001')$$, 'not found', 'and cannot tick its content');
select set_config('request.jwt.claim.sub', :'bdl', false);
select public.assert((select items_total from public.class_progress('c1000000-0000-0000-0000-0000000000b1') where trainee_id = :'T1') = 2 and (select items_done from public.class_progress('c1000000-0000-0000-0000-0000000000b1') where trainee_id = :'T1') = 1, 'progress shows 1 of 2 items done');
select public.expect_error($$select * from public.class_progress('c1000000-0000-0000-0000-0000000000b2')$$, 'Not authorised', 'no progress for a class they do not manage');
reset role;

-- ===== RPL credit mapping =====
insert into assessment_requests (id, organization_id, request_type, applicant_name, motivation, created_by) values
 ('a9000000-0000-0000-0000-0000000000e1', :'orgA', 'rpl', 'Joe Welder', 'six years', :'tr1'),
 ('a9000000-0000-0000-0000-0000000000e2', :'orgA', 'exemption', 'Tina', 'x', :'tr1');
set role authenticated; select set_config('request.jwt.claim.sub', :'rpl', false);
insert into rpl_credit_mappings (request_id, unit_standard_code, unit_standard_title, credits) values ('a9000000-0000-0000-0000-0000000000e1', 'US-1', 'Safety', 6);
insert into rpl_credit_mappings (request_id, unit_standard_code, decision, credits) values ('a9000000-0000-0000-0000-0000000000e1', 'US-2', 'not_granted', 9);
select public.assert((select credits from rpl_credit_mappings where unit_standard_code = 'US-2') = 0, 'a refused unit carries no credits');
select public.expect_error($$insert into rpl_credit_mappings (request_id, unit_standard_code, credits) values ('a9000000-0000-0000-0000-0000000000e2', 'US-1', 3)$$, 'RPL applications only', 'credits only on RPL requests');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from rpl_credit_mappings) = 2, 'the applicant sees the decisions on their application');
select public.expect_error($$insert into rpl_credit_mappings (request_id, unit_standard_code, credits) values ('a9000000-0000-0000-0000-0000000000e1', 'US-3', 99)$$, 'row-level security', 'but cannot write them');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from rpl_credit_mappings) = 0, 'other trainees see none');
reset role;

-- ===== liaison =====
insert into employers (id, organization_id, name) values ('e1000000-0000-0000-0000-0000000000c1', :'orgA', 'Gamma Industries') on conflict do nothing;
set role authenticated; select set_config('request.jwt.claim.sub', :'liaison', false);
insert into employers (organization_id, name, industry) values (:'orgA', 'Delta Mining', 'Mining');
insert into partner_interactions (employer_id, interaction_type, summary, follow_up_date) values ('e1000000-0000-0000-0000-0000000000c1', 'visit', 'Toured the plant', current_date + 7);
select public.assert((select organization_id from partner_interactions) = :'orgA', 'interactions take the partner''s centre');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from partner_interactions) = 0, 'trainees cannot read the contact log');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from partner_interactions) = 0, 'another centre cannot either');
reset role;

-- ===== resource centre coordinator runs the library =====
set role authenticated; select set_config('request.jwt.claim.sub', :'rc', false);
insert into library_settings (organization_id, loan_days) values (:'orgA', 10);
select public.assert((select loan_days from library_settings) = 10, 'the resource centre coordinator can manage library settings');
select public.assert(public.library_send_announcement(:'orgA', 'Hours', 'Open late') >= 0, 'and send announcements');
reset role;
select 'OK role journeys';
