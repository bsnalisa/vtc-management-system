\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set trainer '11111111-0000-0000-0000-000000000004'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set outsider '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set Q 'e0000000-0000-0000-0000-000000000001'

insert into trainers (id, organization_id, user_id, trainer_id, full_name, email) values ('70000000-0000-0000-0000-000000000001', :'orgA', :'trainer', 'TR1', 'Trainer One', 'trainer@a.test');
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year, qualification_id, trainer_id)
 values ('71000000-0000-0000-0000-000000000001', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'apprenticeship', 'W1', 'Welding L1 A', '2026', :'Q', '70000000-0000-0000-0000-000000000001');
insert into class_enrollments (class_id, trainee_id) values ('71000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001');
insert into qualification_unit_standards (qualification_id, unit_standard_id, unit_standard_title, credit_value, level) values
 (:'Q','US-100','Safety',10,1), (:'Q','US-200','Cutting',20,1), (:'Q','US-300','Welding',30,1);

select public.assert((select training_mode::text from classes) = 'apprenticeship', 'new training modes usable');

-- ===== delivery plan =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainer', false);
select public.generate_delivery_plan('71000000-0000-0000-0000-000000000001', date '2026-02-02', 13, null) as plan \gset
select public.assert((select count(*) from delivery_plan_weeks where plan_id=:'plan') = 13, 'one row per week');
select public.assert((select count(distinct unit_standard_code) from delivery_plan_weeks where plan_id=:'plan') = 3, 'all unit standards scheduled');
select public.assert((select topic from delivery_plan_weeks where plan_id=:'plan' and week_no=13) = 'Revision and assessment', 'final week reserved for assessment');
select public.assert((select week_start from delivery_plan_weeks where plan_id=:'plan' and week_no=2) = date '2026-02-09', 'weeks are seven days apart');
select public.assert((select count(*) from delivery_plan_weeks where plan_id=:'plan' and unit_standard_code='US-300') > (select count(*) from delivery_plan_weeks where plan_id=:'plan' and unit_standard_code='US-100'), 'higher-credit unit gets more weeks');
select public.expect_error($$select public.generate_delivery_plan('71000000-0000-0000-0000-000000000001', date '2026-02-02', 3, null)$$, 'teaching weeks', 'too few weeks rejected');
select public.assert((select title from delivery_plans where id=:'plan') = 'Welding L1 A delivery plan', 'default title');
-- trainer edits and tracks delivery
update delivery_plan_weeks set status='delivered' where plan_id=:'plan' and week_no=1;
select public.assert((select delivered_on from delivery_plan_weeks where plan_id=:'plan' and week_no=1) = current_date, 'delivered date stamped');
update delivery_plan_weeks set status='deferred' where plan_id=:'plan' and week_no=1;
select public.assert((select delivered_on from delivery_plan_weeks where plan_id=:'plan' and week_no=1) is null, 'date cleared when no longer delivered');
select public.expect_error($$update delivery_plans set status='approved' where status='draft'$$, 'row-level security', 'trainer cannot self-approve');
update delivery_plans set review_notes='self', weeks=2 where id=:'plan';
select public.assert((select status from delivery_plans where id=:'plan') = 'draft' and (select weeks from delivery_plans where id=:'plan') = 13, 'trainer cannot self-approve or change scope');
update delivery_plans set status='submitted' where id=:'plan';
select public.assert((select status from delivery_plans where id=:'plan') = 'submitted', 'trainer submits plan');
update delivery_plan_weeks set topic='edited while submitted' where plan_id=:'plan' and week_no=3;
select public.assert((select topic from delivery_plan_weeks where plan_id=:'plan' and week_no=3) <> 'edited while submitted', 'submitted plan is locked for trainer edits');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from delivery_plans) = 0 and (select count(*) from delivery_plan_weeks) = 0, 'trainee cannot read plans');
select public.expect_error($$select public.generate_delivery_plan('71000000-0000-0000-0000-000000000001', date '2026-02-02', 10, null)$$, 'Not authorised', 'trainee cannot generate plan');
select set_config('request.jwt.claim.sub', :'admin', false);
update delivery_plans set status='approved', review_notes='good' where id=:'plan';
select public.assert((select reviewed_by from delivery_plans where id=:'plan') = :'admin'::uuid, 'approver recorded');
select set_config('request.jwt.claim.sub', :'trainer', false);
update delivery_plan_weeks set status='delivered' where plan_id=:'plan' and week_no=2;
select public.assert((select status from delivery_plan_weeks where plan_id=:'plan' and week_no=2) = 'delivered', 'trainer can record delivery on an approved plan');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from delivery_plans) = 0, 'other org sees no plans');
reset role;
select 'OK delivery plans';

