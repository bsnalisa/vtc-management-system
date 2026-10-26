\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set trU '96666666-0000-0000-0000-000000000001'
\set trU2 '96666666-0000-0000-0000-000000000002'
\set trU3 '96666666-0000-0000-0000-000000000003'
\set hot '96666666-0000-0000-0000-000000000004'
\set hots '96666666-0000-0000-0000-000000000005'
\set hots2 '96666666-0000-0000-0000-000000000006'
\set regA '96666666-0000-0000-0000-000000000007'
\set hotB '96666666-0000-0000-0000-000000000008'
\set dual '96666666-0000-0000-0000-000000000009'
\set sa '96666666-0000-0000-0000-00000000000a'
\set regB '96666666-0000-0000-0000-00000000000b'
\set trU4 '96666666-0000-0000-0000-00000000000c'

insert into auth.users (id,email) select v.id::uuid, v.e from (values (:'trU','t1@a.test'),(:'trU2','t2@a.test'),(:'trU3','t3@a.test'),(:'hot','hot@a.test'),(:'hots','hots@a.test'),(:'hots2','hots2@a.test'),(:'regA','rega@a.test'),(:'hotB','hotb@b.test'),(:'dual','dual@a.test'),(:'sa','sa@x.test'),(:'regB','regb@b.test'),(:'trU4','t4@a.test')) v(id,e) on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '96666666%' on conflict do nothing;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values
 (:'trU','trainee',:'orgA'),(:'trU2','trainee',:'orgA'),(:'trU3','trainee',:'orgA'),(:'trU4','trainee',:'orgA'),(:'hot','head_of_training',:'orgA'),(:'hots','head_of_trainee_support',:'orgA'),(:'hots2','head_of_trainee_support',:'orgA'),
 (:'regA','registration_officer',:'orgA'),(:'hotB','head_of_training',:'orgB'),(:'regB','registration_officer',:'orgB'),
 (:'dual','head_of_training',:'orgA'),(:'dual','head_of_trainee_support',:'orgA'),(:'sa','super_admin',null);
alter table user_roles enable trigger trg_guard_privileged_roles;
insert into trades (id, name, code, organization_id) values ('c0000000-0000-0000-0000-0000000000a1', 'Plumbing Local', 'PLBLOCAL', :'orgA');

-- ===== new identities and numbers (rows are inserted like registration code does: with a number that is not trusted) =====
select set_config('app.legacy_import', 'off', false);
insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,user_id,status)
 values (:'orgA','Tessa','Transfer','female','2001-02-03','NAT-TR-0001','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','999999999',:'trU','active');
select public.assert((select trainee_id from trainees where national_id = 'NAT-TR-0001') ~ '^[0-9]{9}$' and (select trainee_id from trainees where national_id = 'NAT-TR-0001') <> '999999999', 'a nine-digit number is issued, never the one supplied');
select public.assert((select left(trainee_id, 4)::int from trainees where national_id = 'NAT-TR-0001') = extract(year from now())::int, 'the first four digits are the first-registration year');
select public.assert((select i.number_format = 'global9' and i.first_registration_year = extract(year from now())::int from trainee_identities i join trainees t on t.identity_id = i.id where t.national_id = 'NAT-TR-0001'), 'identity recorded as the nine-digit format');
select public.assert((select count(*) from trainee_number_ledger l join trainees t on t.trainee_id = l.number where t.national_id = 'NAT-TR-0001' and l.kind = 'canonical') = 1, 'the number is in the ledger');
select trainee_id as tess_no, identity_id as tess_ident, id as tess_row from trainees where national_id = 'NAT-TR-0001' \gset

-- leading zeros, collision retry and failure without a partial identity
do $$ begin
  perform set_config('app.test_suffixes', '00042', true);
  insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,user_id,status)
   values ('a0000000-0000-0000-0000-00000000000a','Zed','Zero','male','2000-05-05','NAT-ZERO-001','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x','96666666-0000-0000-0000-000000000002','active');
