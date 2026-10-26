\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set T1 'd0000000-0000-0000-0000-000000000001'
\set traineeUser '11111111-0000-0000-0000-000000000003'
\set adminA '97777777-0000-0000-0000-000000000001'
\set adminB '97777777-0000-0000-0000-000000000002'
\set reg '97777777-0000-0000-0000-000000000003'
\set clerkB '97777777-0000-0000-0000-000000000004'
\set trainerA '97777777-0000-0000-0000-000000000005'
\set other '97777777-0000-0000-0000-000000000006'

insert into auth.users (id,email) values (:'adminA','adm6a@a.test'),(:'adminB','adm6b@b.test'),(:'reg','reg6@a.test'),(:'clerkB','clk6@b.test'),(:'trainerA','trn6@a.test'),(:'other','oth6@a.test') on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '97777777%' on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'adminA','organization_admin',:'orgA'),(:'adminB','organization_admin',:'orgB'),(:'reg','registration_officer',:'orgA'),(:'clerkB','registration_officer',:'orgB'),(:'trainerA','trainer',:'orgA'),(:'other','librarian',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;

-- a registered trainee with unit standards and a fee ledger (as the database owner)
insert into registrations (trainee_id, organization_id, academic_year, registration_status, qualification_id, registered_at) values (:'T1', :'orgA', '2026', 'registered', 'e0000000-0000-0000-0000-000000000001', now()) returning id as regid \gset
insert into qualification_unit_standards (qualification_id, unit_standard_id, unit_standard_title, level, credit_value) values
  ('e0000000-0000-0000-0000-000000000001', 'US-6001', 'Welding safety', 2, 6), ('e0000000-0000-0000-0000-000000000001', 'US-6002', 'Cutting and joining', 2, 10);
insert into trainee_financial_accounts (organization_id, trainee_id, account_number) values (:'orgA', :'T1', 'FA-6-0001') returning id as acct \gset
insert into financial_transactions (organization_id, account_id, transaction_type, amount, balance_after, description, payment_method, reference_number, academic_year, processed_at)
values (:'orgA', :'acct', 'charge', 7250, 7250, 'Tuition and registration fees', null, 'INV-001', '2026', '2026-01-10'),
       (:'orgA', :'acct', 'payment', 3000, 4250, null, 'eft', 'RCP-001', '2026', '2026-01-20'),
       (:'orgA', :'acct', 'payment', 500, 3750, null, 'bursary', 'RCP-002', '2026', '2026-02-01'),
       (:'orgA', :'acct', 'charge', 999, 4749, 'Old year fee', null, 'INV-OLD', '2025', '2025-02-01');

-- settings: only the centre's Organization Admin
set role authenticated; select set_config('request.jwt.claim.sub', :'reg', false);
select public.expect_error($$select public.save_proof_settings('a0000000-0000-0000-0000-00000000000a', '{"centre_name":"X"}')$$, 'Only the Organization Admin', 'registration officers cannot edit the letterhead');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.expect_error($$select public.save_proof_settings('a0000000-0000-0000-0000-00000000000a', '{"centre_name":"X"}')$$, 'Only the Organization Admin', 'another centre''s admin cannot edit it');
select set_config('request.jwt.claim.sub', :'adminA', false);
select public.expect_error($$select public.save_proof_settings('a0000000-0000-0000-0000-00000000000a', '{"centre_name":"","physical_address":"a","telephone":"065250067","signatory_name":"S","email":"a@b.co"}')$$, 'centre name', 'centre name required');
select public.expect_error($$select public.save_proof_settings('a0000000-0000-0000-0000-00000000000a', '{"centre_name":"C","physical_address":"a","telephone":"065250067","signatory_name":"S","email":"not-an-email"}')$$, 'valid email', 'email validated');
select public.expect_error($$select public.save_proof_settings('a0000000-0000-0000-0000-00000000000a', '{"centre_name":"C","physical_address":"a","telephone":"abc","signatory_name":"S","email":"a@b.co"}')$$, 'valid phone', 'phone validated');
select public.expect_error($$select public.save_proof_settings('a0000000-0000-0000-0000-00000000000a', '{"centre_name":"C","physical_address":"a","telephone":"065250067","signatory_name":"S","email":"a@b.co","logo_url":"https://evil.example/x.png"}')$$, 'Upload the image', 'logo must come from the centre''s folder');
select public.expect_error($$select public.save_proof_settings('a0000000-0000-0000-0000-00000000000a', '{"centre_name":"C","physical_address":"a","telephone":"065250067","signatory_name":"S","email":"a@b.co","primary_color":"red"}')$$, 'Colours', 'colours validated');
select public.save_proof_settings(:'orgA', jsonb_build_object('centre_name','Alpha Vocational Training Centre','physical_address','1 Main Road, Alpha','postal_address','P.O. Box 1','telephone','065 250 067','email','info@alpha.test','signatory_name','Soniah Shitaleni','signatory_title','Ms.','clerk_name','Victoria Akathingo','clerk_title','Ms.','clerk_phone','065 250 067','clerk_email','v@alpha.test','logo_url','https://x.supabase.co/storage/v1/object/public/organization-logos/' || :'orgA' || '/proof-logo.png'));
select public.assert((select (public.proof_settings_overview()->0->>'configured')::boolean), 'centre is configured once the required fields and logo are set');
select public.save_proof_settings(:'orgA', jsonb_build_object('centre_name','Alpha Vocational Training Centre','physical_address','1 Main Road, Alpha','telephone','065 250 067','email','info@alpha.test','signatory_name','Soniah Shitaleni','logo_url',''));
select public.assert(not (public.proof_settings_overview()->0->>'configured')::boolean, 'removing the logo makes the centre incomplete');
select public.save_proof_settings(:'orgA', jsonb_build_object('centre_name','Alpha Vocational Training Centre','physical_address','1 Main Road, Alpha','telephone','065 250 067','email','info@alpha.test','signatory_name','Soniah Shitaleni','logo_url','https://x.supabase.co/storage/v1/object/public/organization-logos/' || :'orgA' || '/proof-logo.png'));
select public.assert((public.proof_settings_get(:'orgA')->'settings'->>'signatory_name') = 'Soniah Shitaleni', 'the admin form loads the centre settings');
select set_config('request.jwt.claim.sub', :'adminB', false);
select public.expect_error(format('select public.proof_settings_get(%L)', :'orgA'), 'Only the Organization Admin', 'settings of another centre are not readable through the form');
select public.save_proof_settings(:'orgB', jsonb_build_object('centre_name','Beta Vocational Training Centre','physical_address','9 Other Street','telephone','061 111 222','email','info@beta.test','signatory_name','Pat Beta','signatory_job_title','Head of Trainee Support','logo_url','https://x.supabase.co/storage/v1/object/public/organization-logos/' || :'orgB' || '/logo.png'));

-- the document
select set_config('request.jwt.claim.sub', :'reg', false);
select public.proof_of_registration_data(:'regid') as doc \gset
select public.assert((:'doc'::jsonb->'settings'->>'centre_name') = 'Alpha Vocational Training Centre' and (:'doc'::jsonb->>'settings_complete')::boolean, 'letterhead comes from the registration''s centre');
select public.assert(:'doc'::jsonb->'trainee'->>'name' = 'Tina One' and (:'doc'::jsonb->>'reference_number') ~ '^POR-', 'trainee details and a reference number');
select public.assert(jsonb_array_length(:'doc'::jsonb->'units') = 2 and :'doc'::jsonb->'units'->0->>'unit_id' = 'US-6001' and (:'doc'::jsonb->'units'->0->>'credits')::int = 6, 'unit standards with their IDs and credits, in qualification order');
select public.assert((:'doc'::jsonb->'fees'->>'total_debit')::numeric = 7250 and (:'doc'::jsonb->'fees'->>'total_credit')::numeric = 3500 and (:'doc'::jsonb->'fees'->>'balance')::numeric = 3750, 'fees charged, paid and balance exclude other years');
select public.assert(jsonb_array_length(:'doc'::jsonb->'fees'->'lines') = 3 and (:'doc'::jsonb->'fees'->'lines'->1->>'description') = 'Payment received – Eft', 'fee lines carry the payment method');
select public.assert((:'doc'::jsonb->>'year_of_study')::int = 1, 'first registration for the qualification is the first year of study');
select public.assert((public.proof_of_registration_data(:'regid')->>'reference_number') = (:'doc'::jsonb->>'reference_number'), 'the reference number is stable');
select public.log_proof_print(:'regid', 'print');

-- access
select set_config('request.jwt.claim.sub', :'clerkB', false);
select public.expect_error(format('select public.proof_of_registration_data(%L)', :'regid'), 'Registration not found', 'staff of another centre cannot generate it');
select set_config('request.jwt.claim.sub', :'trainerA', false);
select public.expect_error(format('select public.proof_of_registration_data(%L)', :'regid'), 'Registration not found', 'a trainer cannot generate it');
select set_config('request.jwt.claim.sub', :'other', false);
select public.expect_error(format('select public.log_proof_print(%L, ''print'')', :'regid'), 'Registration not found', 'a librarian cannot generate or log it');
select set_config('request.jwt.claim.sub', :'traineeUser', false);
select public.assert((public.proof_of_registration_data(:'regid')->>'academic_year') = '2026', 'the trainee can print their own');
reset role;
update registrations set registration_status = 'fee_pending' where id = :'regid';
set role authenticated; select set_config('request.jwt.claim.sub', :'traineeUser', false);
select public.expect_error(format('select public.proof_of_registration_data(%L)', :'regid'), 'not complete yet', 'the trainee only gets it once registered');
select set_config('request.jwt.claim.sub', :'reg', false);
select public.assert((public.proof_of_registration_data(:'regid')->>'registration_status') = 'fee_pending', 'staff see the status on the document');
select set_config('request.jwt.claim.sub', :'adminA', false);
select public.assert((select count(*) from proof_of_registration_prints) = 1, 'prints are logged and the admin can read the log');
reset role;
select public.expect_error($$delete from proof_of_registration_prints$$, 'cannot be changed', 'the print log is append-only');
select public.assert((select count(*) from admin_audit_log where entity = 'proof_of_registration_settings') >= 1, 'settings changes are audited');
select 'OK proof of registration';