-- ===== logbook =====
insert into employers (id, organization_id, name) values ('72000000-0000-0000-0000-000000000001', :'orgA', 'Acme Welding');
insert into internship_placements (id, organization_id, trainee_id, employer_id, supervisor_name, start_date, end_date, status, placement_number) values
 ('73000000-0000-0000-0000-000000000001', :'orgA', 'd0000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Mr Boss', current_date - 30, current_date + 30, 'active', 'PL-1'),
 ('73000000-0000-0000-0000-000000000002', :'orgA', 'd0000000-0000-0000-0000-000000000002', null, null, current_date + 10, null, 'pending', 'PL-2');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from public.my_logbook_placements()) = 1 and (select employer_name from public.my_logbook_placements()) = 'Acme Welding', 'trainee finds own active placement');
insert into logbook_entries (organization_id, placement_id, trainee_id, entry_date, hours, activities, status)
 values (:'orgA','73000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001', current_date - 2, 8, 'Welded joints', 'submitted');
select public.expect_error($$insert into logbook_entries (organization_id, placement_id, trainee_id, entry_date, hours, activities) values ('a0000000-0000-0000-0000-00000000000a','73000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001', current_date - 2, 4, 'dup')$$, 'duplicate', 'one entry per day');
select public.expect_error($$insert into logbook_entries (organization_id, placement_id, trainee_id, entry_date, hours, activities) values ('a0000000-0000-0000-0000-00000000000a','73000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001', current_date + 1, 4, 'future')$$, 'placement period', 'no future entries');
select public.expect_error($$insert into logbook_entries (organization_id, placement_id, trainee_id, entry_date, hours, activities) values ('a0000000-0000-0000-0000-00000000000a','73000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001', current_date - 60, 4, 'before start')$$, 'placement period', 'no entries before the placement began');
select public.expect_error($$insert into logbook_entries (organization_id, placement_id, trainee_id, entry_date, hours, activities) values ('a0000000-0000-0000-0000-00000000000a','73000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001', current_date - 3, 25, 'too long')$$, 'check constraint', 'max 24 hours');
select public.expect_error($$insert into logbook_entries (organization_id, placement_id, trainee_id, entry_date, hours, activities) values ('a0000000-0000-0000-0000-00000000000a','73000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001', current_date - 3, 4, 'someone elses placement')$$, 'does not belong', 'cannot log against another trainees placement');
-- trainee cannot sign off
update logbook_entries set status='submitted', supervisor_signed_by='Mr Boss', reviewer_comment='fine', approved_at = now();
select public.assert((select supervisor_signed_by from logbook_entries) is null and (select reviewer_comment from logbook_entries) is null and (select approved_at from logbook_entries) is null, 'trainee cannot forge sign-off fields');
update logbook_entries set status='approved';
select public.assert((select status from logbook_entries) = 'submitted', 'trainee cannot approve');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from logbook_entries) = 0, 'other trainee cannot read it');
select set_config('request.jwt.claim.sub', :'trainer', false);
select public.assert((select count(*) from logbook_entries) = 1, 'the class trainer can review');
update logbook_entries set status='returned', reviewer_comment='Add more detail';
select set_config('request.jwt.claim.sub', :'tr1', false);
update logbook_entries set activities='Welded joints; cut plate', status='submitted';
select public.assert((select status from logbook_entries) = 'submitted' and (select activities from logbook_entries) like '%cut plate', 'trainee edits returned entry and resubmits');
select set_config('request.jwt.claim.sub', :'trainer', false);
update logbook_entries set status='supervisor_signed', supervisor_signed_by='Mr Boss', supervisor_signed_on=current_date;
update logbook_entries set status='approved';
select public.assert((select approved_by from logbook_entries) = :'trainer'::uuid and (select approved_at from logbook_entries) is not null, 'approval stamped');
select set_config('request.jwt.claim.sub', :'tr1', false);
update logbook_entries set activities='tampered';
select public.assert((select activities from logbook_entries) like '%cut plate', 'approved entries are locked for the trainee');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from logbook_entries) = 0, 'other org sees no logbook');
reset role;
select 'OK logbook';
