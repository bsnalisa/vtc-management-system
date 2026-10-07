\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set outsider '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'

insert into alumni (id, organization_id, trainee_id, graduation_year, email, phone, active) values
 ('a1000000-0000-0000-0000-000000000001', :'orgA', 'd0000000-0000-0000-0000-000000000001', 2026, 'tina@x.test', '+264811111111', true),
 ('a1000000-0000-0000-0000-000000000002', :'orgA', 'd0000000-0000-0000-0000-000000000002', 2026, null, '0812222222', true),
 ('a1000000-0000-0000-0000-000000000003', :'orgA', 'd0000000-0000-0000-0000-000000000002', 2020, 'old@x.test', '0813333333', true);

set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
insert into graduation_ceremonies (id, organization_id, title, graduation_year, ceremony_date, venue)
 values ('ce000000-0000-0000-0000-000000000001', :'orgA', 'Class of 2026', 2026, now() + interval '30 days', 'Main Hall');
select public.assert(public.send_graduation_invitations('ce000000-0000-0000-0000-000000000001','https://app.test') = 2, 'invites only graduates of the ceremony year');
select public.assert((select count(*) from graduation_invitations) = 2, 'two invitations created');
select public.assert((select count(*) from outbound_messages where channel='email') = 1, 'one email (only Tina has an address)');
select public.assert((select count(*) from outbound_messages where channel='sms') = 2, 'two SMS');
select public.assert((select body from outbound_messages where channel='sms' limit 1) like '%https://app.test/graduation/rsvp/%', 'SMS carries personal link');
select public.assert(public.t_notif_count(:'tr1'::uuid, null, 'graduation') = 1, 'portal notification for graduate with account');
select public.assert(public.send_graduation_invitations('ce000000-0000-0000-0000-000000000001','https://app.test') = 2, 'resend reaches unanswered graduates');
select public.assert((select count(*) from graduation_invitations) = 2, 'resend does not duplicate invitations');
-- outsider/trainee cannot send
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.send_graduation_invitations('ce000000-0000-0000-0000-000000000001','')$$, 'Not authorised', 'trainee cannot send invitations');
select public.assert((select count(*) from graduation_invitations) = 0 and (select count(*) from outbound_messages) = 0, 'trainee cannot read invitations or queued messages');
reset role;

-- anonymous RSVP by token
create temp table tok as select token from graduation_invitations where alumni_id='a1000000-0000-0000-0000-000000000001';
grant all on tok to anon;
set role anon;
select public.assert((select (public.get_graduation_invitation((select token from tok)))->>'title') = 'Class of 2026', 'anon can read invitation by token');
select public.assert(public.get_graduation_invitation('nope') is null, 'bad token returns null');
select public.expect_error($$select public.respond_graduation_invitation((select token from tok), 3::smallint)$$, 'Reply 1', 'only 1 or 2 accepted');
select public.assert(public.respond_graduation_invitation((select token from tok), 1::smallint), 'RSVP yes');
select public.assert((select (public.get_graduation_invitation((select token from tok)))->>'response_code') = '1', 'response recorded');
select public.assert(public.respond_graduation_invitation((select token from tok), 2::smallint), 'RSVP can be changed');
select public.assert(not public.respond_graduation_invitation('nope', 1::smallint), 'unknown token changes nothing');
select public.assert((select count(*) from graduation_invitations) = 0, 'anon reads no invitation rows');
reset role;
select public.assert((select response_code from graduation_invitations where alumni_id='a1000000-0000-0000-0000-000000000001') = 2 and (select response_channel from graduation_invitations where alumni_id='a1000000-0000-0000-0000-000000000001') = 'link', 'final link reply stored');

-- SMS reply path (service role only)
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.expect_error($$select public.respond_graduation_invitation_by_phone('0812222222', 1::smallint)$$, 'permission denied', 'staff cannot call the SMS function directly');
reset role; set role service_role;
select public.assert(public.respond_graduation_invitation_by_phone('+264 81 222 2222', 1::smallint) = 'Class of 2026', 'SMS reply matched by last 9 digits');
select public.assert(public.respond_graduation_invitation_by_phone('+264 81 222 2222', 2::smallint) is null, 'answered invitation is not matched again');
select public.assert(public.respond_graduation_invitation_by_phone('0819999999', 1::smallint) is null, 'unknown number matches nothing');
select public.assert(public.respond_graduation_invitation_by_phone('0813333333', 1::smallint) is null, 'old class (past ceremony year) not matched');
reset role;
select public.assert((select response_code from graduation_invitations where alumni_id='a1000000-0000-0000-0000-000000000002') = 1 and (select response_channel from graduation_invitations where alumni_id='a1000000-0000-0000-0000-000000000002') = 'sms', 'SMS reply stored as channel sms');

-- dispatcher claim
set role service_role;
select public.assert((select count(*) from public.claim_outbound_messages(2)) = 2, 'claims requested batch');
select public.assert((select count(*) from outbound_messages where status='sending' and attempts=1) = 2, 'claimed rows marked sending');
select public.assert((select count(*) from public.claim_outbound_messages(50)) = 4, 'second claim takes the remaining four');
reset role;
select public.assert((select count(*) from outbound_messages where status='sending' and attempts=1) = (select count(*) from outbound_messages), 'every message claimed exactly once');
set role service_role;
select public.assert((select count(*) from public.claim_outbound_messages(50)) = 0, 'nothing left to claim while others are in flight');
reset role;
update outbound_messages set claimed_at = now() - interval '11 minutes' where status='sending';
set role service_role;
select public.assert((select count(*) from public.claim_outbound_messages(50)) = (select count(*) from outbound_messages), 'stale claims are retried');
reset role;
select public.assert((select min(attempts) from outbound_messages) = 2, 'attempts counted');
update outbound_messages set claimed_at = now() - interval '11 minutes', attempts = 3 where status='sending';
set role service_role;
select public.assert((select count(*) from public.claim_outbound_messages(50)) = 0, 'gives up after 3 attempts');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.expect_error($$select * from public.claim_outbound_messages(5)$$, 'permission denied', 'staff cannot claim messages');
reset role;
select 'OK graduation invitations and dispatch';
