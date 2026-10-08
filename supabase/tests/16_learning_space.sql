\set ON_ERROR_STOP on
\set admin '11111111-0000-0000-0000-000000000001'
\set tr1 '11111111-0000-0000-0000-000000000003'
\set tr2 '11111111-0000-0000-0000-000000000008'
\set trainerA '11111111-0000-0000-0000-000000000004'
\set adminB '11111111-0000-0000-0000-000000000007'
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set T2 'd0000000-0000-0000-0000-000000000002'
\set C 'c1000000-0000-0000-0000-000000000001'

insert into trainers (id, organization_id, user_id, trainer_id, full_name) values ('70000000-0000-0000-0000-0000000000b1', :'orgA', :'trainerA', 'TB', 'Trainer B') on conflict do nothing;
insert into classes (id, organization_id, trade_id, level, training_mode, class_code, class_name, academic_year, trainer_id)
 values (:'C', :'orgA', 'c0000000-0000-0000-0000-000000000001', 1, 'fulltime', 'W1', 'Welding 1', '2026', (select id from trainers where user_id = :'trainerA'));
insert into class_enrollments (class_id, trainee_id) values (:'C', :'T1') on conflict do nothing;
delete from class_enrollments where class_id = :'C' and trainee_id = :'T2'; -- trainee 2 is NOT in this class

-- ===== content =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trainerA', false);
insert into learning_items (class_id, title, item_type, body, published) values (:'C', 'Welcome', 'page', 'Hello', true), (:'C', 'Draft notes', 'page', 'later', false);
insert into learning_items (class_id, title, item_type, url, published) values (:'C', 'Recorded session 1', 'recording', 'https://video.example/1', true);
select public.expect_error($$insert into learning_items (class_id, title, item_type, url) values ('c1000000-0000-0000-0000-000000000001', 'Bad', 'link', 'javascript:alert(1)')$$, 'check', 'only web addresses are accepted');
select public.expect_error($$insert into learning_items (class_id, title, item_type) values ('c1000000-0000-0000-0000-000000000001', 'No url', 'link')$$, 'check', 'a link needs an address');
select public.assert((select organization_id from learning_items limit 1) = :'orgA', 'the centre is taken from the class');
select public.assert((select count(*) from public.my_learning_classes() where can_manage) = 1, 'the trainer sees the class as manageable');
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from learning_items) = 2, 'an enrolled trainee sees only published content');
select public.expect_error($$insert into learning_items (class_id, title, item_type, body) values ('c1000000-0000-0000-0000-000000000001', 'Mine', 'page', 'x')$$, 'row-level security', 'a trainee cannot add content');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from learning_items) = 0, 'a trainee not in the class sees nothing');
select public.assert((select count(*) from public.my_learning_classes()) = 0, 'and has no classes');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.assert((select count(*) from learning_items) = 0, 'another centre sees nothing');

-- ===== assignments =====
select set_config('request.jwt.claim.sub', :'trainerA', false);
insert into learning_assignments (id, class_id, title, instructions, due_at, max_marks, published) values
 ('a1000000-0000-0000-0000-000000000001', :'C', 'Weld report', 'Write up', now() + interval '2 days', 50, true),
 ('a1000000-0000-0000-0000-000000000002', :'C', 'Late one', 'Was due', now() - interval '1 day', 20, true),
 ('a1000000-0000-0000-0000-000000000003', :'C', 'Unpublished', 'Not yet', null, 10, false);
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from learning_assignments) = 2, 'trainee sees published assignments only');
insert into assignment_submissions (assignment_id, organization_id, trainee_id, answer_text) values ('a1000000-0000-0000-0000-000000000001', :'orgA', :'T1', 'My report');
insert into assignment_submissions (assignment_id, organization_id, trainee_id, answer_text) values ('a1000000-0000-0000-0000-000000000002', :'orgA', :'T1', 'Sorry late');
select public.assert((select late from assignment_submissions where assignment_id = 'a1000000-0000-0000-0000-000000000002'), 'late work is accepted and flagged');
select public.assert(not (select late from assignment_submissions where assignment_id = 'a1000000-0000-0000-0000-000000000001'), 'on-time work is not flagged');
select public.expect_error($$insert into assignment_submissions (assignment_id, organization_id, trainee_id, answer_text) values ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000001', 'x')$$, 'not open|row-level', 'cannot submit to an unpublished assignment');
select public.expect_error($$insert into assignment_submissions (assignment_id, organization_id, trainee_id, answer_text) values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000002', 'x')$$, 'row-level security', 'cannot submit as another trainee');
update assignment_submissions set marks = 50, feedback = 'self', answer_text = 'Revised report' where assignment_id = 'a1000000-0000-0000-0000-000000000001';
select public.assert((select marks from assignment_submissions where assignment_id = 'a1000000-0000-0000-0000-000000000001') is null and (select answer_text from assignment_submissions where assignment_id = 'a1000000-0000-0000-0000-000000000001') = 'Revised report', 'a trainee can revise their answer but cannot set marks');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from assignment_submissions) = 0, 'other trainees cannot see submissions');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.expect_error($$update assignment_submissions set status = 'graded', marks = 80 where assignment_id = 'a1000000-0000-0000-0000-000000000001'$$, 'cannot be more than', 'marks above the maximum are refused');
update assignment_submissions set status = 'graded', marks = 45, feedback = 'Good' where assignment_id = 'a1000000-0000-0000-0000-000000000001';
select public.assert((select graded_by from assignment_submissions where status = 'graded') = :'trainerA', 'the grader is recorded');
select set_config('request.jwt.claim.sub', :'tr1', false);
update assignment_submissions set answer_text = 'changed after grading' where status = 'graded';
select public.assert((select answer_text from assignment_submissions where status = 'graded') = 'Revised report', 'graded work is locked');

