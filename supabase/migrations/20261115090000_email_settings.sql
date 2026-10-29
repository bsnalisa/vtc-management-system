-- Email through Microsoft 365, set up by the Super Admin for each centre.
-- Every centre is its own Microsoft 365 tenant with its own email domain (for example nvtc.edu.na for Nakayale VTC and
-- vvtc.edu.na for Valombola VTC). The Super Admin registers an app in that tenant and records its tenant id, client id and
-- client secret, the centre's domain and the mailbox the system sends from (which must be on that domain); the dispatcher then
-- sends that centre's email through Microsoft Graph with those credentials. The client secret is write-only: it is kept in
-- Supabase Vault, never returned to any browser, and only the service role (the dispatcher and the test-email function) can
-- read it. Email can be switched on only after a successful test, and any change to the credentials or the domain switches it
-- off again. The centre's Organization Admin can see the status, the queue and the history but not the credentials, and can put
-- failed messages back in the queue. The dispatcher also accepts the Vault job secret, so no separate edge-function secret has
-- to be set for scheduled delivery.

CREATE TABLE public.email_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'microsoft365' CHECK (provider = 'microsoft365'),
  tenant_id text NOT NULL, client_id text NOT NULL,
  email_domain text NOT NULL CHECK (email_domain = lower(email_domain)),
  sender_address text NOT NULL CHECK (sender_address = lower(sender_address) AND sender_address LIKE '%@' || email_domain), sender_name text, reply_to text,
  enabled boolean NOT NULL DEFAULT false,
  secret_saved_at timestamptz,
  last_test_at timestamptz, last_test_ok boolean, last_test_error text, last_test_to text,
  updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX uq_email_settings_domain ON public.email_settings (email_domain);
CREATE POLICY "The Super Admin reads email settings" ON public.email_settings FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Centre isolation" ON public.email_settings AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.email_settings FROM anon, authenticated;
REVOKE ALL ON public.email_settings FROM anon;

CREATE TABLE public.email_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('saved', 'secret_changed', 'enabled', 'disabled', 'test_ok', 'test_failed', 'requeued')),
  note text, actor uuid, actor_name text, at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_events_org ON public.email_events (organization_id, at DESC);
