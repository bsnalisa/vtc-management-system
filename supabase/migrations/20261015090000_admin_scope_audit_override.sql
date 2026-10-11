-- Organization Admin: confined to their own centre, read-only on finance and grades unless an override is
-- active, every admin change audited, and only super admins can grant admin-level roles.
--
-- Legacy policies call is_admin(auth.uid()), which treats an Organization Admin like a platform admin with no
-- centre check. Rather than rewrite dozens of policies, these RESTRICTIVE policies are ANDed with them and
-- only ever narrow what an Organization Admin can do. Everyone else is unaffected.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
-- A centre-level admin (Organization Admin, or the retired Admin role) who is not also a platform super admin
CREATE OR REPLACE FUNCTION public.is_org_admin_only(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role::text IN ('organization_admin', 'admin'))
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role::text = 'super_admin');
$$;

-- May the signed-in user touch a row that belongs to _org? Only Organization Admins are restricted:
-- reads may see shared (no centre) rows, writes may only touch their own centre's rows.
CREATE OR REPLACE FUNCTION public.admin_centre_ok(_org uuid, _write boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR NOT public.is_org_admin_only(auth.uid()) THEN true
    WHEN _org IS NULL THEN NOT _write
    ELSE _org = public.get_user_organization(auth.uid())
  END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Admin override (break-glass): time-limited, reasoned, audited
-- ---------------------------------------------------------------------------
CREATE TABLE public.admin_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid,
  reason text NOT NULL CHECK (length(trim(reason)) >= 10),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz
);
CREATE INDEX idx_admin_overrides_user ON public.admin_overrides (user_id, expires_at DESC);
ALTER TABLE public.admin_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see their own overrides" ON public.admin_overrides FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Super admins see all overrides" ON public.admin_overrides FOR SELECT USING (public.is_super_admin(auth.uid()));
REVOKE ALL ON public.admin_overrides FROM anon, authenticated;
GRANT SELECT ON public.admin_overrides TO authenticated;

CREATE OR REPLACE FUNCTION public.has_active_admin_override(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_overrides o WHERE o.user_id = _user_id AND o.ended_at IS NULL AND o.expires_at > now());
$$;