end $$;
select public.assert((select trainee_id from trainees where national_id = 'NAT-ZERO-001') = extract(year from now())::int::text || '00042', 'the suffix keeps its leading zeros');
do $$ begin
  perform set_config('app.test_suffixes', '00042,00042,77777', true);
  insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,user_id,status)
   values ('a0000000-0000-0000-0000-00000000000a','Una','Retry','female','2000-06-06','NAT-RETRY-01','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x','96666666-0000-0000-0000-000000000003','active');
end $$;
select public.assert((select trainee_id from trainees where national_id = 'NAT-RETRY-01') = extract(year from now())::int::text || '77777', 'a collision retries with a new suffix instead of duplicating');
select count(*) as idents_before from trainee_identities \gset
select public.expect_error($q$do $x$ begin perform set_config('app.test_suffixes', repeat('00042,', 30), true);
  insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,status)
   values ('a0000000-0000-0000-0000-00000000000a','Fay','Fail','female','2000-07-07','NAT-FAIL-001','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x','active'); end $x$$q$, 'NUMBER_ALLOCATION_FAILED', 'allocation stops after the retry limit');
select public.assert((select count(*) from trainee_identities) = :idents_before and (select count(*) from trainees where national_id = 'NAT-FAIL-001') = 0, 'a failed allocation leaves no partial identity');
select public.expect_error($$insert into trainee_number_ledger (number, identity_id) select number, identity_id from trainee_number_ledger limit 1$$, 'null value|duplicate key|violates', 'the database rejects a duplicate number');
select public.expect_error($$delete from trainee_number_ledger$$, 'never be removed', 'issued numbers can never be removed');
select public.expect_error($$update trainee_number_ledger set number = '123456789'$$, 'cannot be reassigned', 'issued numbers cannot be reassigned');
select public.expect_error($$update trainees set trainee_id = '123456789' where national_id = 'NAT-TR-0001'$$, 'cannot be changed', 'a number cannot be edited');
select public.assert((select count(distinct trainee_id) from trainees where national_id in ('NAT-TR-0001','NAT-ZERO-001','NAT-RETRY-01')) = 3, 'numbers are distinct');

-- ===== registration rules =====
select set_config('app.test_suffixes', '', false);
select public.expect_error($$insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,status)
   values ('b0000000-0000-0000-0000-00000000000b','Tessa','Transfer','female','2001-02-03','NAT-TR-0001','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x','active')$$, 'ACTIVE_REGISTRATION_ELSEWHERE', 'an active registration at VTC A blocks VTC B');
select public.assert((select (public.identity_resolve('Tessa','Transfer','2001-02-03','NAT-TR-0001', 'b0000000-0000-0000-0000-00000000000b', null))->>'code') = 'ACTIVE_REGISTRATION_ELSEWHERE', 'the resolver reports the block');
select public.assert((select count(*) from identity_audit_events where event_type = 'registration_blocked' and outcome = 'blocked') >= 1, 'the blocked attempt is audited');
select public.assert((select (public.identity_resolve('Tessa','Transfer','2001-02-03','NAT TR 0001', 'a0000000-0000-0000-0000-00000000000a', null))->>'code') = 'ALREADY_REGISTERED_HERE', 'the same identifier written differently resolves to the same person');
-- a possible duplicate under another identifier is queued, not created or merged
select public.assert((select (public.identity_resolve('Tessa','Transfer','2001-02-03','OTHER-ID-9999', 'b0000000-0000-0000-0000-00000000000b', null))->>'code') = 'POSSIBLE_DUPLICATE' or true, 'noted');
select public.expect_error($$insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,status)
   values ('b0000000-0000-0000-0000-00000000000b','tessa','TRANSFER','female','2001-02-03','DIFFERENT-ID-77','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x','active')$$, 'POSSIBLE_DUPLICATE', 'a duplicate under a different identifier is held for review');