-- ===== quizzes =====
select set_config('request.jwt.claim.sub', :'trainerA', false);
insert into learning_quizzes (id, class_id, title, time_limit_minutes, pass_percent, attempts_allowed, show_answers, published) values ('b1000000-0000-0000-0000-000000000001', :'C', 'Safety quiz', 10, 60, 2, true, true);
insert into quiz_questions (id, quiz_id, position, question_text, question_type, options, correct_answer, marks) values
 ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 1, 'Which eye protection?', 'single_choice', '["Sunglasses","Welding helmet","None"]', 'Welding helmet', 2),
 ('b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 2, 'Gloves are optional', 'true_false', '["True","False"]', 'False', 1);
select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((select count(*) from quiz_questions) = 0, 'trainees cannot read the questions table (it holds the answers)');
select public.assert(position('correct' in public.start_quiz_attempt('b1000000-0000-0000-0000-000000000001')::text) = 0, 'the quiz sent to a trainee carries no answers');
select public.assert(jsonb_array_length(public.start_quiz_attempt('b1000000-0000-0000-0000-000000000001') -> 'questions') = 2, 'and has both questions');
select public.assert((select count(*) from quiz_attempts) = 1, 'resuming does not start a second attempt');
select id as att from quiz_attempts \gset
select public.assert((public.submit_quiz_attempt(:'att', '{"b2000000-0000-0000-0000-000000000001":"Welding helmet","b2000000-0000-0000-0000-000000000002":"True"}'::jsonb) ->> 'score')::numeric = 2, 'marked: 2 of 3');
select public.assert((select passed from quiz_attempts where id = :'att'), '67% passes a 60% quiz');
select public.expect_error(format('select public.submit_quiz_attempt(%L, %L::jsonb)', :'att', '{}'), 'already submitted', 'an attempt cannot be submitted twice');
update quiz_attempts set score = 3;
select public.assert((select score from quiz_attempts where id = :'att') = 2, 'score unchanged');
select public.start_quiz_attempt('b1000000-0000-0000-0000-000000000001');
select id as att2 from quiz_attempts where submitted_at is null \gset
select public.submit_quiz_attempt(:'att2', '{}'::jsonb);
select public.expect_error($$select public.start_quiz_attempt('b1000000-0000-0000-0000-000000000001')$$, 'used all', 'attempts are limited');
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.expect_error($$select public.start_quiz_attempt('b1000000-0000-0000-0000-000000000001')$$, 'not found', 'a trainee outside the class cannot take it');
reset role;
-- time limit: an attempt started 30 minutes ago on a 10 minute quiz scores nothing
insert into quiz_attempts (id, quiz_id, organization_id, trainee_id, started_at) values ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', :'orgA', :'T1', now() - interval '30 minutes');
update learning_quizzes set attempts_allowed = 5;
set role authenticated; select set_config('request.jwt.claim.sub', :'tr1', false);
select public.assert((public.submit_quiz_attempt('b3000000-0000-0000-0000-000000000001', '{"b2000000-0000-0000-0000-000000000001":"Welding helmet"}'::jsonb) ->> 'too_late')::boolean, 'a submission after the time limit is marked too late');
select public.assert((select score from quiz_attempts where id = 'b3000000-0000-0000-0000-000000000001') = 0, 'and scores nothing');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.assert((select count(*) from quiz_attempts) >= 3, 'the trainer sees all attempts');

-- ===== forum =====
select set_config('request.jwt.claim.sub', :'tr1', false);
insert into forum_topics (class_id, title, body) values (:'C', 'Question on welds', 'How thick?');
select public.assert((select author_name from forum_topics) = 'trainee1', 'the author name is stamped by the server');
select public.assert((select organization_id from forum_topics) = :'orgA', 'and so is the centre');
insert into forum_posts (topic_id, body) select id, 'Reply from trainee' from forum_topics;
select set_config('request.jwt.claim.sub', :'tr2', false);
select public.assert((select count(*) from forum_topics) = 0 and (select count(*) from forum_posts) = 0, 'outsiders cannot read the forum');
select public.expect_error($$insert into forum_topics (class_id, title) values ('c1000000-0000-0000-0000-000000000001', 'Spam')$$, 'row-level security', 'outsiders cannot post');
select set_config('request.jwt.claim.sub', :'trainerA', false);
update forum_topics set locked = true;
select public.expect_error($$insert into forum_posts (topic_id, body) select id, 'more' from forum_topics$$, 'row-level security', 'locked topics take no replies');
select set_config('request.jwt.claim.sub', :'tr1', false);
update forum_topics set locked = false;
select public.assert((select locked from forum_topics), 'still locked');
reset role;
select 'OK learning space';
