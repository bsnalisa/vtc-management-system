-- Who may run the scheduled maintenance functions without being a signed-in staff member?
--  * the Supabase service role (API calls with the service key), or
--  * a database-side scheduler (pg_cron) or the SQL editor, which run as the postgres/supabase_admin login with no JWT.
-- Callers coming through the API connect as "authenticator", so session_user distinguishes them; an anonymous or signed-in
-- API user can never satisfy this check.
CREATE OR REPLACE FUNCTION public.is_job_runner()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(auth.role() = 'service_role', false)
      OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin'));
$$;