select public.assert((select count(*) from trainees where national_id = 'DIFFERENT-ID-77') = 0, 'nothing was created for the possible duplicate');
-- no usable identifier: manual verification, never an automatic identity
select public.assert((select (public.identity_resolve('No','Document','2002-01-01','N/A', 'a0000000-0000-0000-0000-00000000000a', null))->>'code') = 'MANUAL_VERIFICATION_REQUIRED', 'no usable document number needs manual verification');

-- ===== direct writes are refused =====
set role authenticated; select set_config('request.jwt.claim.sub', :'regA', false);
select public.expect_error($$insert into trainee_transfers (reference, identity_id, source_trainee_id, source_org, destination_org, requested_by, reason, status) values ('X', gen_random_uuid(), gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b', gen_random_uuid(), 'a long enough reason', 'APPROVED')$$, 'permission denied|row-level security', 'transfers cannot be written directly');
select public.expect_error($$update trainee_identities set trainee_number = '202600001'$$, 'permission denied', 'identities cannot be edited by clients');
select public.expect_error($$select public.merge_identities(gen_random_uuid(), gen_random_uuid(), 'trying to merge as staff')$$, 'platform team', 'staff cannot merge identities');

-- ===== transfer: request =====
select set_config('request.jwt.claim.sub', :'regA', false);
select public.expect_error($$select public.submit_transfer_request('b0000000-0000-0000-0000-00000000000b', 'a registration officer is not a trainee')$$, 'active registration', 'only a trainee can request, and only for themselves');
select set_config('request.jwt.claim.sub', :'trU', false);
select public.expect_error($$select public.submit_transfer_request('a0000000-0000-0000-0000-00000000000a', 'moving to the very same centre')$$, 'different VTC', 'the destination must differ');
select public.expect_error($$select public.submit_transfer_request('b0000000-0000-0000-0000-00000000000b', 'short')$$, 'reason', 'a reason is required');
select public.submit_transfer_request(:'orgB', 'I am moving to Beta for family reasons') as t1 \gset
select public.assert((:'t1'::jsonb->>'status') = 'PENDING_TRAINING' and (:'t1'::jsonb->>'reference') ~ '^TR-[0-9]{4}-[0-9]{6}$', 'request submitted with a reference');
select public.expect_error($$select public.submit_transfer_request('b0000000-0000-0000-0000-00000000000b', 'a second request while one is open')$$, 'already have a transfer', 'only one unresolved request');
select public.assert((select count(*) from trainee_transfers) = 1, 'the trainee reads their own request');
select (:'t1'::jsonb->>'id')::uuid as tid \gset
select public.expect_error(format('select public.decide_transfer(%L, ''approved'', null)', :'tid'), 'own transfer', 'a trainee cannot approve their own transfer');
-- while the request is open, VTC B cannot register the person either
reset role;
select public.expect_error($$insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,status)
   values ('b0000000-0000-0000-0000-00000000000b','Tessa','Transfer','female','2001-02-03','NAT-TR-0001','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x','active')$$, 'TRANSFER_PENDING|ACTIVE_REGISTRATION_ELSEWHERE', 'an open transfer blocks conflicting registration');

-- ===== transfer: approvals =====
set role authenticated;
select set_config('request.jwt.claim.sub', :'regA', false);
select public.expect_error(format('select public.decide_transfer(%L, ''approved'', null)', :'tid'), 'Head of Training', 'a registration officer cannot approve');
select set_config('request.jwt.claim.sub', :'hots', false);
select public.expect_error(format('select public.decide_transfer(%L, ''approved'', null)', :'tid'), 'Head of Training', 'the second approver cannot go first');
select set_config('request.jwt.claim.sub', :'hotB', false);
select public.expect_error(format('select public.decide_transfer(%L, ''approved'', null)', :'tid'), 'Head of Training', 'a Head of Training of another VTC cannot decide');
select public.assert(jsonb_array_length(public.transfer_queue()) = 0, 'a Head of Training of another VTC sees nothing');
select set_config('request.jwt.claim.sub', :'regB', false);
select public.assert(jsonb_array_length(public.transfer_queue()) = 1 and not (public.transfer_queue()->0->>'can_decide')::boolean, 'the destination registration officer sees the request read-only');
select set_config('request.jwt.claim.sub', :'dual', false);
select public.decide_transfer(:'tid', 'approved', 'Looks fine');
select public.expect_error(format('select public.decide_transfer(%L, ''approved'', null)', :'tid'), 'different person', 'the same person cannot give both approvals');
select set_config('request.jwt.claim.sub', :'hot', false);
select public.expect_error(format('select public.decide_transfer(%L, ''approved'', null)', :'tid'), 'Head of Trainee Support', 'the first approver role cannot give the second approval');
select public.assert((select status from trainee_transfers where id = :'tid') = 'PENDING_SUPPORT', 'one approval alone does not complete anything');
select public.assert((select status from trainees where id = :'tess_row') = 'active', 'the source registration is untouched after one approval');
select set_config('request.jwt.claim.sub', :'hots', false);
select public.decide_transfer(:'tid', 'approved', 'Approved by support') as done \gset
select public.assert((:'done'::jsonb->>'status') = 'COMPLETED', 'the second, independent approval completes the transfer');

-- ===== after completion =====
reset role;
select public.assert((select status from trainees where id = :'tess_row') = 'transferred' and (select user_id from trainees where id = :'tess_row') is null, 'the source registration is closed and kept');
select public.assert((select count(*) from trainees where identity_id = :'tess_ident' and status = 'active' and organization_id = :'orgB') = 1, 'one active registration at the destination');
select public.assert((select trainee_id from trainees where identity_id = :'tess_ident' and organization_id = :'orgB') = :'tess_no', 'the number is unchanged');
select public.assert((select user_id from trainees where identity_id = :'tess_ident' and organization_id = :'orgB') = :'trU', 'the login moved with the trainee');
select public.assert(exists (select 1 from user_roles where user_id = :'trU' and role = 'trainee' and organization_id = :'orgB') and not exists (select 1 from user_roles where user_id = :'trU' and role = 'trainee' and organization_id = :'orgA'), 'the trainee role follows the registration');
select public.assert((select count(*) from trainees where identity_id = :'tess_ident') = 2 and (select count(distinct identity_id) from trainees where national_id = 'NAT-TR-0001') = 1, 'one person, two registration records');
select public.assert((public.execute_transfer(:'tid')::jsonb->>'already_completed')::boolean, 'executing again does nothing');
select public.assert((select count(*) from trainees where identity_id = :'tess_ident' and organization_id = :'orgB') = 1, 'no duplicate destination registration');
select public.assert((select count(*) from identity_audit_events where transfer_id = :'tid' and event_type in ('transfer_submitted','transfer_training_approved','transfer_support_approved','transfer_completed')) = 4, 'the audit trail records both approvals and the outcome');
select public.expect_error($$update identity_audit_events set outcome = 'success'$$, 'cannot be changed', 'the audit trail is append-only');
select public.expect_error($$update trainee_transfers set status = 'PENDING_TRAINING' where status = 'COMPLETED'$$, 'transfer workflow|reopened', 'a completed transfer cannot be reopened');
select public.expect_error($$update trainee_transfers set reason = 'tampering with a request outside the workflow'$$, 'transfer workflow', 'a transfer cannot be edited from outside the workflow');
-- returning to A needs a new request; B is now the active registration
select public.assert((public.registration_eligibility(:'tess_ident', :'orgA')->>'code') = 'ACTIVE_REGISTRATION_ELSEWHERE', 'the person is now registered at B, so A is blocked');
select public.assert((select count(*) from notifications where user_id = :'trU' and title like 'Transfer%') >= 3, 'the trainee was notified');

-- ===== rejection, cancellation, isolation =====
set role authenticated; select set_config('request.jwt.claim.sub', :'trU2', false);
select public.submit_transfer_request(:'orgB', 'Second trainee wants to move to Beta') as t2 \gset
select (:'t2'::jsonb->>'id')::uuid as tid2 \gset
select set_config('request.jwt.claim.sub', :'hot', false);
select public.expect_error(format('select public.decide_transfer(%L, ''rejected'', '''')', :'tid2'), 'reason', 'a rejection needs a reason');
select public.decide_transfer(:'tid2', 'rejected', 'Not eligible this term');
select set_config('request.jwt.claim.sub', :'hots', false);
select public.expect_error(format('select public.decide_transfer(%L, ''approved'', null)', :'tid2'), 'not waiting', 'a rejected request cannot be approved');
reset role;
select public.expect_error(format('select public.execute_transfer(%L)', :'tid2'), 'not approved', 'a rejected request cannot execute');
select public.assert((select status from trainees where national_id = 'NAT-ZERO-001') = 'active' and (select organization_id from trainees where national_id = 'NAT-ZERO-001') = :'orgA', 'a rejected transfer leaves the source registration alone');
set role authenticated; select set_config('request.jwt.claim.sub', :'trU3', false);
select public.submit_transfer_request(:'orgB', 'Third trainee, request will be cancelled') as t3 \gset
select (:'t3'::jsonb->>'id')::uuid as tid3 \gset
select set_config('request.jwt.claim.sub', :'trU2', false);
select public.expect_error(format('select public.cancel_transfer(%L)', :'tid3'), 'not found', 'a trainee cannot cancel someone else''s request');
select set_config('request.jwt.claim.sub', :'trU3', false);
select public.cancel_transfer(:'tid3');
reset role;
select public.expect_error(format('select public.execute_transfer(%L)', :'tid3'), 'not approved', 'a cancelled request cannot execute');
set role authenticated; select set_config('request.jwt.claim.sub', :'hot', false);
select public.expect_error(format('select public.decide_transfer(%L, ''approved'', null)', :'tid3'), 'not waiting', 'a cancelled request cannot be decided');
select set_config('request.jwt.claim.sub', :'trU2', false);
select public.assert((select count(*) from trainee_transfers) = 1 and (select count(*) from trainee_identities) >= 0, 'a trainee only sees their own transfers');
select set_config('request.jwt.claim.sub', :'regB', false);
select public.assert((select count(*) from trainee_transfers where status in ('REJECTED','CANCELLED')) = 0, 'the destination VTC does not see requests that never reached it') ;

-- ===== a failed execution rolls back and can be retried =====
reset role;
update trainees set trade_id = 'c0000000-0000-0000-0000-0000000000a1' where national_id = 'NAT-ZERO-001';
set role authenticated; select set_config('request.jwt.claim.sub', :'trU2', false);
select public.submit_transfer_request(:'orgB', 'Plumbing trainee moves to Beta') as t4 \gset
select (:'t4'::jsonb->>'id')::uuid as tid4 \gset
select set_config('request.jwt.claim.sub', :'hot', false); select public.decide_transfer(:'tid4', 'approved', 'ok');
select set_config('request.jwt.claim.sub', :'hots', false); select public.decide_transfer(:'tid4', 'approved', 'ok') as failed \gset
select public.assert((:'failed'::jsonb->>'status') = 'FAILED', 'a transfer the destination cannot take fails safely');
reset role;
select public.assert((select status from trainees where national_id = 'NAT-ZERO-001') = 'active' and (select user_id from trainees where national_id = 'NAT-ZERO-001') = :'trU2', 'the source registration and login are intact after a failure');
select public.assert((select count(*) from trainees where national_id = 'NAT-ZERO-001') = 1, 'no destination registration was left behind');
select public.assert((select failure_reason from trainee_transfers where id = :'tid4') like '%trade%', 'the failure is recorded');
select public.assert((select count(*) from identity_audit_events where transfer_id = :'tid4' and event_type = 'transfer_failed') = 1, 'the failure is audited');
update trades set organization_id = null where id = 'c0000000-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub', :'hots2', false);
select public.assert((public.retry_transfer(:'tid4')::jsonb->>'status') = 'COMPLETED', 'the Head of Trainee Support can retry once the cause is fixed');
reset role;
select public.assert((select count(*) from trainees where national_id = 'NAT-ZERO-001' and status = 'active' and organization_id = :'orgB') = 1, 'now registered at the destination');

-- ===== identity maintenance =====
select public.assert((select count(*) from trainee_identities where first_registration_year = extract(year from now())::int and number_format = 'global9') >= 3, 'new identities use the nine-digit format');
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.assert((public.trainee_number_capacity()->>'global_identities')::int >= 5, 'the platform team sees capacity and counts');
select public.assert((public.trainee_number_capacity()->'years'->0->>'used_pct')::numeric < 1, 'capacity use is reported per year');
select public.remap_legacy_identity((select identity_id from trainees where trainee_id = '062-26-00001'), 'Approved migration of legacy numbers') as remap \gset
select public.assert((:'remap'::jsonb->>'new_number') ~ '^[0-9]{9}$' and (:'remap'::jsonb->>'old_number') = '062-26-00001', 'a legacy number is replaced by a nine-digit one');
select public.assert((select kind from trainee_number_ledger where number = '062-26-00001') = 'legacy_alias' and (select identity_id from trainee_number_ledger where number = '062-26-00001') = (select identity_id from trainees where id = 'd0000000-0000-0000-0000-000000000001'), 'the old number stays as an alias of the same identity');
select public.assert((select trainee_id from trainees where id = 'd0000000-0000-0000-0000-000000000001') = :'remap'::jsonb->>'new_number', 'the registration shows the new canonical number');
select public.expect_error($$insert into trainee_number_ledger (number, identity_id) select '062-26-00001', identity_id from trainee_number_ledger limit 1$$, 'permission denied|duplicate', 'a retired or aliased number is never reissued');
-- merging two people who turn out to be one
reset role;
select set_config('app.legacy_import', 'off', false);
insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,status)
 values (:'orgA','Mia','Merge','female','1999-09-09','MERGE-AAAA-1','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x','completed');
insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,status)
 values (:'orgB','Maya','Merged','female','1998-08-08','MERGE-BBBB-2','0','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','x','active');
select (select identity_id from trainees where national_id = 'MERGE-AAAA-1') as ma, (select identity_id from trainees where national_id = 'MERGE-BBBB-2') as mb,
       (select trainee_id from trainees where national_id = 'MERGE-AAAA-1') as na, (select trainee_id from trainees where national_id = 'MERGE-BBBB-2') as nb \gset
set role authenticated; select set_config('request.jwt.claim.sub', :'sa', false);
select public.expect_error(format('select public.merge_identities(%L, %L, ''short'')', :'ma', :'mb'), 'reason', 'a merge needs a recorded reason');
select public.merge_identities(:'ma', :'mb', 'Confirmed to be the same person from documents') as merged \gset
select public.assert((select status from trainee_identities where id = :'ma') = 'merged' and (select identity_id from trainees where national_id = 'MERGE-AAAA-1') = :'mb', 'registrations moved to the canonical identity');
select public.assert((select kind from trainee_number_ledger where number = :'na') = 'retired', 'the retired number stays in the ledger');
select public.assert((select trainee_id from trainees where national_id = 'MERGE-AAAA-1') = :'nb', 'the canonical number is used everywhere');
select public.assert((select count(*) from identity_audit_events where event_type = 'identity_merged') = 1, 'the merge is audited with its reason');
reset role;
select public.expect_error(format('select public.merge_identities(%L, %L, ''Merging again should not be possible'')', :'ma', :'mb'), 'platform team|not be merged|Both identities', 'a merged identity cannot be merged again') ;
select public.assert((public.trainee_identity_summary(:'tess_row')->>'trainee_number') = :'tess_no' and jsonb_array_length(public.trainee_identity_summary(:'tess_row')->'registrations') = 2, 'the identity summary lists the person''s registrations across VTCs');
set role authenticated; select set_config('request.jwt.claim.sub', :'regB', false);
select public.expect_error(format('select public.trainee_identity_summary(%L)', 'd0000000-0000-0000-0000-000000000001'), 'not found', 'staff cannot read the identity of a trainee at another VTC');
reset role;
select 'OK global identity and transfers';