CREATE TRIGGER trg_email_events_append_only BEFORE UPDATE OR DELETE ON public.email_events FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "The Super Admin reads the email log" ON public.email_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Centre isolation" ON public.email_events AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.email_events FROM anon, authenticated;
REVOKE ALL ON public.email_events FROM anon;

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.email_admin(_user uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND public.is_super_admin(_user);
$$;
-- who may look at the status of a centre's email: the Super Admin and that centre's Organization Admin
CREATE OR REPLACE FUNCTION private.email_viewer(_user uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND (public.is_super_admin(_user) OR public.has_org_role(_user, _org, ARRAY['organization_admin', 'admin']));
$$;
CREATE OR REPLACE FUNCTION private.email_log(_org uuid, _event text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.email_events (organization_id, event, note, actor, actor_name)
    VALUES (_org, _event, nullif(trim(coalesce(_note, '')), ''), auth.uid(), CASE WHEN auth.uid() IS NULL THEN 'System' ELSE coalesce(private.requisition_person(_org, auth.uid()) ->> 'name', (SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'Super Admin') END);
END $$;
CREATE OR REPLACE FUNCTION private.email_secret_name(_org uuid) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'email_client_secret_' || _org::text; $$;
CREATE OR REPLACE FUNCTION private.email_secret_put(_org uuid, _secret text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _name text := private.email_secret_name(_org);
BEGIN
  BEGIN
    EXECUTE 'select id from vault.secrets where name = $1' INTO _id USING _name;
    IF _id IS NULL THEN EXECUTE 'select vault.create_secret($1, $2, $3)' USING _secret, _name, 'Microsoft 365 client secret';
    ELSE EXECUTE 'select vault.update_secret($1, $2)' USING _id, _secret; END IF;
  EXCEPTION WHEN undefined_table OR invalid_schema_name OR undefined_function THEN
    RAISE EXCEPTION 'Secure storage for the client secret is not available on this system';
  END;
END $$;
CREATE OR REPLACE FUNCTION private.email_secret_get(_org uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text;
BEGIN
  BEGIN EXECUTE 'select decrypted_secret from vault.decrypted_secrets where name = $1' INTO _s USING private.email_secret_name(_org);
  EXCEPTION WHEN undefined_table OR invalid_schema_name THEN RETURN NULL; END;
  RETURN _s;
END $$;
REVOKE ALL ON FUNCTION private.email_admin(uuid, uuid), private.email_viewer(uuid, uuid), private.email_log(uuid, text, text), private.email_secret_name(uuid), private.email_secret_put(uuid, text), private.email_secret_get(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the administrator sees and changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_settings_get(_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.email_settings%ROWTYPE;
BEGIN
  IF NOT private.email_viewer(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.email_settings WHERE organization_id = _org;
  RETURN jsonb_build_object(
    'configured', FOUND,
    'can_edit', private.email_admin(auth.uid(), _org),
    'centre', (SELECT name FROM public.organizations WHERE id = _org),
    'settings', CASE WHEN FOUND THEN jsonb_build_object('tenant_id', CASE WHEN private.email_admin(auth.uid(), _org) THEN s.tenant_id END, 'client_id', CASE WHEN private.email_admin(auth.uid(), _org) THEN s.client_id END,
        'email_domain', s.email_domain, 'sender_address', s.sender_address, 'sender_name', s.sender_name,
        'reply_to', s.reply_to, 'enabled', s.enabled, 'has_secret', s.secret_saved_at IS NOT NULL, 'secret_saved_at', s.secret_saved_at,
        'last_test_at', s.last_test_at, 'last_test_ok', s.last_test_ok, 'last_test_error', s.last_test_error, 'last_test_to', s.last_test_to, 'updated_at', s.updated_at) END,
    'queue', jsonb_build_object(
      'queued', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = _org AND channel = 'email' AND status IN ('queued', 'sending')),
      'sent', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = _org AND channel = 'email' AND status = 'sent' AND sent_at > now() - interval '7 days'),
      'failed', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = _org AND channel = 'email' AND status = 'failed'),
      'last_error', (SELECT error FROM public.outbound_messages WHERE organization_id = _org AND channel = 'email' AND error IS NOT NULL ORDER BY created_at DESC LIMIT 1)),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event, 'note', e.note, 'by', e.actor_name, 'at', e.at) ORDER BY e.at DESC)
        FROM (SELECT * FROM public.email_events WHERE organization_id = _org ORDER BY at DESC LIMIT 30) e), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.email_settings_save(_org uuid, _tenant text, _client text, _secret text, _domain text, _sender text, _sender_name text, _reply_to text, _enabled boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.email_settings%ROWTYPE; had boolean; _t text := lower(trim(coalesce(_tenant, ''))); _c text := lower(trim(coalesce(_client, ''))); _d text := lower(trim(coalesce(_domain, '')));
  _snd text := lower(trim(coalesce(_sender, ''))); _rt text := nullif(lower(trim(coalesce(_reply_to, ''))), ''); _sec text := nullif(trim(coalesce(_secret, '')), '');
  changed boolean; new_enabled boolean;
BEGIN
  IF NOT private.email_admin(auth.uid(), _org) THEN RAISE EXCEPTION 'Only the Super Admin sets up email' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org) THEN RAISE EXCEPTION 'Unknown centre'; END IF;
  IF _d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN RAISE EXCEPTION 'Enter the centre''s email domain, for example nvtc.edu.na'; END IF;
  IF _t !~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9][a-z0-9.-]*\.[a-z]{2,})$' THEN RAISE EXCEPTION 'Enter the Microsoft 365 tenant ID (a GUID) or the tenant domain'; END IF;
  IF _c !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Enter the application (client) ID as a GUID'; END IF;
  IF _snd !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_snd) > 200 THEN RAISE EXCEPTION 'Enter the mailbox the system sends from, for example no-reply@nvtc.edu.na'; END IF;
  IF split_part(_snd, '@', 2) <> _d THEN RAISE EXCEPTION 'The sending mailbox must be on the centre''s own domain (@%)', _d; END IF;
  IF EXISTS (SELECT 1 FROM public.email_settings WHERE email_domain = _d AND organization_id <> _org) THEN RAISE EXCEPTION 'Another centre already uses the domain %', _d; END IF;
  IF _rt IS NOT NULL AND _rt !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'The reply-to address is not a valid email address'; END IF;
  IF _sec IS NOT NULL AND length(_sec) < 8 THEN RAISE EXCEPTION 'The client secret looks too short; copy the secret VALUE, not its ID'; END IF;
  SELECT * INTO s FROM public.email_settings WHERE organization_id = _org FOR UPDATE;
  had := FOUND;
  IF NOT had AND _sec IS NULL THEN RAISE EXCEPTION 'Enter the client secret'; END IF;
  changed := NOT had OR s.tenant_id <> _t OR s.client_id <> _c OR s.sender_address <> _snd OR s.email_domain <> _d OR _sec IS NOT NULL;
  IF _sec IS NOT NULL THEN PERFORM private.email_secret_put(_org, _sec); END IF;
  -- different credentials have not been tested yet, so email is switched off until the next successful test
  new_enabled := CASE WHEN changed THEN false ELSE coalesce(_enabled, false) END;
  IF new_enabled AND NOT coalesce(s.last_test_ok, false) THEN RAISE EXCEPTION 'Send a successful test email before turning email on'; END IF;
  IF NOT had THEN
    INSERT INTO public.email_settings (organization_id, tenant_id, client_id, email_domain, sender_address, sender_name, reply_to, enabled, secret_saved_at, updated_by)
      VALUES (_org, _t, _c, _d, _snd, nullif(trim(coalesce(_sender_name, '')), ''), _rt, false, now(), auth.uid());
  ELSE
    UPDATE public.email_settings SET tenant_id = _t, client_id = _c, email_domain = _d, sender_address = _snd, sender_name = nullif(trim(coalesce(_sender_name, '')), ''), reply_to = _rt,
        enabled = new_enabled, secret_saved_at = CASE WHEN _sec IS NOT NULL THEN now() ELSE secret_saved_at END,
        last_test_ok = CASE WHEN changed THEN NULL ELSE last_test_ok END, last_test_error = CASE WHEN changed THEN NULL ELSE last_test_error END,
        last_test_at = CASE WHEN changed THEN NULL ELSE last_test_at END, updated_by = auth.uid(), updated_at = now()
     WHERE organization_id = _org;
  END IF;
  IF _sec IS NOT NULL THEN PERFORM private.email_log(_org, 'secret_changed', 'Client secret replaced'); END IF;
  PERFORM private.email_log(_org, 'saved', CASE WHEN changed THEN 'Settings saved; send a test email before turning email on' ELSE 'Settings saved' END);
  IF had AND s.enabled IS DISTINCT FROM new_enabled THEN PERFORM private.email_log(_org, CASE WHEN new_enabled THEN 'enabled' ELSE 'disabled' END, NULL);
  ELSIF NOT had AND new_enabled THEN PERFORM private.email_log(_org, 'enabled', NULL); END IF;
  RETURN public.email_settings_get(_org);
END $$;

-- puts failed messages back in the queue (for example after the settings were corrected)
CREATE OR REPLACE FUNCTION public.email_requeue_failed(_org uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT private.email_viewer(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  UPDATE public.outbound_messages SET status = 'queued', attempts = 0, error = NULL, claimed_at = NULL
   WHERE organization_id = _org AND channel = 'email' AND status = 'failed' AND created_at > now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM private.email_log(_org, 'requeued', n || ' failed message(s) put back in the queue');
  RETURN n;
END $$;

-- every centre at a glance, for the Super Admin
CREATE OR REPLACE FUNCTION public.email_settings_centres() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.email_admin(auth.uid(), NULL) THEN RAISE EXCEPTION 'Only the Super Admin sets up email' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'configured', s.organization_id IS NOT NULL, 'enabled', coalesce(s.enabled, false),
      'email_domain', s.email_domain, 'sender_address', s.sender_address, 'last_test_ok', s.last_test_ok,
      'queued', (SELECT count(*) FROM public.outbound_messages m WHERE m.organization_id = o.id AND m.channel = 'email' AND m.status IN ('queued', 'sending')),
      'failed', (SELECT count(*) FROM public.outbound_messages m WHERE m.organization_id = o.id AND m.channel = 'email' AND m.status = 'failed')) ORDER BY o.name)
    FROM public.organizations o LEFT JOIN public.email_settings s ON s.organization_id = o.id), '[]'::jsonb);
