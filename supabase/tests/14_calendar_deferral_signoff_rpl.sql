\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set adminB '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'

-- ===== academic calendar =====
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
insert into academic_calendar_events (organization_id, title, event_type, academic_year, start_date, end_date) values (:'orgA', 'Term 1', 'term', '2026', '2026-01-12', '2026-04-10');
select public.expect_error($$insert into academic_calendar_events (organization_id, title, start_date, end_date) values ('a0000000-0000-0000-0000-00000000000a', 'Bad', '2026-05-02', '2026-05-01')$$, 'check', 'an event cannot end before it starts');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from academic_calendar_events) = 1, 'a trainee can read the calendar of their centre');
select public.expect_error($$insert into academic_calendar_events (organization_id, title, start_date) values ('a0000000-0000-0000-0000-00000000000a', 'Fake holiday', '2026-06-01')$$, 'row-level security', 'a trainee cannot add calendar events');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from academic_calendar_events) = 0, 'another centre cannot read the calendar');
reset role;

-- ===== deferral =====
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
insert into deferral_requests (organization_id, trainee_id, reason, defer_from, expected_return) values (:'orgA', :'T1', 'Family illness', current_date, current_date + 90);
select public.expect_error($$insert into deferral_requests (organization_id, trainee_id, reason) values ('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000001', 'again')$$, 'duplicate|unique', 'only one open deferral request per trainee');
select public.expect_error($$insert into deferral_requests (organization_id, trainee_id, reason) values ('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000002', 'for someone else')$$, 'row-level security', 'a trainee cannot ask on behalf of another trainee');
select public.expect_error($$update deferral_requests set status = 'approved', decision_notes = 'self approved'$$, 'row-level security', 'a trainee cannot approve their own request (refused)');
select public.expect_error($$update deferral_requests set reason = 'edited after the fact'$$, 'row-level security', 'a trainee cannot edit a request except to withdraw it');
select public.assert((select status from deferral_requests) = 'submitted' and (select reason from deferral_requests) = 'Family illness', 'the request is unchanged');
select public.expect_error($$select public.decide_deferral((select id from deferral_requests), true, null)$$, 'Not authorised', 'a trainee cannot decide');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from deferral_requests) = 0, 'a trainee does not see another trainee''s request');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.expect_error($$select public.decide_deferral((select id from deferral_requests), false, '')$$, 'reason', 'declining needs a reason');
select public.assert(public.decide_deferral((select id from deferral_requests), true, 'Approved for one term') = 'approved', 'staff approve');
reset role;
select public.assert((select status from trainees where id = :'T1') = 'deferred', 'approval sets the trainee to deferred');
select public.assert(public.t_notif_count(:'tr1'::uuid, 'Deferral approved') = 1, 'the trainee is told');
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.reinstate_deferred_trainee((select id from deferral_requests));
reset role;
select public.assert((select status from trainees where id = :'T1') = 'active', 'reinstating makes the trainee active again');
select public.assert((select status from deferral_requests) = 'reinstated', 'the request is closed');

-- ===== supervisor sign-off =====
insert into employers (id, organization_id, name) values ('e1000000-0000-0000-0000-000000000001', :'orgA', 'Acme Fabrication') on conflict do nothing;
insert into internship_placements (id, organization_id, trainee_id, employer_id, supervisor_name, start_date, end_date, status, placement_number)
 values ('91000000-0000-0000-0000-000000000001', :'orgA', :'T1', 'e1000000-0000-0000-0000-000000000001', 'Mr Boss', current_date - 30, current_date + 30, 'active', 'PL-1'),
        ('91000000-0000-0000-0000-000000000002', :'orgA', :'T2', 'e1000000-0000-0000-0000-000000000001', 'Ms Other', current_date - 30, current_date + 30, 'active', 'PL-2');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
insert into logbook_entries (organization_id, placement_id, trainee_id, entry_date, hours, activities, status) values
 (:'orgA', '91000000-0000-0000-0000-000000000001', :'T1', current_date - 3, 8, 'Cut and welded brackets', 'submitted'),
 (:'orgA', '91000000-0000-0000-0000-000000000001', :'T1', current_date - 2, 8, 'Grinding', 'draft');