-- May the signed-in user write finance / grade rows? Organization Admins only inside an active override.
CREATE OR REPLACE FUNCTION public.admin_write_allowed()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NULL OR NOT public.is_org_admin_only(auth.uid()) OR public.has_active_admin_override(auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 3. Audit trail (append-only; written only by trusted functions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  organization_id uuid,
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_admin_audit_log_org ON public.admin_audit_log (organization_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_actor ON public.admin_audit_log (actor_id, created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read the audit log" ON public.admin_audit_log FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Centre admins read their centre's audit log" ON public.admin_audit_log FOR SELECT
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['organization_admin', 'admin']));
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_log_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('app.audit_maintenance', true), '') = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'The admin audit log cannot be changed';
END $$;
CREATE TRIGGER trg_admin_audit_log_append_only BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_append_only();

-- Writes one audit entry. Trusted callers only (triggers, RPCs); not granted to clients.
CREATE OR REPLACE FUNCTION public.log_admin_action(_org uuid, _action text, _entity text, _entity_id text, _summary text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid(); v_name text; v_role text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.user_id = v_actor LIMIT 1;
    SELECT ur.role::text INTO v_role FROM public.user_roles ur WHERE ur.user_id = v_actor ORDER BY ur.created_at LIMIT 1;
  END IF;
  INSERT INTO public.admin_audit_log (organization_id, actor_id, actor_name, actor_role, action, entity, entity_id, summary, details)
  VALUES (COALESCE(_org, CASE WHEN v_actor IS NOT NULL THEN public.get_user_organization(v_actor) END), v_actor, v_name, v_role, _action, _entity, _entity_id, _summary, COALESCE(_details, '{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.log_admin_action(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(uuid, text, text, text, text, jsonb) TO service_role;

-- Row trigger: records changes made by admin-level users (centre admins and super admins)
CREATE OR REPLACE FUNCTION public.audit_admin_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_new jsonb; v_old jsonb; v_row jsonb; v_changes jsonb; v_org uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN RETURN COALESCE(NEW, OLD); END IF;
  v_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_row := COALESCE(v_new, v_old);
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k)) INTO v_changes
    FROM jsonb_object_keys(v_new) k WHERE k <> 'updated_at' AND (v_new -> k) IS DISTINCT FROM (v_old -> k);
    IF v_changes IS NULL THEN RETURN NEW; END IF;
  ELSE
    v_changes := v_row;
  END IF;
  v_org := NULLIF(CASE WHEN TG_TABLE_NAME = 'organizations' THEN v_row ->> 'id' ELSE v_row ->> 'organization_id' END, '')::uuid;
  PERFORM public.log_admin_action(
    v_org, TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, v_row ->> 'id',
    initcap(lower(TG_OP)) || ' on ' || replace(TG_TABLE_NAME, '_', ' '),
    jsonb_build_object('changes', v_changes, 'override', public.has_active_admin_override(v_actor)));
  RETURN COALESCE(NEW, OLD);
END $$;

-- ---------------------------------------------------------------------------
-- 4. Override RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_admin_override(_reason text, _minutes integer DEFAULT 30)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid; v_expires timestamptz; v_mins integer := LEAST(GREATEST(COALESCE(_minutes, 30), 5), 120);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_org_admin_only(auth.uid()) THEN
    RAISE EXCEPTION 'Only an Organization Admin can start an override';
  END IF;
  IF length(trim(COALESCE(_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Give a reason of at least 10 characters';
  END IF;
  v_org := public.get_user_organization(auth.uid());
  UPDATE public.admin_overrides SET ended_at = now() WHERE user_id = auth.uid() AND ended_at IS NULL AND expires_at > now();
  v_expires := now() + make_interval(mins => v_mins);
  INSERT INTO public.admin_overrides (user_id, organization_id, reason, expires_at) VALUES (auth.uid(), v_org, trim(_reason), v_expires);
  PERFORM public.log_admin_action(v_org, 'override.started', 'admin_overrides', NULL, 'Started an admin override for finance and grades',
    jsonb_build_object('reason', trim(_reason), 'minutes', v_mins, 'expires_at', v_expires));
  RETURN v_expires;
END $$;
GRANT EXECUTE ON FUNCTION public.start_admin_override(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_admin_override()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  v_org := public.get_user_organization(auth.uid());
  IF EXISTS (SELECT 1 FROM public.admin_overrides WHERE user_id = auth.uid() AND ended_at IS NULL AND expires_at > now()) THEN
    UPDATE public.admin_overrides SET ended_at = now() WHERE user_id = auth.uid() AND ended_at IS NULL;
    PERFORM public.log_admin_action(v_org, 'override.ended', 'admin_overrides', NULL, 'Ended the admin override', '{}'::jsonb);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.end_admin_override() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_admin_override(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Only super admins grant, change or remove admin-level roles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_privileged_roles()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid(); v_priv text[] := ARRAY['organization_admin', 'admin', 'super_admin', 'vms_developer', 'vms_support'];
BEGIN
  IF v_actor IS NULL OR public.is_super_admin(v_actor) THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.role::text = ANY (v_priv) THEN
    RAISE EXCEPTION 'Only a super admin can grant the % role', NEW.role;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role::text = ANY (v_priv) THEN
    RAISE EXCEPTION 'Only a super admin can change or remove the % role', OLD.role;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_guard_privileged_roles ON public.user_roles;
CREATE TRIGGER trg_guard_privileged_roles BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_privileged_roles();

-- ---------------------------------------------------------------------------
-- 6. Restrictive policies, built only for tables that exist in this database
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record; t text;
BEGIN
  -- (a) An Organization Admin stays inside their own centre. {t} is the table name, which keeps outer columns
  --     unambiguous (trainees has its own trainee_id column).
  FOR r IN SELECT * FROM (VALUES
    ('announcements',          '{t}.organization_id'),
    ('classes',                '{t}.organization_id'),
    ('fee_records',            '{t}.organization_id'),
    ('generated_documents',    '{t}.organization_id'),
    ('internship_placements',  '{t}.organization_id'),
    ('job_applications',       '{t}.organization_id'),
    ('trades',                 '{t}.organization_id'),
    ('trainers',               '{t}.organization_id'),
    ('permission_audit_logs',  '{t}.organization_id'),
    ('user_activity_logs',     '{t}.organization_id'),
    ('notifications',          '{t}.organization_id'),
    ('class_enrollments',      '(SELECT x.organization_id FROM public.classes x WHERE x.id = {t}.class_id)'),
    ('timetable_slots',        '(SELECT x.organization_id FROM public.classes x WHERE x.id = {t}.class_id)'),
    ('trainee_enrollments',    '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('trainee_update_requests','(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('documents',              '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('assessment_results',     '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('marks',                  '(SELECT x.organization_id FROM public.trainees x WHERE x.id = {t}.trainee_id)'),
    ('payments',               '(SELECT x.organization_id FROM public.fee_records x WHERE x.id = {t}.fee_record_id)'),
    ('trainer_trades',         '(SELECT x.organization_id FROM public.trainers x WHERE x.id = {t}.trainer_id)'),
    ('assessments',            '(SELECT x.organization_id FROM public.user_roles x WHERE x.user_id = {t}.created_by LIMIT 1)')
  ) AS v(tbl, org_expr) LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN CONTINUE; END IF;
    t := r.tbl;
    EXECUTE format('DROP POLICY IF EXISTS "Centre admins stay in their centre (read)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Centre admins stay in their centre (insert)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Centre admins stay in their centre (update)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Centre admins stay in their centre (delete)" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Centre admins stay in their centre (read)" ON public.%I AS RESTRICTIVE FOR SELECT USING (NOT (SELECT public.is_org_admin_only(auth.uid())) OR public.admin_centre_ok(%s, false))', t, replace(r.org_expr, '{t}', t));
    EXECUTE format('CREATE POLICY "Centre admins stay in their centre (insert)" ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT (SELECT public.is_org_admin_only(auth.uid())) OR public.admin_centre_ok(%s, true))', t, replace(r.org_expr, '{t}', t));
    EXECUTE format('CREATE POLICY "Centre admins stay in their centre (update)" ON public.%I AS RESTRICTIVE FOR UPDATE USING (NOT (SELECT public.is_org_admin_only(auth.uid())) OR public.admin_centre_ok(%s, true)) WITH CHECK (NOT (SELECT public.is_org_admin_only(auth.uid())) OR public.admin_centre_ok(%s, true))', t, replace(r.org_expr, '{t}', t), replace(r.org_expr, '{t}', t));
    EXECUTE format('CREATE POLICY "Centre admins stay in their centre (delete)" ON public.%I AS RESTRICTIVE FOR DELETE USING (NOT (SELECT public.is_org_admin_only(auth.uid())) OR public.admin_centre_ok(%s, true))', t, replace(r.org_expr, '{t}', t));
  END LOOP;

  -- (b) Shared reference data (courses, unit standards, assessment types) is changed by super admins only
  FOREACH t IN ARRAY ARRAY['courses', 'unit_standards', 'course_unit_standards', 'assessment_types'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Only super admins change shared reference data (insert)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Only super admins change shared reference data (update)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Only super admins change shared reference data (delete)" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Only super admins change shared reference data (insert)" ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT (SELECT public.is_org_admin_only(auth.uid())))', t);
    EXECUTE format('CREATE POLICY "Only super admins change shared reference data (update)" ON public.%I AS RESTRICTIVE FOR UPDATE USING (NOT (SELECT public.is_org_admin_only(auth.uid()))) WITH CHECK (NOT (SELECT public.is_org_admin_only(auth.uid())))', t);
    EXECUTE format('CREATE POLICY "Only super admins change shared reference data (delete)" ON public.%I AS RESTRICTIVE FOR DELETE USING (NOT (SELECT public.is_org_admin_only(auth.uid())))', t);
  END LOOP;

  -- (c) Private messages are not an admin's to read
  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins cannot read other people's messages" ON public.messages;
    CREATE POLICY "Admins cannot read other people's messages" ON public.messages AS RESTRICTIVE FOR SELECT
      USING (NOT (SELECT public.is_org_admin_only(auth.uid())) OR sender_id = auth.uid() OR receiver_id = auth.uid());
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins cannot read other people's notifications" ON public.notifications;
    CREATE POLICY "Admins cannot read other people's notifications" ON public.notifications AS RESTRICTIVE FOR SELECT
      USING (NOT (SELECT public.is_org_admin_only(auth.uid())) OR user_id = auth.uid());
  END IF;

  -- (d) Finance and grades: an Organization Admin can read, but writes need an active override
  FOREACH t IN ARRAY ARRAY[
    'fee_records', 'payments', 'invoices', 'invoice_items', 'payment_clearances', 'payment_plans', 'payment_plan_installments',
    'hostel_fees', 'financial_transactions', 'fee_types', 'bank_statement_imports', 'bank_statement_lines',
    'marks', 'assessment_results', 'gradebook_marks', 'gradebook_ca_scores', 'exam_results', 'ca_final_results',
    'qualification_results', 'summative_results', 'transcripts'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Admin writes need an override (insert)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin writes need an override (update)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin writes need an override (delete)" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admin writes need an override (insert)" ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK ((SELECT public.admin_write_allowed()))', t);
    EXECUTE format('CREATE POLICY "Admin writes need an override (update)" ON public.%I AS RESTRICTIVE FOR UPDATE USING ((SELECT public.admin_write_allowed())) WITH CHECK ((SELECT public.admin_write_allowed()))', t);
    EXECUTE format('CREATE POLICY "Admin writes need an override (delete)" ON public.%I AS RESTRICTIVE FOR DELETE USING ((SELECT public.admin_write_allowed()))', t);
  END LOOP;

  -- (e) Audit triggers on the tables admins change
  FOREACH t IN ARRAY ARRAY[
    'user_roles', 'custom_roles', 'organization_settings', 'organization_modules', 'organizations',
    'fee_records', 'payments', 'invoices', 'payment_clearances', 'payment_plans', 'hostel_fees', 'financial_transactions', 'fee_types',
    'marks', 'assessment_results', 'transcripts', 'gradebooks',
    'trainers', 'classes', 'trades', 'announcements', 'registration_windows', 'deferral_requests'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_admin_change ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_admin_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. The older audit table accepted rows from any signed-in user, so entries could be forged
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.system_audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can insert system audit logs" ON public.system_audit_logs;
    CREATE POLICY "Users can only log their own actions" ON public.system_audit_logs FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
