\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set hot '97e00000-0000-0000-0000-000000000001'
\set cm '97e00000-0000-0000-0000-000000000002'
\set cmB '97e00000-0000-0000-0000-000000000003'
\set oa '97e00000-0000-0000-0000-000000000004'
\set tr '97e00000-0000-0000-0000-000000000005'

insert into auth.users (id,email) values (:'hot','hot@a.test'),(:'cm','cm@a.test'),(:'cmB','cmb@b.test'),(:'oa','oa@a.test'),(:'tr','tr@a.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '97e00000%' on conflict (user_id) do update set full_name = excluded.full_name;
update profiles set full_name = split_part(email,'@',1) where user_id::text like '97e00000%';
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'hot','head_of_training',:'orgA'),(:'cm','centre_manager',:'orgA'),(:'cmB','centre_manager',:'orgB'),(:'oa','organization_admin',:'orgA'),(:'tr','trainer',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;

-- everything that existed before stays approved
select public.assert((select count(*) from classes where approval_status <> 'approved') = 0, 'existing classes are approved');

set role authenticated; select set_config('request.jwt.claim.sub', :'hot', false);
insert into training_buildings (id, organization_id, name, code) values ('f1000000-0000-0000-0000-000000000001', :'orgA', 'Welding workshop', 'WW');
insert into training_rooms (id, organization_id, building_id, name, code) values ('f2000000-0000-0000-0000-000000000001', :'orgA', 'f1000000-0000-0000-0000-000000000001', 'Bay 1', 'B1');
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year) values ('f3000000-0000-0000-0000-000000000001', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'fulltime', 'FA1', 'Facility class', '2026');
select public.assert((select approval_status from training_buildings where id = 'f1000000-0000-0000-0000-000000000001') = 'pending'
  and (select approval_status from training_rooms where id = 'f2000000-0000-0000-0000-000000000001') = 'pending'
  and (select approval_status from classes where id = 'f3000000-0000-0000-0000-000000000001') = 'pending', 'what the Head of Training creates starts pending');
-- cannot self-approve or claim approval on insert
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year, approval_status) values ('f3000000-0000-0000-0000-000000000002', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'fulltime', 'FA2', 'Sneaky class', '2026', 'approved');
select public.assert((select approval_status from classes where id = 'f3000000-0000-0000-0000-000000000002') = 'pending', 'a new class cannot be created as approved');
select public.expect_error($$update classes set approval_status = 'approved' where id = 'f3000000-0000-0000-0000-000000000001'$$, 'Only the Centre Manager', 'the Head of Training cannot approve their own class');
select public.expect_error($$select public.facility_decide('class', 'f3000000-0000-0000-0000-000000000001', true, null)$$, 'Only the Centre Manager', 'nor through the function');
select public.assert((public.facility_approval_summary(:'orgA') ->> 'classes')::int = 2 and (public.facility_approval_summary(:'orgA') ->> 'buildings')::int = 1, 'the pending counts');

-- a pending class cannot be used
set role authenticated; select set_config('request.jwt.claim.sub', :'hot', false);
select public.expect_error($$insert into class_enrollments (class_id, trainee_id) values ('f3000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001')$$, 'waiting for the Centre Manager', 'a pending class cannot take enrolments');
select public.assert((select count(*) from class_enrollments where class_id = 'f3000000-0000-0000-0000-000000000001') = 0, 'and nobody was enrolled automatically');

-- the Centre Manager reads and decides, nobody else does
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((select count(*) from classes where id = 'f3000000-0000-0000-0000-000000000001') = 1 and (select count(*) from training_buildings) >= 1 and (select count(*) from training_rooms) >= 1, 'the Centre Manager sees classes, buildings and rooms');
update classes set class_name = 'Renamed' where id = 'f3000000-0000-0000-0000-000000000001';
select public.assert((select class_name from classes where id = 'f3000000-0000-0000-0000-000000000001') = 'Facility class', 'but cannot edit them');
select public.expect_error($$select public.facility_decide('room', 'f2000000-0000-0000-0000-000000000001', true, null)$$, 'Approve the building', 'a room waits for its building');
select public.expect_error($$select public.facility_decide('building', 'f1000000-0000-0000-0000-000000000001', false, 'no')$$, 'reason', 'a rejection needs a reason');
select public.assert(public.facility_decide('building', 'f1000000-0000-0000-0000-000000000001', true, null) = 'approved', 'the Centre Manager approves the building');
select public.assert(public.facility_decide('room', 'f2000000-0000-0000-0000-000000000001', true, null) = 'approved', 'then the room');
select public.expect_error($$select public.facility_decide('room', 'f2000000-0000-0000-0000-000000000001', true, null)$$, 'not waiting', 'a decision is final');
select public.assert(public.facility_decide('class', 'f3000000-0000-0000-0000-000000000001', false, 'Duplicate of an existing class') = 'rejected', 'a class can be rejected with a reason');
select set_config('request.jwt.claim.sub', :'cmB', false);
select public.expect_error($$select public.facility_decide('class', 'f3000000-0000-0000-0000-000000000002', true, null)$$, 'Only the Centre Manager', 'the Centre Manager of another centre cannot decide');
select set_config('request.jwt.claim.sub', :'oa', false);
select public.expect_error($$select public.facility_decide('class', 'f3000000-0000-0000-0000-000000000002', true, null)$$, 'Only the Centre Manager', 'the IT administrator cannot decide');
select set_config('request.jwt.claim.sub', :'tr', false);
select public.expect_error($$select public.facility_approval_summary('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'a trainer does not see the approval summary');

-- correcting a rejected class sends it back for approval
select set_config('request.jwt.claim.sub', :'hot', false);
update classes set class_name = 'Facility class (corrected)' where id = 'f3000000-0000-0000-0000-000000000001';
select public.assert((select approval_status from classes where id = 'f3000000-0000-0000-0000-000000000001') = 'pending', 'a corrected rejected class returns to pending');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.facility_decide('class', 'f3000000-0000-0000-0000-000000000001', true, null);
select set_config('request.jwt.claim.sub', :'hot', false);
reset role;
select public.assert((select count(*) from class_enrollments where class_id = 'f3000000-0000-0000-0000-000000000001') >= 1, 'approving a class enrols its matching trainees');
reset role;
select public.assert((select count(*) from facility_approval_events where item_id = 'f3000000-0000-0000-0000-000000000001') = 4, 'every step is on the log');
select public.assert((select count(*) from notifications where type = 'facility_approval' and user_id = :'cm') >= 3, 'the Centre Manager is notified');
select public.expect_error($$update facility_approval_events set note = 'x'$$, 'can never be changed', 'the log is append-only');
select 'OK facility approval';
