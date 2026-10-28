\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set rq '97d00000-0000-0000-0000-000000000001'
\set hot '97d00000-0000-0000-0000-000000000002'
\set hof '97d00000-0000-0000-0000-000000000003'
\set po '97d00000-0000-0000-0000-000000000004'
\set po2 '97d00000-0000-0000-0000-000000000005'
\set cm '97d00000-0000-0000-0000-000000000006'
\set poB '97d00000-0000-0000-0000-000000000007'

insert into auth.users (id,email) values (:'rq','rq@a.test'),(:'hot','hot@a.test'),(:'hof','hof@a.test'),(:'po','po@a.test'),(:'po2','po2@a.test'),(:'cm','cm@a.test'),(:'poB','pob@b.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '97d00000%' on conflict (user_id) do update set full_name = excluded.full_name;
update profiles set full_name = split_part(email,'@',1) where user_id::text like '97d00000%';
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values
 (:'rq','trainer',:'orgA'),(:'hot','head_of_training',:'orgA'),(:'hof','head_of_finance_admin',:'orgA'),(:'po','procurement_officer',:'orgA'),(:'po2','procurement_officer',:'orgA'),
 (:'cm','centre_manager',:'orgA'),(:'poB','procurement_officer',:'orgB');
alter table user_roles enable trigger trg_guard_privileged_roles;
select public.seed_requisition_workflow(:'orgA');
insert into user_supervisors (organization_id, user_id, supervisor_user_id) values (:'orgA', :'rq', :'hot');

-- ===== before any template: the built-in form =====
set role authenticated; select set_config('request.jwt.claim.sub', :'rq', false);
select public.assert((public.requisition_template_current(:'orgA') ->> 'version')::int = 1 and (public.requisition_template_current(:'orgA') -> 'definition' -> 'fields') = '[]'::jsonb, 'a centre without a published template uses the built-in form');
select public.expect_error($$select public.requisition_template_overview('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'a requester does not see the template manager');
select public.expect_error($$select public.requisition_template_save_draft('a0000000-0000-0000-0000-00000000000a', '{}'::jsonb, null)$$, 'Only the Procurement Officer', 'nor change it');
-- a requisition made now is pinned to the built-in form
select public.requisition_save_draft(null, :'orgA', 'Old form', 'Training', '[{"description":"Pens","quantity":2}]'::jsonb) as rold \gset

-- ===== proposing =====
select set_config('request.jwt.claim.sub', :'po', false);
select public.expect_error($$select public.requisition_template_save_draft('a0000000-0000-0000-0000-00000000000a', '{"approvers":["x"]}'::jsonb, null)$$, 'approval stages are fixed', 'a template cannot carry approval stages');
select public.expect_error($$select public.requisition_template_save_draft('a0000000-0000-0000-0000-00000000000a', '{"fields":[{"key":"purpose","label":"P","type":"text"}]}'::jsonb, null)$$, 'used by the system', 'the fixed fields cannot be redefined');
select public.expect_error($$select public.requisition_template_save_draft('a0000000-0000-0000-0000-00000000000a', '{"fields":[{"key":"Bad Key","label":"P","type":"text"}]}'::jsonb, null)$$, 'lower-case', 'keys are checked');
select public.expect_error($$select public.requisition_template_save_draft('a0000000-0000-0000-0000-00000000000a', '{"fields":[{"key":"pick","label":"Pick","type":"select","options":["a"]}]}'::jsonb, null)$$, '2 to 20 options', 'choice lists need options');
select public.expect_error($$select public.requisition_template_save_draft('a0000000-0000-0000-0000-00000000000a', '{"labels":{"approver":"x"}}'::jsonb, null)$$, 'Unknown label', 'only the form labels can be renamed');
select public.expect_error($$select public.requisition_template_save_draft('a0000000-0000-0000-0000-00000000000a', '{"labels":{"quantity":""}}'::jsonb, null)$$, 'must be 1 to 60', 'a label cannot be blanked');
select public.requisition_template_save_draft(:'orgA', '{"instructions":"Attach the quotation.","labels":{"description":"Item","specifications":"Notes"},
  "fields":[{"key":"project","label":"Project code","type":"text","required":true},{"key":"needed_by","label":"Needed by","type":"date"}],
  "columns":[{"key":"brand","label":"Preferred brand","type":"text"},{"key":"unit","label":"Unit","type":"select","required":true,"options":["each","box"]}],
  "documents":[{"key":"quotation","label":"Supplier quotation","required":true}]}'::jsonb, 'Add project, unit and quotation') as t2 \gset
select public.assert((select status from requisition_templates where id = :'t2') = 'draft' and (select version from requisition_templates where id = :'t2') = 2, 'a draft is version 2');
select public.assert((public.requisition_template_current(:'orgA') ->> 'version')::int = 1, 'a draft does not change the form in use');
select public.requisition_template_submit(:'t2');
select public.expect_error($$select public.requisition_template_save_draft('a0000000-0000-0000-0000-00000000000a', '{}'::jsonb, null)$$, 'waiting for confirmation', 'a submitted proposal cannot be edited');
select public.expect_error($$select public.requisition_template_decide((select id from requisition_templates where status = 'pending_confirmation'), true, null)$$, 'Only the Head of Finance', 'the Procurement Officer cannot confirm');
select public.expect_error($$update requisition_templates set definition = '{}'::jsonb$$, 'permission denied', 'no direct writes');
select set_config('request.jwt.claim.sub', :'po2', false);
select public.expect_error($$select public.requisition_template_decide((select id from requisition_templates where status = 'pending_confirmation'), true, null)$$, 'Only the Head of Finance', 'another Procurement Officer cannot either');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.expect_error($$select public.requisition_template_decide((select id from requisition_templates where status = 'pending_confirmation'), true, null)$$, 'Only the Head of Finance', 'the Centre Manager only confirms where there is no Head of Finance');
select public.assert((public.requisition_template_overview(:'orgA') ->> 'can_edit')::boolean = false and (public.requisition_template_overview(:'orgA') ->> 'can_confirm')::boolean = false, 'the Centre Manager reads the template manager');
select set_config('request.jwt.claim.sub', :'poB', false);
select public.expect_error($$select public.requisition_template_overview('a0000000-0000-0000-0000-00000000000a')$$, 'Not authorised', 'another centre cannot read it');
select public.assert((select count(*) from requisition_templates) = 0, 'nor see its rows');

-- ===== withdraw and rejection =====
select set_config('request.jwt.claim.sub', :'po', false);
select public.requisition_template_withdraw(:'t2');
select public.assert((select status from requisition_templates where id = :'t2') = 'draft', 'a proposal can be withdrawn');
select public.requisition_template_submit(:'t2');
select set_config('request.jwt.claim.sub', :'hof', false);
select public.expect_error($$select public.requisition_template_decide((select id from requisition_templates where status = 'pending_confirmation'), false, 'no')$$, 'reason', 'a rejection needs a reason');
select public.requisition_template_decide(:'t2', false, 'Please drop the unit column');
select public.assert((select status from requisition_templates where id = :'t2') = 'rejected', 'rejected');
select public.expect_error($$update requisition_templates set definition = '{}'::jsonb where status = 'rejected'$$, 'permission denied', 'a rejected template is kept as it was');
select set_config('request.jwt.claim.sub', :'po', false);
select public.requisition_template_save_draft(:'orgA', '{"instructions":"Attach the quotation.","labels":{"description":"Item","specifications":"Notes"},
  "fields":[{"key":"project","label":"Project code","type":"text","required":true},{"key":"needed_by","label":"Needed by","type":"date"}],
  "columns":[{"key":"brand","label":"Preferred brand","type":"text"}],
  "documents":[{"key":"quotation","label":"Supplier quotation","required":true}]}'::jsonb, 'Without the unit column') as t3 \gset
select public.assert((select version from requisition_templates where id = :'t3') = 3, 'the next proposal is version 3');
select public.requisition_template_submit(:'t3');
select public.expect_error($$select public.requisition_template_decide((select id from requisition_templates where status = 'pending_confirmation'), true, null)$$, 'Only the Head of Finance', 'still not the proposer');

-- ===== publishing =====
select set_config('request.jwt.claim.sub', :'hof', false);
select public.assert(public.requisition_template_decide(:'t3', true, 'Agreed') = 3, 'the Head of Finance confirms');
select public.assert((select status from requisition_templates where id = :'t3') = 'published' and (select count(*) from requisition_templates where status = 'published') = 1, 'one published version');
select public.expect_error($$select public.requisition_template_decide((select id from requisition_templates where version = 3), true, null)$$, 'not waiting', 'a decision is final');
reset role;
select public.assert((select count(*) from requisition_template_events where event in ('drafted', 'submitted', 'withdrawn', 'rejected', 'published')) >= 6, 'every step is recorded');
select public.expect_error($$update requisition_template_events set note = 'x'$$, 'can never be changed', 'the history is append-only');
select public.expect_error($$update requisition_templates set definition = '{}'::jsonb where status = 'published'$$, 'can never be edited', 'a published template cannot be edited');

-- ===== old requisitions keep their form; new ones use the new one =====
set role authenticated; select set_config('request.jwt.claim.sub', :'rq', false);
select public.assert((public.requisition_template_current(:'orgA') ->> 'version')::int = 3, 'staff now get version 3');
select public.assert((public.requisition_template_current(:'orgA', :'rold') ->> 'version')::int = 1 and (public.requisition_template_current(:'orgA', :'rold') -> 'definition' -> 'fields') = '[]'::jsonb, 'the old requisition keeps the form it was made on');
select public.assert((public.requisition_view(:'rold') ->> 'template_version')::int = 1 and (public.requisition_view(:'rold') -> 'template' -> 'columns') = '[]'::jsonb, 'and its view says so');
select public.requisition_save_draft(:'rold', null, 'Old form edited', 'Training', '[{"description":"Pens","quantity":3}]'::jsonb);
select public.assert((select template_version from purchase_requisitions where id = :'rold') = 1, 'editing it does not move it to the new form');
select public.expect_error($$select public.requisition_save_draft(null, 'a0000000-0000-0000-0000-00000000000a', 'p', 'd', '[{"description":"Pens","quantity":1,"extra":{"unit":"box"}}]'::jsonb)$$, 'no field "unit"', 'the dropped column is not accepted');
select public.expect_error($$select public.requisition_save_draft(null, 'a0000000-0000-0000-0000-00000000000a', 'p', 'd', '[{"description":"Pens","quantity":1}]'::jsonb, '{"needed_by":"soon"}'::jsonb)$$, 'must be a date', 'values are checked against their type');
select public.requisition_save_draft(null, :'orgA', 'New form', 'Training', '[{"description":"Batteries","quantity":2,"extra":{"brand":"Acme"}},{"description":"Holders","quantity":1}]'::jsonb, '{"needed_by":"2027-03-01"}'::jsonb) as rnew \gset
select public.assert((select template_version from purchase_requisitions where id = :'rnew') = 3 and (select custom_fields ->> 'needed_by' from purchase_requisitions where id = :'rnew') = '2027-03-01', 'the new requisition is pinned to version 3 with its field values');
select public.assert((select extra ->> 'brand' from purchase_requisition_items where requisition_id = :'rnew' and line_no = 1) = 'Acme', 'item column values are kept');

-- ===== mandatory rules are enforced when submitting =====
select public.expect_error($$select public.requisition_submit((select id from purchase_requisitions where justification = 'New form'))$$, 'Project code', 'a required field must be completed');
select public.requisition_save_draft(:'rnew', null, 'New form', 'Training', '[{"description":"Batteries","quantity":2,"extra":{"brand":"Acme"}},{"description":"Holders","quantity":1}]'::jsonb, '{"needed_by":"2027-03-01","project":"P-9"}'::jsonb);
select public.expect_error($$select public.requisition_submit((select id from purchase_requisitions where justification = 'New form'))$$, 'Supplier quotation', 'a required document must be attached');
select public.expect_error($$select public.requisition_attach_request_document((select id from purchase_requisitions where justification = 'New form'), 'passport', 'a0000000-0000-0000-0000-00000000000a/requisitions/x/y.pdf', 'y.pdf')$$, 'does not ask', 'only documents the form asks for');
select public.expect_error($$select public.requisition_attach_request_document((select id from purchase_requisitions where justification = 'New form'), 'quotation', 'elsewhere/y.pdf', 'y.pdf')$$, 'Upload the document', 'and only from the requisition folder');
select public.requisition_attach_request_document(:'rnew', 'quotation', 'a0000000-0000-0000-0000-00000000000a/requisitions/' || :'rnew' || '/q.pdf', 'q.pdf');
select public.assert(jsonb_array_length(public.requisition_view(:'rnew') -> 'request_documents') = 1, 'the attached document shows on the requisition');
select set_config('request.jwt.claim.sub', :'hot', false);
select public.expect_error($$select public.requisition_attach_request_document((select id from purchase_requisitions where justification = 'New form'), 'quotation', 'a0000000-0000-0000-0000-00000000000a/requisitions/x/q.pdf', 'q.pdf')$$, 'not found', 'only the requester attaches');
select set_config('request.jwt.claim.sub', :'rq', false);
select public.assert((public.requisition_submit(:'rnew') ->> 'requisition_number') like 'REQ-%', 'a complete requisition is submitted');
select public.assert((select fields ->> 'project' from requisition_snapshots where requisition_id = :'rnew' and round = 1) = 'P-9' and (select items -> 0 -> 'extra' ->> 'brand' from requisition_snapshots where requisition_id = :'rnew' and round = 1) = 'Acme', 'the round keeps the field and column values as submitted');
select public.expect_error($$select public.requisition_remove_request_document((select id from requisition_documents where kind = 'request'))$$, 'draft or returned', 'documents are locked once submitted');
reset role;

-- a later template never changes the submitted requisition
set role authenticated; select set_config('request.jwt.claim.sub', :'po', false);
select public.requisition_template_save_draft(:'orgA', '{"fields":[{"key":"cost_centre","label":"Cost centre","type":"text","required":true}]}'::jsonb, 'v4') as t4 \gset
select public.requisition_template_submit(:'t4');
select set_config('request.jwt.claim.sub', :'hof', false);
select public.requisition_template_decide(:'t4', true, null);
select set_config('request.jwt.claim.sub', :'cm', false);
select public.assert((select status from requisition_templates where id = :'t3') = 'superseded', 'the previous version is superseded, never deleted');
select public.assert((public.requisition_view(:'rnew') ->> 'template_version')::int = 3 and jsonb_array_length(public.requisition_view(:'rnew') -> 'template' -> 'fields') = 2, 'the submitted requisition still shows version 3');
reset role;
select 'OK requisition templates';