create temp table tok(t text); grant all on tok to public;
insert into tok select public.create_supervisor_link('91000000-0000-0000-0000-000000000001', 'Mr Boss', 'boss@acme.test', 'https://app.test');
select public.expect_error($$select public.create_supervisor_link('91000000-0000-0000-0000-000000000002', 'x', null)$$, 'Not authorised', 'a trainee cannot make a link for another trainee''s placement');
select public.assert((select count(*) from logbook_supervisor_links) = 1, 'the trainee sees only their link');
reset role;
select public.assert((select count(*) from outbound_messages where recipient = 'boss@acme.test' and body like '%/logbook/sign/%') = 1, 'the supervisor is emailed the private link');

select id as entry_submitted from logbook_entries where status = 'submitted' \gset
select id as entry_draft from logbook_entries where status = 'draft' \gset
select t as tok_value from tok \gset
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select public.assert((select public.get_logbook_for_supervisor(:'tok_value') ->> 'trainee_number') = '062-26-00001', 'the supervisor opens the logbook by token');
select public.assert(jsonb_array_length(public.get_logbook_for_supervisor(:'tok_value') -> 'entries') = 1, 'drafts are not shown to the supervisor');
select public.assert(public.get_logbook_for_supervisor('not-a-token') is null, 'a wrong token shows nothing');
select public.expect_error(format('select public.supervisor_sign_entries(%L, array[%L::uuid], %L, false, null)', :'tok_value', :'entry_submitted', ''), 'full name', 'a signature needs a name');
do $$ begin
  if (select count(*) from logbook_supervisor_links) > 0 then raise exception 'ASSERT FAILED: the public can list tokens'; end if;
exception when insufficient_privilege then null; end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select public.assert(public.supervisor_sign_entries(:'tok_value', array[:'entry_submitted'::uuid, :'entry_draft'::uuid], 'Mr Boss', false, 'Good work') = 1, 'only the submitted entry is signed; the draft is untouched');
reset role;
select public.assert((select status from logbook_entries where id = :'entry_submitted') = 'supervisor_signed' and (select supervisor_signed_by from logbook_entries where id = :'entry_submitted') = 'Mr Boss', 'the signature is recorded');
select public.assert((select status from logbook_entries where id = :'entry_draft') = 'draft', 'draft stays a draft');
update logbook_supervisor_links set revoked = true;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select public.assert(public.get_logbook_for_supervisor(:'tok_value') is null, 'a revoked link stops working');
select public.expect_error(format('select public.supervisor_sign_entries(%L, array[%L::uuid], %L)', :'tok_value', :'entry_submitted', 'Mr Boss'), 'not valid|expired', 'cannot sign with a revoked link');
reset role;

-- ===== public RPL =====
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select public.assert(public.submit_public_rpl_application('orga', 'Joe Welder', 'N-9', '0811110000', 'joe@x.test', 'e0000000-0000-0000-0000-000000000001', 'Welder', 6, 'Six years on site') like 'RPL-PUB-%', 'a visitor can apply without an account');
select public.expect_error($$select public.submit_public_rpl_application('orga', 'Joe Again', 'N-9', '0811110000', 'joe@x.test', null, null, null, 'again')$$, 'already received', 'the same person cannot apply twice in a day');
select public.assert(public.submit_public_rpl_application('orga', 'Bot', null, '0800000000', 'bot@x.test', null, null, null, 'spam', 'http://spam') = 'RPL-PUB-00-00000', 'a filled honeypot is dropped');
select public.expect_error($$select public.submit_public_rpl_application('orga', 'No Contact', null, null, null, null, null, null, 'x')$$, 'reach you', 'a way to contact the applicant is required');
select public.expect_error($$select public.submit_public_rpl_application('nope', 'X', null, '1', null, null, null, null, 'x')$$, 'not found', 'unknown centre');
do $$ begin
  if (select count(*) from public_rpl_applications) > 0 then raise exception 'ASSERT FAILED: the public can read applications'; end if;
exception when insufficient_privilege then null; end $$;
reset role;
select public.assert((select count(*) from public_rpl_applications) = 1, 'the spam attempt left nothing behind');
select public.assert((select count(*) from outbound_messages where recipient = 'joe@x.test') = 1, 'the applicant gets a confirmation');
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from public_rpl_applications) = 0, 'a trainee cannot read public applications');
select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from public_rpl_applications) = 1, 'assessment staff can');
select public.convert_public_rpl_application((select id from public_rpl_applications)) is not null as ok \gset
reset role;
select public.assert((select count(*) from assessment_requests where request_type = 'rpl' and applicant_name = 'Joe Welder') = 1, 'conversion creates a normal RPL request');
select 'OK calendar, deferral, supervisor sign-off, public RPL';
