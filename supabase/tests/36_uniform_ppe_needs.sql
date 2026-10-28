\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set pA '98888888-0000-0000-0000-000000000001'
\set pB '98888888-0000-0000-0000-000000000002'
\set reg '98888888-0000-0000-0000-000000000003'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'

insert into auth.users (id,email) values (:'pA','pa@a.test'),(:'pB','pb@b.test'),(:'reg','rg@a.test');
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'pA','procurement_officer',:'orgA'),(:'pB','procurement_officer',:'orgB'),(:'reg','registration_officer',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;

insert into trainee_applications (id, organization_id, first_name, last_name, gender, date_of_birth, national_id, phone, address, trade_id, preferred_training_mode, intake, academic_year, created_by, application_source, shoe_size, overall_size, tshirt_size)
 values ('a9800000-0000-0000-0000-000000000001', :'orgA', 'Tina', 'One', 'female', '2000-01-01', 'PPE1', '0', 'x', 'c0000000-0000-0000-0000-000000000001', 'fulltime', 'january', '2026', :'reg', 'manual', '40', 'M', 'L'),
        ('a9800000-0000-0000-0000-000000000002', :'orgA', 'Tom', 'Two', 'male', '2000-01-01', 'PPE2', '0', 'x', 'c0000000-0000-0000-0000-000000000001', 'fulltime', 'january', '2026', :'reg', 'manual', '40', 'L', null),
        ('a9800000-0000-0000-0000-000000000003', :'orgA', 'Pia', 'Pending', 'female', '2000-01-01', 'PPE3', '0', 'x', 'c0000000-0000-0000-0000-000000000001', 'fulltime', 'january', '2026', :'reg', 'manual', '41', 'S', 'S');
insert into registrations (id, organization_id, trainee_id, application_id, academic_year, registration_status) values
 ('9a800000-0000-0000-0000-000000000001', :'orgA', :'T1', 'a9800000-0000-0000-0000-000000000001', '2026', 'registered'),
 ('9a800000-0000-0000-0000-000000000002', :'orgA', :'T2', 'a9800000-0000-0000-0000-000000000002', '2026', 'registered');

set role authenticated; select set_config('request.jwt.claim.sub', :'pA', false);
select public.assert((public.uniform_ppe_needs(:'orgA') ->> 'registered')::int = 2 and (public.uniform_ppe_needs(:'orgA') ->> 'open_trainees')::int = 2, 'only registered trainees count (the pending application is left out)');
select public.assert((select (e ->> 'quantity')::int from jsonb_array_elements(public.uniform_ppe_needs(:'orgA') -> 'open_items') e where e ->> 'item' = 'Safety shoes' and e ->> 'size' = '40') = 2, 'two trainees need size 40 shoes');
select public.assert((select count(*) from jsonb_array_elements(public.uniform_ppe_needs(:'orgA') -> 'open_items') e where e ->> 'item' = 'Safety shoes' and e ->> 'size' = '41') = 0, 'the unregistered applicant''s size is not included');
select public.assert((select count(*) from public.uniform_ppe_register(:'orgA')) = 2, 'the register lists the two registered trainees');
select public.assert((select count(*) from public.uniform_ppe_register(:'orgA', '2025')) = 0, 'filtering by academic year works');
select set_config('request.jwt.claim.sub', :'pB', false);
select public.expect_error($$select public.uniform_ppe_needs('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'procurement at another centre cannot see it');
select public.expect_error($$select public.create_uniform_requisition('a0000000-0000-0000-0000-00000000000a')$$, 'Only the Procurement Officer', 'nor prepare a requisition for it');
select set_config('request.jwt.claim.sub', :'reg', false);
select public.expect_error($$select public.uniform_ppe_needs('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'registration staff do not see the procurement figures');

select set_config('request.jwt.claim.sub', :'pA', false);
select public.assert((public.create_uniform_requisition(:'orgA') ->> 'trainees')::int = 2, 'a requisition is prepared for the two trainees');
select public.assert((select quantity from purchase_requisition_items i join purchase_requisitions r on r.id = i.requisition_id where r.requisition_number like 'DRAFT-%' and i.item_description = 'Safety shoes, size 40') = 2, 'its lines add up the sizes');
select public.assert((select status from purchase_requisitions where requisition_number like 'DRAFT-%') = 'draft', 'it is a draft for the officer to price and submit');
select public.assert((public.uniform_ppe_needs(:'orgA') ->> 'open_trainees')::int = 0 and (public.uniform_ppe_needs(:'orgA') ->> 'already_requisitioned')::int = 2, 'the same trainees are not requisitioned twice');
select public.expect_error($$select public.create_uniform_requisition('a0000000-0000-0000-0000-00000000000a')$$, 'No registered trainees', 'nothing left to requisition');
select public.assert((select count(*) from public.uniform_ppe_register(:'orgA') where requisition_number is not null) = 2, 'the register shows which requisition each trainee is in');
reset role;
select 'OK uniform and PPE needs';
