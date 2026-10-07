\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set sme '11111111-0000-0000-0000-000000000005'
\set sme2 '11111111-0000-0000-0000-000000000009'
\set print '11111111-0000-0000-0000-000000000006'
\set outsider '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set Q 'e0000000-0000-0000-0000-000000000001'

-- ===== assessment requests =====
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
insert into assessment_requests (organization_id, request_type, trainee_id, applicant_name, unit_standard_id, motivation)
 values (:'orgA','exemption','d0000000-0000-0000-0000-000000000001','Tina One','f0000000-0000-0000-0000-000000000001','Did it elsewhere');
select public.assert((select reference_number from assessment_requests) ~ '^EXM-[0-9]{2}-[0-9]{5}$', 'reference generated');
select public.expect_error($$insert into assessment_requests (organization_id, request_type, trainee_id, applicant_name, motivation, status) values ('a0000000-0000-0000-0000-00000000000a','exemption','d0000000-0000-0000-0000-000000000001','Tina','x','approved')$$, 'row-level security', 'cannot submit as already approved');
select public.expect_error($$insert into assessment_requests (organization_id, request_type, trainee_id, applicant_name, motivation) values ('a0000000-0000-0000-0000-00000000000a','exemption','d0000000-0000-0000-0000-000000000002','Tom','x')$$, 'row-level security', 'cannot submit on behalf of another trainee');
-- applicant cannot self-approve
update assessment_requests set status='approved', outcome='competent', decision_notes='me';
select public.assert((select status from assessment_requests) = 'submitted', 'applicant cannot approve own request (update ignored)');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from assessment_requests) = 0, 'other trainee cannot see it');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from assessment_requests) = 0, 'other org cannot see it');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from assessment_requests) = 1, 'staff see it');
update assessment_requests set status='more_info_needed', decision_notes='Attach certificate';
select public.assert(public.t_notif_count(:'tr1'::uuid, null, 'assessment') = 1, 'applicant notified of status change');
select set_config('request.jwt.claim.sub', :'tr1', false);
update assessment_requests set status='submitted', motivation='added info', outcome='competent', decision_notes='hacked', assessor_name='me';
select public.assert((select status from assessment_requests) = 'submitted' and (select motivation from assessment_requests)='added info', 'applicant may resubmit with more info');
select public.assert((select outcome from assessment_requests) is null and (select decision_notes from assessment_requests) = 'Attach certificate' and (select assessor_name from assessment_requests) is null, 'staff-only fields protected from applicant');
select set_config('request.jwt.claim.sub', :'admin', false);
update assessment_requests set status='approved', decision_notes='Granted';
select public.assert((select decided_by from assessment_requests) = :'admin'::uuid and (select decided_at from assessment_requests) is not null, 'decision stamped');
select set_config('request.jwt.claim.sub', :'tr1', false);
update assessment_requests set status='submitted';
select public.assert((select status from assessment_requests) = 'approved', 'closed request cannot be reopened by applicant');
reset role;
select 'OK assessment requests';

-- ===== SME registration & approval =====
set role anon;
select public.assert(public.submit_sme_application('orga','Sam Expert','sme@a.test','081','N5','Welding','10 years') = 'submitted', 'public SME application');
select public.expect_error($$select public.submit_sme_application('orga','Sam Expert','SME@a.test','081','N5','Welding','10 years')$$, 'already awaiting', 'duplicate pending application blocked');
select public.expect_error($$select public.submit_sme_application('nowhere','A','a@b.co','1','1','x','y')$$, 'not found', 'unknown centre rejected');
select public.expect_error($$select public.submit_sme_application('orga','A','not-an-email','1','1','x','y')$$, 'valid email', 'bad email rejected');
select public.assert((select count(*) from sme_applications) = 0, 'anon cannot read applications');
reset role;
select public.submit_sme_application('orga','Nobody Account','nobody@a.test','081','N6','Plumbing','5 years');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.review_sme_application((select id from sme_applications limit 1), true, null)$$, 'not', 'trainee cannot review');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.expect_error($$select public.review_sme_application((select id from sme_applications where email='nobody@a.test'), false, '')$$, 'reason', 'rejection needs a reason');
select public.assert(public.review_sme_application((select id from sme_applications where email='sme@a.test'), true, 'ok') = 'approved_role_granted', 'approval grants role when account exists');
select public.assert(public.review_sme_application((select id from sme_applications where email='nobody@a.test'), true, 'ok') = 'approved_without_account', 'approval without account is reported');
select public.expect_error($$select public.review_sme_application((select id from sme_applications where email='sme@a.test'), false, 'x')$$, 'already reviewed', 'cannot review twice');
select public.assert((select count(*) from public.list_smes(:'orgA')) = 2, 'list_smes returns the two SMEs');
reset role;
select 'OK sme registration';

-- ===== development plan, question bank =====
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
insert into assessment_development_plans (id, organization_id, qualification_id, academic_year, assessment_type, assigned_to, questions_required)
 values ('90000000-0000-0000-0000-000000000001', :'orgA', :'Q', '2026', 'theory', :'sme', 5);
select set_config('request.jwt.claim.sub', :'sme', false);
select public.assert((select count(*) from assessment_development_plans) = 1, 'SME sees assigned plan');
update assessment_development_plans set status='in_progress', questions_required=1, assigned_to=:'sme2';
select public.assert((select questions_required from assessment_development_plans) = 5 and (select assigned_to from assessment_development_plans)=:'sme'::uuid, 'SME cannot change plan scope');
update assessment_development_plans set status='submitted';
select public.assert((select status from assessment_development_plans) = 'submitted', 'SME submits plan');
select set_config('request.jwt.claim.sub', :'sme2', false);
select public.assert((select count(*) from assessment_development_plans) = 0, 'other SME does not see plan');

