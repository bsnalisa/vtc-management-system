-- Role enumeration: has_role(<any user id>, ...), is_super_admin(<any user id>), has_org_role(...) and the other helpers that take a
-- user id answered for anyone, so an anonymous visitor (or any signed-in user) holding a user id could learn which roles that person has.
-- The row-level-security policies need these helpers, so they cannot simply be closed.
--
--  * Each helper that takes a user id as its first argument is moved, unchanged, to the `private` schema (not exposed through the API).
--    Moving keeps the function's identity, so every policy, column default and view that uses it keeps using it exactly as before.
--  * A guarded function with the same name and arguments is created in `public` for everything that calls it by name. When it is
--    reached directly by the API as `anon` or `authenticated` it answers only about the caller (any other user id gives false / null).
--    Calls from inside other database functions (including the email-token approvals) and from the service role are unchanged.
--  * The guarded functions are not executable by anonymous users.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

DO $$
DECLARE
  r record;
  _targets text[] := ARRAY['has_role', 'has_org_role', 'is_admin', 'is_super_admin', 'is_org_admin_only', 'get_user_organization',
    'is_assessment_staff', 'is_graduation_staff', 'is_library_staff', 'is_org_staff', 'is_organization_admin', 'is_trainee_affairs_staff',
    'is_training_staff', 'is_workflow_admin', 'is_deferral_staff', 'is_finance_staff', 'is_hostel_staff', 'is_hr_staff', 'is_liaison_staff',
    'is_project_staff', 'can_access_document_entity', 'can_edit_delivery_plan', 'can_manage_class_learning', 'can_manage_supervisor_link',
    'can_review_logbook', 'can_use_class_forum', 'is_enrolled_in_class', 'workflow_can_view_instance', 'can_approve_entry_requirements',
    'can_approve_qualifications', 'can_manage_qualifications', 'can_propose_entry_requirements', 'has_active_admin_override',
    'has_custom_permission', 'is_trainee_in_gradebook', 'workflow_can_act'];
  _sig text; _body text; _names text; _ret text; _first text; _denied text; _n integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, p.proargnames, p.pronargs
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY (_targets) AND p.prokind = 'f' AND NOT p.proretset
       AND p.proargtypes[0] = 'uuid'::regtype AND p.pronargs = cardinality(p.proargnames)
       AND p.prorettype IN ('boolean'::regtype, 'uuid'::regtype)
  LOOP
    _sig := pg_get_function_identity_arguments(r.oid);
    _ret := pg_get_function_result(r.oid);
    _first := quote_ident(r.proargnames[1]);
    _names := (SELECT string_agg(quote_ident(a), ', ' ORDER BY ord) FROM unnest(r.proargnames) WITH ORDINALITY AS t(a, ord));
    _denied := CASE WHEN _ret = 'boolean' THEN 'false' ELSE 'NULL::uuid' END;
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA private', r.proname, _sig);
    _body := format('SELECT CASE WHEN current_user IN (''anon'', ''authenticated'') AND %s IS DISTINCT FROM auth.uid() THEN %s ELSE private.%I(%s) END',
      _first, _denied, r.proname, _names);
    EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS %L',
      r.proname, _sig, _ret, _body);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, _sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, _sig);
    _n := _n + 1;
  END LOOP;
  RAISE NOTICE 'role-enumeration guard added to % functions', _n;
END $$;
