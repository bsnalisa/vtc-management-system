-- Anonymous visitors may call only the public-site and token functions (AGENTS.md). Until now almost every SECURITY DEFINER
-- function carried the default PUBLIC execute grant, so anonymous callers could run (and be refused inside) about 200 of them.
--
--  1. Revoke anonymous/PUBLIC execute on every SECURITY DEFINER function except
--       * the public-site and token functions listed below, and
--       * the helpers that row-level-security policies, column defaults or views readable by anonymous users depend on
--         (revoking those would make anonymous queries on the tables concerned fail with "permission denied for function").
--     Signed-in users and the service role keep execute exactly as before.
--  2. New functions are no longer executable by anonymous users or PUBLIC by default; each must be granted on purpose.
--     (supabase/tests/31_anon_lockdown.sql fails if a function becomes anonymously callable without being allowed here.)
--  3. The two identity tables added with global trainee identity get the RESTRICTIVE "Centre isolation" policy every table
--     with an organization_id carries.

-- ---------------------------------------------------------------------------
-- 1. Lock down existing functions
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  _public_site text[] := ARRAY[
    'trades_open_for_application', 'list_public_qualifications', 'submit_public_rpl_application', 'submit_sme_application',
    'application_window_status', 'get_survey_by_token', 'submit_survey_response', 'workflow_act_by_token', 'workflow_get_task_by_token',
    'get_graduation_invitation', 'respond_graduation_invitation', 'get_logbook_for_supervisor', 'supervisor_sign_entries'];
  _locked integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
       AND p.proname <> ALL (_public_site)
       -- used by a policy that applies to anonymous users
       AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_policy pol ON d.classid = 'pg_policy'::regclass AND d.objid = pol.oid
                        WHERE d.refclassid = 'pg_proc'::regclass AND d.refobjid = p.oid
                          AND (pol.polroles = '{0}' OR (SELECT oid FROM pg_roles WHERE rolname = 'anon') = ANY (pol.polroles)))
       -- used in a column default (evaluated with the inserting role's privileges)
       AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_attrdef ad ON d.classid = 'pg_attrdef'::regclass AND d.objid = ad.oid
                        WHERE d.refclassid = 'pg_proc'::regclass AND d.refobjid = p.oid)
       -- used by a view
       AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_rewrite rw ON d.classid = 'pg_rewrite'::regclass AND d.objid = rw.oid
                        JOIN pg_class v ON v.oid = rw.ev_class AND v.relkind IN ('v', 'm')
                        WHERE d.refclassid = 'pg_proc'::regclass AND d.refobjid = p.oid)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    _locked := _locked + 1;
  END LOOP;
  RAISE NOTICE 'anonymous access removed from % functions', _locked;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Future functions are closed to anonymous users until granted on purpose
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Centre isolation on the identity review and audit tables
-- ---------------------------------------------------------------------------
-- staff with a centre role see only rows of their own centres; platform staff and super admins are not centre-scoped
CREATE POLICY "Centre isolation" ON public.identity_review_cases AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
CREATE POLICY "Centre isolation" ON public.identity_audit_events AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