-- SME adds questions
select set_config('request.jwt.claim.sub', :'sme', false);
insert into question_bank_items (organization_id, qualification_id, question_type, question_text, options, correct_answer, marks, status)
 select :'orgA', :'Q', 'multiple_choice', 'Q'||g, '["A","B"]', 'A', 2, 'submitted' from generate_series(1,6) g;
select public.assert((select count(*) from question_bank_items) = 6, 'SME sees own questions');
select public.expect_error($$insert into question_bank_items (organization_id, qualification_id, question_type, question_text, status) values ('a0000000-0000-0000-0000-00000000000a','e0000000-0000-0000-0000-000000000001','short_answer','sneaky','approved')$$, 'row-level security', 'SME cannot insert pre-approved questions');
update question_bank_items set status='approved', review_notes='mine';
select public.assert((select count(*) from question_bank_items where status='approved') = 0, 'SME cannot approve own questions');
select set_config('request.jwt.claim.sub', :'sme2', false);
select public.assert((select count(*) from question_bank_items) = 0, 'other SME cannot read these questions');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from question_bank_items) = 0, 'trainee cannot read questions');
select set_config('request.jwt.claim.sub', :'admin', false);
update question_bank_items set status='approved';
select public.assert((select count(*) from question_bank_items where status='approved' and reviewed_by = :'admin'::uuid) = 6, 'staff approve and are recorded as reviewer');
select set_config('request.jwt.claim.sub', :'sme', false);
update question_bank_items set question_text='changed' where question_text='Q1';
select public.assert((select question_text from question_bank_items where status='approved' limit 1) like 'Q%', 'approved question locked from author edits');

-- paper generation
select set_config('request.jwt.claim.sub', :'admin', false);
select public.generate_question_paper(:'Q', null, 'Paper 1', 7, 60, null) as paper \gset
select public.assert((select total_marks from question_papers where id = :'paper') = 6, 'paper never exceeds target marks (3 questions x 2 = 6 of 7)');
select public.assert((select count(*) from question_paper_items where paper_id = :'paper') = 3, 'three questions selected');
select public.generate_question_paper(:'Q', null, 'Paper 2', 6, null, null) as paper2 \gset
select public.assert((select count(*) from question_paper_items a join question_paper_items b on a.question_id=b.question_id where a.paper_id=:'paper' and b.paper_id=:'paper2') = 0, 'second paper avoids questions already used when enough fresh ones exist');
select public.expect_error($$select public.generate_question_paper('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'None', 10, null, null)$$, 'No approved questions', 'fails clearly when nothing matches');
select public.assert((select count(*) from question_papers where title='None') = 0, 'failed generation leaves no empty paper behind');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.generate_question_paper('e0000000-0000-0000-0000-000000000001', null, 'x', 5, null, null)$$, 'Not authorised', 'trainee cannot generate papers');
select public.assert((select count(*) from question_papers) = 0, 'trainee cannot read papers');
reset role;
select 'OK question bank and papers';

-- ===== sittings =====
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
insert into assessment_sittings (id, organization_id, qualification_id, title, sitting_date, induction_date, induction_venue)
 values ('80000000-0000-0000-0000-000000000001', :'orgA', :'Q', 'Welding Nov', current_date + 30, now() + interval '20 days', 'Hall B');
insert into assessment_sitting_candidates (sitting_id, trainee_id, organization_id) values
 ('80000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001',:'orgA'),
 ('80000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',:'orgA');
select public.expect_error($$select public.notify_printing_officer('80000000-0000-0000-0000-000000000001')$$, 'Approve at least one', 'cannot notify with no approved candidates');
update assessment_sitting_candidates set status='approved' where trainee_id='d0000000-0000-0000-0000-000000000001';
select public.assert(public.notify_printing_officer('80000000-0000-0000-0000-000000000001') = 1, 'printing officer notified');
select public.assert(public.t_notif_count(:'print'::uuid, null, 'assessment') = 1, 'printing officer has the notification');
select public.assert(public.notify_sitting_induction('80000000-0000-0000-0000-000000000001') = 2, 'induction notice to both candidates with accounts');
select public.assert((select induction_notified_at from assessment_sittings) is not null, 'induction notification time stored');
insert into assessment_roster_entries (sitting_id, organization_id, duty, staff_name) values ('80000000-0000-0000-0000-000000000001', :'orgA','invigilator','Mr X');
select public.expect_error($$insert into assessment_roster_entries (sitting_id, organization_id, duty, staff_name, session_start, session_end) values ('80000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','assessor','Y', now(), now() - interval '1 hour')$$, 'check constraint', 'roster end must be after start');
select set_config('request.jwt.claim.sub', :'print', false);
select public.assert((select count(*) from assessment_sittings) = 1 and (select count(*) from assessment_sitting_candidates) = 2, 'printing officer can read sittings and candidates');
update assessment_sitting_candidates set status='withdrawn';
select public.assert((select count(*) from assessment_sitting_candidates where status='withdrawn') = 0, 'printing officer cannot modify candidates');
select public.assert((select count(*) from assessment_roster_entries) = 0, 'printing officer cannot see roster');
select public.expect_error($$select public.notify_printing_officer('80000000-0000-0000-0000-000000000001')$$, 'Not authorised', 'printing officer cannot trigger notices');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from assessment_sitting_candidates) = 1, 'trainee sees only own candidacy');
select set_config('request.jwt.claim.sub', :'outsider', false);
select public.assert((select count(*) from assessment_sittings) = 0, 'other org sees no sittings');
reset role;
select 'OK sittings';
