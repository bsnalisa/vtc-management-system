-- Closes the paths that row-level security cannot see: SECURITY DEFINER functions run with the owner's rights, so the
-- centre isolation policies do not apply inside them. This migration
--   1. adds helpers that answer "may the caller reach this centre / trainee?",
--   2. puts that check inside the functions that took a centre or trainee id and trusted it,
--   3. stops anonymous visitors calling internal functions (only the public-site and token functions stay open),
--   4. requires every non-platform role to belong to a centre.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text IN ('super_admin', 'vms_developer', 'vms_support'));
$$;

-- True for server-side callers (no signed-in user: cron, edge functions with the service key), platform staff, and
-- anyone who belongs to the given centre. A missing centre is only open to the first two.
CREATE OR REPLACE FUNCTION public.centre_access_ok(_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NULL
      OR public.is_platform_user()
      OR (_org IS NOT NULL AND _org = ANY (public.my_centre_ids()));
$$;

CREATE OR REPLACE FUNCTION public.assert_centre_access(_org uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.centre_access_ok(_org) THEN
    RAISE EXCEPTION 'Not authorised for this centre' USING ERRCODE = '42501';
  END IF;
END $$;

-- The trainee themselves, or someone at the trainee's centre
CREATE OR REPLACE FUNCTION public.trainee_access_ok(_trainee uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NULL
      OR public.is_platform_user()
      OR public.is_own_trainee(_trainee)
      OR public.centre_access_ok((SELECT t.organization_id FROM public.trainees t WHERE t.id = _trainee));
$$;

CREATE OR REPLACE FUNCTION public.assert_trainee_access(_trainee uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.trainee_access_ok(_trainee) THEN
    RAISE EXCEPTION 'Not authorised for this trainee' USING ERRCODE = '42501';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Put the check inside the functions that trusted their arguments
-- ---------------------------------------------------------------------------
-- Rewrites one function from its stored definition: the first occurrence of _find becomes _repl. Fails loudly if the
-- function or the text is not there, so a changed definition can never be skipped silently.
CREATE OR REPLACE FUNCTION public._patch_fn(_name text, _args text, _find text, _repl text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  def text;
  pos integer;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = _name
      AND pg_get_function_identity_arguments(p.oid) ~ _args
  LOOP
    def := pg_get_functiondef(r.oid);
    pos := strpos(def, _find);
    IF pos = 0 THEN
      RAISE EXCEPTION 'Cannot patch %(%): expected text not found', _name, _args;
    END IF;
    def := substr(def, 1, pos - 1) || _repl || substr(def, pos + length(_find));
    EXECUTE def;
    n := n + 1;
  END LOOP;
  IF n = 0 THEN
    RAISE NOTICE 'patch skipped: function %(%) does not exist here', _name, _args;
  END IF;
END $$;

-- Writers
SELECT public._patch_fn('calculate_qualification_result', '_org_id uuid', E'\nBEGIN',
  E'\nBEGIN\n  PERFORM public.assert_centre_access(_org_id);\n  PERFORM public.assert_trainee_access(_trainee_id);');

SELECT public._patch_fn('lock_assessment_cycle', '_org_id uuid', E'\nBEGIN',
  E'\nBEGIN\n  IF auth.uid() IS NOT NULL AND NOT (public.is_platform_user() OR public.has_org_role(auth.uid(), _org_id, ARRAY[''organization_admin'',''admin'',''head_of_training'',''assessment_coordinator''])) THEN\n    RAISE EXCEPTION ''Not authorised'' USING ERRCODE = ''42501'';\n  END IF;');

SELECT public._patch_fn('log_assessment_audit', '_org_id uuid', E'\nBEGIN', E'\nBEGIN\n  PERFORM public.assert_centre_access(_org_id);');
SELECT public._patch_fn('log_provisioning_attempt', '_org_id uuid', E'\nBEGIN', E'\nBEGIN\n  PERFORM public.assert_centre_access(_org_id);');
SELECT public._patch_fn('seed_symbol_points_for_organization', 'org_id uuid', E'\nBEGIN', E'\nBEGIN\n  PERFORM public.assert_centre_access(org_id);');

-- Clearing a payment: debtor officers of that centre; an Organization Admin only inside an override
SELECT public._patch_fn('clear_payment', '_clearance_id uuid', E'\nBEGIN',
  E'\nBEGIN\n  IF auth.uid() IS NOT NULL AND NOT (\n       public.is_platform_user()\n    OR public.has_org_role(auth.uid(), (SELECT c.organization_id FROM public.payment_clearances c WHERE c.id = _clearance_id), ARRAY[''debtor_officer''])\n    OR (public.has_org_role(auth.uid(), (SELECT c.organization_id FROM public.payment_clearances c WHERE c.id = _clearance_id), ARRAY[''organization_admin'',''admin''])\n        AND public.has_active_admin_override(auth.uid()))\n  ) THEN\n    RAISE EXCEPTION ''Not authorised'' USING ERRCODE = ''42501'';\n  END IF;');

-- Trainee readers
SELECT public._patch_fn('calculate_trainee_gpa', '_trainee_id uuid', E'\nBEGIN', E'\nBEGIN\n  PERFORM public.assert_trainee_access(_trainee_id);');
SELECT public._patch_fn('check_trainee_progression', '_trainee_id uuid', E'\nBEGIN', E'\nBEGIN\n    PERFORM public.assert_trainee_access(_trainee_id);');
SELECT public._patch_fn('calculate_ca_for_template_component', '_trainee_id uuid', E'\nBEGIN', E'\nBEGIN\n  PERFORM public.assert_trainee_access(_trainee_id);');
SELECT public._patch_fn('get_trainee_exam_eligibility', '_trainee_id uuid', 'WHERE ca.gradebook_id = _gradebook_id', 'WHERE ca.gradebook_id = _gradebook_id AND public.trainee_access_ok(_trainee_id)');
SELECT public._patch_fn('trainee_has_outstanding_fees', '_trainee_id uuid', 'WHERE trainee_id = _trainee_id', 'WHERE trainee_id = _trainee_id AND public.trainee_access_ok(_trainee_id)');
SELECT public._patch_fn('get_trainee_gradebook_ids', '_user_id uuid', 'WHERE t.user_id = _user_id', 'WHERE t.user_id = _user_id AND (_user_id = auth.uid() OR public.centre_access_ok(t.organization_id))');

-- Centre readers
SELECT public._patch_fn('get_applications_needing_provisioning', '_org_id uuid', 'WHERE organization_id = _org_id', 'WHERE organization_id = _org_id AND public.centre_access_ok(_org_id)');
SELECT public._patch_fn('get_pending_clearance_count', '_org_id uuid', 'WHERE organization_id = _org_id', 'WHERE organization_id = _org_id AND public.centre_access_ok(_org_id)');
SELECT public._patch_fn('get_asset_categories_count', '_org_id uuid', 'AND (_org_id IS NULL OR organization_id = _org_id)', 'AND (_org_id IS NULL OR organization_id = _org_id) AND public.centre_access_ok(organization_id)');
SELECT public._patch_fn('get_organization_active_package', '_org_id uuid', 'WHERE op.organization_id = _org_id', 'WHERE op.organization_id = _org_id AND public.centre_access_ok(_org_id)');

-- Platform-wide jobs and listings: server code and platform staff, or the caller's own centre
SELECT public._patch_fn('expire_trial_packages', '^$', 'AND op.end_date < now()', 'AND op.end_date < now()' || E'\n    AND (auth.uid() IS NULL OR public.is_platform_user())');
SELECT public._patch_fn('check_subscription_expiry', '^$', 'AND op.end_date <= CURRENT_DATE', 'AND public.centre_access_ok(op.organization_id)' || E'\n    AND op.end_date <= CURRENT_DATE');

-- Search: a centre user is always searched inside their own centre, even when no centre (or someone else's) is asked for
SELECT public._patch_fn('global_search', 'org_id uuid', E'\nBEGIN',
  E'\nBEGIN\n  IF auth.uid() IS NOT NULL AND NOT public.is_platform_user() AND (org_id IS NULL OR NOT public.centre_access_ok(org_id)) THEN\n    org_id := (public.my_centre_ids())[1];\n  END IF;');

DROP FUNCTION public._patch_fn(text, text, text, text);

-- ---------------------------------------------------------------------------
-- 3. Anonymous visitors only keep the functions the public site and emailed links need
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  keep text[] := ARRAY[
    -- public site and emailed links
    'application_window_status', 'list_public_qualifications', 'submit_public_rpl_application', 'submit_sme_application',
    'submit_survey_response', 'get_survey_by_token', 'get_graduation_invitation', 'respond_graduation_invitation',
    'respond_graduation_invitation_by_phone', 'get_logbook_for_supervisor', 'supervisor_sign_entries',
    'workflow_act_by_token', 'workflow_get_task_by_token', 'calculate_application_points', 'generate_application_number',
    'check_organization_limit'
  ];
  n integer := 0;
  signed_in boolean;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef AND p.prokind = 'f' AND p.prorettype <> 'trigger'::regtype
      AND p.proname <> ALL (keep)
      -- yes/no helpers that row policies call for every role
      AND p.proname !~ '^(has_|is_|can_|workflow_can_|forum_topic_|centre_|trainee_access_ok|my_centre|user_visible)'
      AND p.proname NOT IN ('get_user_organization', 'quiz_class', 'assignment_class', 'organization_has_module')
      -- anything a row policy or a column default calls runs as the visitor, so it must stay callable
      AND NOT EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.schemaname = 'public' AND (coalesce(pp.qual, '') || coalesce(pp.with_check, '')) ~ ('\m' || p.proname || '\('))
      AND NOT EXISTS (SELECT 1 FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid WHERE c.relnamespace = 'public'::regnamespace AND pg_get_expr(d.adbin, d.adrelid) ~ ('\m' || p.proname || '\('))
      -- ... and so does anything an ordinary (invoker-rights) function or trigger calls
      AND NOT EXISTS (SELECT 1 FROM pg_proc q WHERE q.pronamespace = 'public'::regnamespace AND NOT q.prosecdef AND q.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql') AND q.prosrc ~ ('\m' || p.proname || '\('))
  LOOP
    signed_in := has_function_privilege('authenticated', r.oid, 'execute');
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    -- keep what signed-in users had; never hand out access that an earlier migration took away
    IF signed_in THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args); END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Anonymous access removed from % functions', n;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Every role except the platform team belongs to a centre
-- ---------------------------------------------------------------------------
-- (Centre isolation lets a role with no centre through, so such a row must not exist.)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_centre_required;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_centre_required
  CHECK (organization_id IS NOT NULL OR role::text IN ('super_admin', 'vms_developer', 'vms_support'));
