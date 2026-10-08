\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set trainerA '11111111-0000-0000-0000-000000000004'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'
insert into trainers (id, organization_id, user_id, trainer_id, full_name) values ('70000000-0000-0000-0000-0000000000a1', :'orgA', :'trainerA', 'TA', 'Trainer A');

-- the trainer starts a register and records a day, exactly as the screen does
set role authenticated; select set_config('request.jwt.claim.sub', :'trainerA', false);
insert into attendance_registers (id, organization_id, trade_id, trainer_id, level, training_mode, academic_year, start_date, end_date, created_by)
 values ('ab000000-0000-0000-0000-000000000001', :'orgA', 'c0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-0000000000a1', 1, 'apprenticeship', '2026', '2026-01-01', '2026-12-31', :'trainerA');
insert into attendance_records (register_id, trainee_id, attendance_date, present, remarks) values
 ('ab000000-0000-0000-0000-000000000001', :'T1', current_date, true, null), ('ab000000-0000-0000-0000-000000000001', :'T2', current_date, true, null)
 on conflict (register_id, trainee_id, attendance_date) do update set present = excluded.present, remarks = excluded.remarks;
-- correcting the same day updates rather than duplicating
insert into attendance_records (register_id, trainee_id, attendance_date, present, remarks) values
 ('ab000000-0000-0000-0000-000000000001', :'T2', current_date, false, 'Sick')
 on conflict (register_id, trainee_id, attendance_date) do update set present = excluded.present, remarks = excluded.remarks;
select public.assert((select count(*) from attendance_records) = 2, 'saving the same trainee and day again does not create a second row');
select public.assert((select present from attendance_records where trainee_id = :'T2') = false and (select remarks from attendance_records where trainee_id = :'T2') = 'Sick', 'the correction replaced the earlier mark');
select public.assert((select count(*) from attendance_registers where training_mode = 'apprenticeship') = 1, 'registers can be kept for the newer training modes');
-- a register must belong to the creator''s own centre
select public.expect_error($$insert into attendance_registers (organization_id, trade_id, trainer_id, level, training_mode, academic_year, start_date, end_date, created_by) values (null, 'c0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-0000000000a1', 1, 'fulltime', '2026', '2026-01-01', '2026-12-31', '11111111-0000-0000-0000-000000000004')$$, 'row-level security', 'a register without a centre is refused');
-- trainees cannot record or alter attendance, including their own
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$insert into attendance_records (register_id, trainee_id, attendance_date, present) values ('ab000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', current_date - 1, true)$$, 'row-level security', 'a trainee cannot mark themselves present');
update attendance_records set present = true;
reset role;
select public.assert((select present from attendance_records where trainee_id = :'T1') = true and (select present from attendance_records where trainee_id = :'T2') = false, 'a trainee cannot change recorded attendance');
select 'OK attendance capture';
