# SQL behaviour tests

These tests exercise the database logic added for the trainee-affairs, resource-centre, graduation, assessment and
delivery/logbook modules: triggers, `SECURITY DEFINER` functions and row-level security, acting as different users.

They run against a throw-away local Postgres with a minimal stub of Supabase's `auth`/`storage` schemas
(`supabase_stub*.sql`); they do not touch a real project.

```
PGUSER=postgres PGHOST=localhost ./supabase/tests/run.sh
```

`00_seed.sql` creates two organisations and users in each role. Tests switch user with
`set role authenticated; select set_config('request.jwt.claim.sub', '<user id>', false);`.