END $$;

-- ---------------------------------------------------------------------------
-- Used by the edge functions (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_settings_credentials(_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.email_settings%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.email_settings WHERE organization_id = _org;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('tenant_id', s.tenant_id, 'client_id', s.client_id, 'client_secret', private.email_secret_get(_org), 'sender_address', s.sender_address,
    'sender_name', s.sender_name, 'reply_to', s.reply_to, 'enabled', s.enabled);
END $$;

CREATE OR REPLACE FUNCTION public.email_settings_record_test(_org uuid, _ok boolean, _error text, _to text, _by uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  UPDATE public.email_settings SET last_test_at = now(), last_test_ok = _ok, last_test_error = CASE WHEN _ok THEN NULL ELSE left(_error, 500) END, last_test_to = _to,
      enabled = CASE WHEN _ok THEN enabled ELSE false END
   WHERE organization_id = _org;
  INSERT INTO public.email_events (organization_id, event, note, actor, actor_name)
    VALUES (_org, CASE WHEN _ok THEN 'test_ok' ELSE 'test_failed' END, CASE WHEN _ok THEN 'Test email sent to ' || _to ELSE left(_error, 300) END, _by,
            CASE WHEN _by IS NULL THEN 'System' ELSE private.requisition_person(_org, _by) ->> 'name' END);
END $$;

-- the scheduled job proves itself with the Vault job secret, so the edge function needs no separate secret of its own
CREATE OR REPLACE FUNCTION public.verify_dispatch_secret(_candidate text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  BEGIN EXECUTE $q$select decrypted_secret from vault.decrypted_secrets where name = 'vms_dispatch_secret'$q$ INTO _s;
  EXCEPTION WHEN undefined_table OR invalid_schema_name THEN RETURN false; END;
  RETURN coalesce(_s, '') <> '' AND coalesce(_candidate, '') = _s;
END $$;

REVOKE ALL ON FUNCTION public.email_settings_get(uuid), public.email_settings_save(uuid, text, text, text, text, text, text, text, boolean), public.email_requeue_failed(uuid), public.email_settings_centres(),
  public.email_settings_credentials(uuid), public.email_settings_record_test(uuid, boolean, text, text, uuid), public.verify_dispatch_secret(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_settings_get(uuid), public.email_settings_save(uuid, text, text, text, text, text, text, text, boolean), public.email_requeue_failed(uuid), public.email_settings_centres() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.email_settings_credentials(uuid), public.email_settings_record_test(uuid, boolean, text, text, uuid), public.verify_dispatch_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.email_settings_credentials(uuid), public.email_settings_record_test(uuid, boolean, text, text, uuid), public.verify_dispatch_secret(text) TO service_role;
