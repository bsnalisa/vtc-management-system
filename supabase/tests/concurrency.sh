#!/usr/bin/env bash
# Race-condition checks that need several database sessions at once: number allocation, one active registration per
# person, one open transfer per person and single execution of a transfer. Called by run.sh with the template database.
set -uo pipefail
tmpl="$1"; db="vtc_concurrency"
psql -q -d postgres -c "drop database if exists $db" -c "create database $db template $tmpl" >/dev/null 2>&1
q() { psql -q -tA -v ON_ERROR_STOP=1 -d "$db" "$@"; }
fail=0
check() { if [ "$2" = "$3" ]; then echo "OK $1"; else echo "ASSERT FAILED: $1 (expected $3, got $2)"; fail=1; fi; }
A=a0000000-0000-0000-0000-00000000000a; B=b0000000-0000-0000-0000-00000000000b; T=c0000000-0000-0000-0000-000000000001
ins() { # org first last dob national
  echo "insert into trainees (organization_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,trainee_id,status) values ('$1','$2','$3','male','$4','$5','0','x','$T','fulltime',1,'2026','x','active');"
}
echo "== concurrency"
# 1. many simultaneous new trainees: every number is distinct and nine digits
for i in $(seq 1 24); do q -c "$(ins $A "P$i" "Race$i" 1990-01-$(printf %02d $((i%28+1))) "RACE-ID-$(printf %04d $i)")" >/dev/null 2>&1 & done; wait
check "24 simultaneous registrations all succeed" "$(q -c "select count(*) from trainees where national_id like 'RACE-ID-%'")" 24
check "their numbers are all distinct nine-digit numbers" "$(q -c "select count(distinct trainee_id) from trainees where national_id like 'RACE-ID-%' and trainee_id ~ '^[0-9]{9}\$'")" 24
# 2. the same person at two VTCs at the same moment: exactly one registration survives
for round in 1 2 3 4 5; do
  id="SAME-PERSON-$round"
  q -c "$(ins $A Same Person$round 1991-02-0$round $id)" >/dev/null 2>&1 &
  q -c "$(ins $B Same Person$round 1991-02-0$round $id)" >/dev/null 2>&1 &
  wait
done
check "a person is never active at two VTCs (5 races)" "$(q -c "select count(*) from (select national_id from trainees where national_id like 'SAME-PERSON-%' and status in ('active','deferred') group by 1 having count(*) > 1) x")" 0
check "each racing person ended with one registration" "$(q -c "select count(*) from (select national_id from trainees where national_id like 'SAME-PERSON-%' group by 1 having count(*) = 1) x")" 5
check "and one identity each" "$(q -c "select count(distinct identity_id) from trainees where national_id like 'SAME-PERSON-%'")" 5
# 3. the same identifier created twice at once yields one identity
for s in 1 2 3 4 5 6; do q -c "select public.identity_resolve('Dup','Create','1992-03-03','DUP-CREATE-77','$A',null)" >/dev/null 2>&1 & done; wait
check "simultaneous resolution of one person creates one identity" "$(q -c "select count(*) from trainee_identities where national_id_normalised = 'DUPCREATE77'")" 1
# 4. simultaneous transfer requests and executions
q <<SQL >/dev/null
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into auth.users (id,email) values ('95555555-0000-0000-0000-000000000001','c1@x.test'),('95555555-0000-0000-0000-000000000002','c2@x.test'),('95555555-0000-0000-0000-000000000003','c3@x.test') on conflict do nothing;
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '95555555%' on conflict do nothing;
insert into user_roles (user_id, role, organization_id) values ('95555555-0000-0000-0000-000000000001','trainee','$A'),('95555555-0000-0000-0000-000000000002','head_of_training','$A'),('95555555-0000-0000-0000-000000000003','head_of_trainee_support','$A');
alter table user_roles enable trigger trg_guard_privileged_roles;
update trainees set user_id = '95555555-0000-0000-0000-000000000001' where national_id = 'RACE-ID-0001';
SQL
req() { q -c "set role authenticated; select set_config('request.jwt.claim.sub','95555555-0000-0000-0000-000000000001',false); select public.submit_transfer_request('$B','Simultaneous request number $1 to Beta')" >/dev/null 2>&1; }
for i in 1 2 3 4 5; do req $i & done; wait
check "only one of five simultaneous requests is accepted" "$(q -c "select count(*) from trainee_transfers")" 1
tid=$(q -c "select id from trainee_transfers")
q -c "set role authenticated; select set_config('request.jwt.claim.sub','95555555-0000-0000-0000-000000000002',false); select public.decide_transfer('$tid','approved','ok')" >/dev/null
# the second approval runs the transfer; fire it and a direct execution at the same moment
q -c "set role authenticated; select set_config('request.jwt.claim.sub','95555555-0000-0000-0000-000000000003',false); select public.decide_transfer('$tid','approved','ok')" >/dev/null 2>&1 &
sleep 0.05; q -c "select public.execute_transfer('$tid')" >/dev/null 2>&1 &
wait
check "the transfer completed exactly once" "$(q -c "select count(*) from trainee_transfers where status = 'COMPLETED' and attempts = 1")" 1
check "one active registration, at the destination" "$(q -c "select count(*) from trainees where national_id = 'RACE-ID-0001' and status = 'active' and organization_id = '$B'")" 1
check "no duplicate destination registration" "$(q -c "select count(*) from trainees where national_id = 'RACE-ID-0001'")" 2
psql -q -d postgres -c "drop database if exists $db" >/dev/null 2>&1
exit $fail
