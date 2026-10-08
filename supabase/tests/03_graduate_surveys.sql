\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
insert into alumni (id, organization_id, trainee_id, graduation_year, email, phone, active, final_trade_id) values
 ('a1000000-0000-0000-0000-000000000001', :'orgA', 'd0000000-0000-0000-0000-000000000001', 2026, 'tina@x.test', '+264811111111', true, 'c0000000-0000-0000-0000-000000000001'),
 ('a1000000-0000-0000-0000-000000000002', :'orgA', 'd0000000-0000-0000-0000-000000000002', 2025, null, '0812222222', true, null);

set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
insert into graduate_surveys (id, organization_id, title, anonymous, target_graduation_year) values
 ('50000000-0000-0000-0000-000000000001', :'orgA', 'Tracer 2026', false, 2026),
 ('50000000-0000-0000-0000-000000000002', :'orgA', 'Anon all', true, null),
 ('50000000-0000-0000-0000-000000000003', :'orgA', 'Empty', false, null);
insert into survey_questions (id, survey_id, position, question_text, question_type, options, required) values
 ('51000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',0,'Employed?','single_choice','["Yes","No"]',true),
 ('51000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001',1,'Rate us','rating','[]',false),
 ('51000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002',0,'Comments','text','[]',true);
select public.expect_error($$select public.send_graduate_survey('50000000-0000-0000-0000-000000000003','')$$, 'at least one question', 'cannot send survey without questions');
select public.assert(public.send_graduate_survey('50000000-0000-0000-0000-000000000001','https://app.test') = 1, 'targets only class of 2026');
select public.assert(public.send_graduate_survey('50000000-0000-0000-0000-000000000001','https://app.test') = 0, 'resend creates no duplicates');
select public.assert((select status from graduate_surveys where id='50000000-0000-0000-0000-000000000001') = 'open', 'survey opened');
select public.assert(public.send_graduate_survey('50000000-0000-0000-0000-000000000002','https://app.test') = 2, 'untargeted survey reaches all graduates');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.expect_error($$select public.send_graduate_survey('50000000-0000-0000-0000-000000000001','')$$, 'Not authorised', 'trainee cannot send surveys');
select public.assert((select count(*) from survey_recipients) = 0 and (select count(*) from survey_responses) = 0, 'trainee cannot read recipients or responses');
reset role;

create temp table st as
 select (select token from survey_recipients where survey_id='50000000-0000-0000-0000-000000000001') as named,
        (select token from survey_recipients where survey_id='50000000-0000-0000-0000-000000000002' and alumni_id='a1000000-0000-0000-0000-000000000001') as anon_tok;
grant all on st to anon;
set role anon;
select public.assert(jsonb_array_length(public.get_survey_by_token((select named from st))->'questions') = 2, 'anon loads survey questions via token');
select public.assert(public.get_survey_by_token((select named from st))->>'status' = 'open', 'survey is open');
select public.assert(public.get_survey_by_token('bogus') is null, 'bad token null');
select public.expect_error($$select public.submit_survey_response((select named from st), '{"51000000-0000-0000-0000-000000000002": 4}'::jsonb)$$, 'Please answer', 'required question enforced');
select public.expect_error($$select public.submit_survey_response((select named from st), '{"51000000-0000-0000-0000-000000000001": ""}'::jsonb)$$, 'Please answer', 'empty required answer rejected');
select public.assert(public.submit_survey_response((select named from st), '{"51000000-0000-0000-0000-000000000001": "Yes", "51000000-0000-0000-0000-000000000002": 4}'::jsonb), 'valid submission accepted');
select public.expect_error($$select public.submit_survey_response((select named from st), '{"51000000-0000-0000-0000-000000000001": "No"}'::jsonb)$$, 'already been completed', 'cannot answer twice');
select public.assert((public.get_survey_by_token((select named from st))->>'completed')::boolean, 'completed flag shown');
select public.assert(public.submit_survey_response((select anon_tok from st), '{"51000000-0000-0000-0000-000000000003": "great"}'::jsonb), 'anonymous survey submission');
reset role;
select public.assert((select recipient_id from survey_responses where survey_id='50000000-0000-0000-0000-000000000001') is not null, 'named survey links response to recipient');
select public.assert((select recipient_id from survey_responses where survey_id='50000000-0000-0000-0000-000000000002') is null, 'anonymous survey response is not linked to a recipient');
select public.assert((select completed_at from survey_recipients where token=(select anon_tok from st)) is not null, 'anonymous recipient still marked complete (no double answers)');
-- closed surveys refuse answers
update graduate_surveys set status='closed' where id='50000000-0000-0000-0000-000000000002';
set role anon;
select public.assert(public.get_survey_by_token((select anon_tok from st))->>'status' = 'closed', 'closed surveys report closed');
reset role;
update survey_recipients set completed_at = null where token=(select anon_tok from st);
set role anon;
select public.expect_error($$select public.submit_survey_response((select anon_tok from st), '{"51000000-0000-0000-0000-000000000003": "late"}'::jsonb)$$, 'closed', 'closed survey refuses answers');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :'admin', false);
select public.assert((select count(*) from survey_responses) = 2, 'staff read responses');
reset role;
select 'OK surveys';
