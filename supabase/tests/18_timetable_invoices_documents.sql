\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set trainerA '11111111-0000-0000-0000-000000000004'
\set adminB '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'
\set C 'c1000000-0000-0000-0000-0000000000f1'

-- ===== timetable =====
insert into trainers (id, organization_id, user_id, trainer_id, full_name) values ('70000000-0000-0000-0000-0000000000f1', :'orgA', :'trainerA', 'TF', 'Trainer F') on conflict do nothing;
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year, trainer_id)
 values (:'C', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'fulltime', 'WF', 'Welding F', '2026', (select id from trainers where user_id = :'trainerA'));
insert into class_enrollments (class_id, trainee_id) values (:'C', :'T1') on conflict do nothing;
delete from class_enrollments where class_id = :'C' and trainee_id = :'T2';
insert into courses (id, code, name, trade_id, level) values ('c2000000-0000-0000-0000-0000000000f1', 'WLD-101', 'Welding basics', 'c0000000-0000-0000-0000-000000000001', 1) on conflict do nothing;
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
insert into timetable_entries (organization_id, academic_year, term, class_id, course_id, day, period_number) values (:'orgA', '2026', 1, :'C', 'c2000000-0000-0000-0000-0000000000f1', 'Monday', 1);
select public.assert((select published from timetable_entries) = false, 'a saved entry starts as a draft');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from timetable_entries) = 0, 'a trainee does not see a draft');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from timetable_entries) = 1, 'staff see drafts');
select public.expect_error($$select public.publish_timetable('2026', 1)$$, 'Not authorised', 'a trainer cannot publish');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.publish_timetable('2026', 1)$$, 'Not authorised', 'a trainee cannot publish');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert(public.publish_timetable('2026', 1) = 1, 'publishing changes the entries of that term');
select public.assert(public.publish_timetable('2026', 1) = 0, 'publishing again changes nothing');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from timetable_entries) = 1, 'the trainee sees it once published');
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Class timetable published') = 1, 'and is told');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from timetable_entries) = 1, 'trainees of the centre can read the published timetable');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from timetable_entries) = 0, 'another centre cannot read it');
update timetable_entries set day = 'Friday';
reset role;
select public.assert((select day from timetable_entries) = 'Monday', 'another centre''s admin cannot change it');

-- ===== draft invoices on registration =====
insert into fee_records (id, trainee_id, total_fee, amount_paid, academic_year, organization_id) values ('fe000000-0000-0000-0000-0000000000a1', :'T1', 1500, 200, '2027', :'orgA');
insert into registrations (id, organization_id, trainee_id, academic_year, registration_status) values ('9e000000-0000-0000-0000-0000000000a1', :'orgA', :'T1', '2027', 'pending');
select public.assert((select count(*) from invoices) = 0, 'no invoice while registration is only pending');
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
update registrations set registration_status = 'registered' where id = '9e000000-0000-0000-0000-0000000000a1';
reset role;
select public.assert((select count(*) from invoices where fee_record_id = 'fe000000-0000-0000-0000-0000000000a1' and status = 'draft' and total_amount = 1500 and amount_paid = 200) = 1, 'completing the registration drafts one invoice for the fee record');
select public.assert((select count(*) from invoice_items i join invoices v on v.id = i.invoice_id where v.fee_record_id = 'fe000000-0000-0000-0000-0000000000a1') = 1, 'with one line');
update registrations set registration_status = 'fee_pending' where id = '9e000000-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
update registrations set registration_status = 'registered' where id = '9e000000-0000-0000-0000-0000000000a1';
reset role;
select public.assert((select count(*) from invoices) = 1, 'registering again does not draft a second invoice');
-- switched off
insert into finance_settings (organization_id, auto_draft_invoices) values (:'orgA', false);
insert into fee_records (id, trainee_id, total_fee, academic_year, organization_id) values ('fe000000-0000-0000-0000-0000000000a2', :'T2', 900, '2027', :'orgA');
insert into registrations (organization_id, trainee_id, academic_year, registration_status) values (:'orgA', :'T2', '2027', 'pending');
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
update registrations set registration_status = 'registered' where trainee_id = :'T2';
reset role;
select public.assert((select count(*) from invoices) = 1, 'the setting switches automatic drafts off');

-- ===== document versions =====
insert into assessment_requests (id, organization_id, request_type, applicant_name, motivation, created_by) values ('a9000000-0000-0000-0000-0000000000d1', :'orgA', 'exemption', 'Tina One', 'x', :'tr1');
insert into document_metadata_fields (organization_id, entity_type, field_key, label, required) values (:'orgA', 'assessment_request', 'issued_by', 'Issued by', true);
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.add_document_version('assessment_request','a9000000-0000-0000-0000-0000000000d1','evidence','a0000000-0000-0000-0000-00000000000a/documents/x.pdf','x.pdf','application/pdf',100)$$, 'Issued by', 'required metadata is enforced');
select public.assert(public.add_document_version('assessment_request','a9000000-0000-0000-0000-0000000000d1','evidence','a0000000-0000-0000-0000-00000000000a/documents/v1.pdf','cert.pdf','application/pdf',100,'first', '{"issued_by":"NTA"}') = 1, 'first upload is version 1');
select public.assert(public.add_document_version('assessment_request','a9000000-0000-0000-0000-0000000000d1','evidence','a0000000-0000-0000-0000-00000000000a/documents/v2.pdf','cert-signed.pdf','application/pdf',120,'corrected', '{"issued_by":"NTA"}') = 2, 'a new upload is version 2');
select public.assert((select count(*) from document_versions) = 2 and (select count(*) from document_versions where is_current) = 1 and (select version_no from document_versions where is_current) = 2, 'both versions are kept and the latest is current');
select public.expect_error($$select public.add_document_version('assessment_request','a9000000-0000-0000-0000-0000000000d1','evidence','b0000000-0000-0000-0000-00000000000b/x.pdf','x.pdf','application/pdf',1,null,'{"issued_by":"x"}')$$, 'your centre', 'files must live in the centre''s folder');
select public.expect_error($$select public.restore_document_version((select id from document_versions where version_no = 1))$$, 'Not authorised', 'the applicant cannot restore a version');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from document_versions) = 0, 'another trainee cannot see the documents');
select public.expect_error($$select public.add_document_version('assessment_request','a9000000-0000-0000-0000-0000000000d1','evidence','a0000000-0000-0000-0000-00000000000a/documents/z.pdf','z.pdf','application/pdf',1,null,'{"issued_by":"x"}')$$, 'Not authorised', 'nor add one');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from document_versions) = 0, 'another centre cannot see them');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from document_versions) = 2, 'staff see the whole history');
select public.restore_document_version((select id from document_versions where version_no = 1));
select public.assert((select version_no from document_versions where is_current) = 1, 'staff can make an earlier version current again');
reset role;
select 'OK timetable, invoices, document versions';
