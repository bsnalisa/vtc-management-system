\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set sa '98100000-0000-0000-0000-000000000001'
\set oa '98100000-0000-0000-0000-000000000002'
\set oaB '98100000-0000-0000-0000-000000000003'
\set staff '98100000-0000-0000-0000-000000000004'
\set staffB '98100000-0000-0000-0000-000000000005'
\set other '98100000-0000-0000-0000-000000000006'

insert into auth.users (id,email) values (:'sa','sa@x.test'),(:'oa','oa@a.test'),(:'oaB','oab@b.test'),(:'staff','staff@a.test'),(:'staffB','staffb@b.test'),(:'other','other@a.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '98100000%' on conflict (user_id) do update set full_name = excluded.full_name;
update profiles set full_name = split_part(email,'@',1) where user_id::text like '98100000%';
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'sa','super_admin',null),(:'oa','organization_admin',:'orgA'),(:'oaB','organization_admin',:'orgB'),(:'staff','librarian',:'orgA'),(:'staffB','librarian',:'orgB'),(:'other','hr_officer',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;
select count(*) as nclasses from classes where organization_id = :'orgA' and active and approval_status = 'approved' \gset

set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert(jsonb_array_length(public.dashboard_widget_catalogue_list()) >= 8, 'the widget catalogue is readable');
select public.role_factory_create('centre_viewer', 'Centre Viewer',
  'The Centre Viewer keeps an eye on the centre: reviews how many trainees and classes are active, follows class capacity and enrolment, and reports on the standing of the centre to management each month.') as v \gset
select public.role_factory_save_draft(:'v', (select job_description from factory_role_versions where id = :'v'), null, ARRAY['centre.overview', 'classes.view']);
select public.expect_error($$select public.role_factory_save_widgets((select id from factory_role_versions limit 1), ARRAY['fees.collection'])$$, 'needs the capability', 'a widget cannot be added without the capability it needs');
select public.expect_error($$select public.role_factory_save_widgets((select id from factory_role_versions limit 1), ARRAY['made.up'])$$, 'Unknown widget', 'nor an invented widget');
select public.role_factory_save_widgets(:'v', ARRAY['classes.overview', 'centre.headcounts', 'classes.overview']);
select public.assert((select dashboard_widgets from factory_role_versions where id = :'v') = ARRAY['classes.overview', 'centre.headcounts'], 'the widget list is saved without duplicates');
-- a capability removed after choosing widgets blocks submission
select public.role_factory_save_draft(:'v', (select job_description from factory_role_versions where id = :'v'), null, ARRAY['centre.overview']);
select public.expect_error($$select public.role_factory_submit((select id from factory_role_versions limit 1))$$, 'needs a capability', 'a widget whose capability was removed blocks review');
select public.role_factory_save_draft(:'v', (select job_description from factory_role_versions where id = :'v'), null, ARRAY['centre.overview', 'classes.view']);
select public.role_factory_submit(:'v');
reset role;
select public.expect_error($$update factory_role_versions set dashboard_widgets = ARRAY['fees.collection'] where status = 'pending_review'$$, 'can never be edited', 'a submitted version keeps its widgets');
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert(public.role_factory_decide(:'v', true, 'ok') = 'approved', 'the role is approved');
select public.assert((select approved_widgets from factory_role_versions where id = :'v') = ARRAY['classes.overview', 'centre.headcounts'], 'with its approved widgets');
select (select id from factory_roles where role_code = 'centre_viewer') as r \gset

-- nothing before assignment
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(jsonb_array_length(public.my_dashboard(:'orgA') -> 'widgets') = 0, 'before assignment the dashboard is empty');
select public.expect_error($$select public.dashboard_widget_data('a0000000-0000-0000-0000-00000000000a', 'classes.overview')$$, 'not part of your dashboard', 'and no widget data is available');

select set_config('request.jwt.claim.sub', :'oa', false);
select public.role_factory_assign(:'orgA', :'staff', :'r');
select set_config('request.jwt.claim.sub', :'oaB', false);
select public.role_factory_assign(:'orgB', :'staffB', :'r');

select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert((select array_agg(w ->> 'code' order by w ->> 'code') from jsonb_array_elements(public.my_dashboard(:'orgA') -> 'widgets') w) = ARRAY['centre.headcounts', 'classes.overview'], 'the dashboard shows exactly the approved widgets');
select public.assert((public.dashboard_widget_data(:'orgA', 'centre.headcounts') -> 'stats' -> 1 ->> 'value')::int = :nclasses, 'the headcounts are this centre''s');
select public.assert(jsonb_array_length(public.dashboard_widget_data(:'orgA', 'classes.overview') -> 'rows') = least(:nclasses, 30), 'the class table lists approved classes');
select public.expect_error($$select public.dashboard_widget_data('a0000000-0000-0000-0000-00000000000a', 'fees.collection')$$, 'not part of your dashboard', 'a widget outside the role is refused');
select public.expect_error($$select public.dashboard_widget_data('a0000000-0000-0000-0000-00000000000a', 'trainees.by_trade')$$, 'not part of your dashboard', 'whatever the widget');
select public.expect_error($$select public.dashboard_widget_data('b0000000-0000-0000-0000-00000000000b', 'classes.overview')$$, 'not part of your dashboard', 'and another centre''s data is refused');
select public.assert(jsonb_array_length(public.my_dashboard(:'orgB') -> 'widgets') = 0, 'the assignment at another centre does not carry over');

select set_config('request.jwt.claim.sub', :'staffB', false);
select public.assert((public.dashboard_widget_data(:'orgB', 'centre.headcounts') -> 'stats' -> 1 ->> 'value')::int = 0 and jsonb_array_length(public.dashboard_widget_data(:'orgB', 'classes.overview') -> 'rows') = 0, 'a holder at another centre sees that centre''s figures only');
select public.expect_error($$select public.dashboard_widget_data('a0000000-0000-0000-0000-00000000000a', 'classes.overview')$$, 'not part of your dashboard', 'and cannot read the first centre');

select set_config('request.jwt.claim.sub', :'other', false);
select public.expect_error($$select public.dashboard_widget_data('a0000000-0000-0000-0000-00000000000a', 'classes.overview')$$, 'not part of your dashboard', 'a colleague without the role gets nothing');

-- a new version: the old dashboard stays until the new one is approved; then it changes
select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_new_version(:'r') as v2 \gset
select public.assert((select dashboard_widgets from factory_role_versions where id = :'v2') = ARRAY['classes.overview', 'centre.headcounts'], 'a new version starts from the approved widgets');
select public.role_factory_save_widgets(:'v2', ARRAY['centre.headcounts']);
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(jsonb_array_length(public.my_dashboard(:'orgA') -> 'widgets') = 2, 'a draft changes nothing for the holders');
select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_submit(:'v2');
select public.role_factory_decide(:'v2', true, 'smaller');
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(jsonb_array_length(public.my_dashboard(:'orgA') -> 'widgets') = 1, 'once approved the dashboard follows the new version');

-- retiring removes the dashboard
select set_config('request.jwt.claim.sub', :'sa', false);
select public.role_factory_retire(:'r', 'No longer needed');
select set_config('request.jwt.claim.sub', :'staff', false);
select public.assert(jsonb_array_length(public.my_dashboard(:'orgA') -> 'widgets') = 0, 'a retired role has no dashboard');
select public.expect_error($$select public.dashboard_widget_data('a0000000-0000-0000-0000-00000000000a', 'centre.headcounts')$$, 'not part of your dashboard', 'and no data');
reset role;
select 'OK role dashboards';
