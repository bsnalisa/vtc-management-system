-- READ-ONLY audit to run on production BEFORE applying migrations 20261028090000 and 20261028090100.
-- It changes nothing. Keep the output with the migration decision.
select 'trainee records' as item, count(*)::text as value from trainees
union all select 'already nine-digit numbers', count(*)::text from trainees where trainee_id ~ '^[0-9]{9}$'
union all select 'numbers in another format (kept as legacy)', count(*)::text from trainees where trainee_id !~ '^[0-9]{9}$'
union all select 'records by status: ' || status::text, count(*)::text from trainees group by status
union all select 'records per centre: ' || o.name, count(*)::text from trainees t join organizations o on o.id = t.organization_id group by o.name
union all select 'identifiers shared by more than one record', count(*)::text from (select national_id from trainees group by 1 having count(*) > 1) d
union all select 'identifiers too short or placeholder-like (would not be matched on)', count(*)::text from trainees where length(regexp_replace(national_id, '[^0-9A-Za-z]', '', 'g')) < 8
union all select 'same name and date of birth, different record (possible duplicates)', count(*)::text from (select 1 from trainees group by lower(first_name), lower(last_name), date_of_birth having count(*) > 1) d
union all select 'records without a login', count(*)::text from trainees where user_id is null
union all select 'records with no registration history (first year taken from record creation)', count(*)::text from trainees t where not exists (select 1 from registrations r where r.trainee_id = t.id)
union all select 'registration rows', count(*)::text from registrations
union all select 'applications holding a trainee number', count(*)::text from trainee_applications where trainee_number is not null;

-- unique constraints and indexes the migration replaces (names must match what the migration drops)
select conname as name, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid = 'public.trainees'::regclass and contype in ('u', 'p')
union all select indexname, indexdef from pg_indexes where tablename = 'trainees' and indexdef ilike '%unique%';
