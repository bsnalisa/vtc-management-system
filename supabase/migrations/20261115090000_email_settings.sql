-- Email through Microsoft 365, set up by the Super Admin.
-- NTA buys the Microsoft 365 licences and most VTCs share NTA's tenant, where each VTC has its own email domain (nvtc.edu.na,
-- vvtc.edu.na, ...). A VTC that already runs its own tenant is connected the same way. So credentials are kept as reusable
-- CONNECTIONS (a Microsoft 365 tenant, the application registered in it and its client secret) and each centre points at one
-- connection and adds only what is its own: its email domain and the mailbox the system sends from, which must be on that
-- domain. The dispatcher sends a centre's email through Microsoft Graph with its connection's credentials. Client secrets are
-- write-only: they are kept in Supabase Vault, never returned to any browser, and only the service role (the dispatcher and the
-- test-email function) can read them. A centre's email can be switched on only after a successful test, and any change to the
-- connection, domain or mailbox switches it off again. The centre's Organization Admin can see the status, the queue and the
-- history but not the credentials, and can put failed messages back in the queue. The dispatcher also accepts the Vault job
-- secret, so no separate edge-function secret has to be set for scheduled delivery.

CREATE TABLE public.email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  provider text NOT NULL DEFAULT 'microsoft365' CHECK (provider = 'microsoft365'),
  tenant_id text NOT NULL, client_id text NOT NULL,
  secret_saved_at timestamptz,
  updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_email_connections_name ON public.email_connections (lower(name));
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "The Super Admin reads email connections" ON public.email_connections FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
REVOKE ALL ON public.email_connections FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.email_connections FROM authenticated;

CREATE TABLE public.email_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.email_connections(id) ON DELETE RESTRICT,
  email_domain text NOT NULL CHECK (email_domain = lower(email_domain)),
  sender_address text NOT NULL CHECK (sender_address = lower(sender_address) AND sender_address LIKE '%@' || email_domain),
  sender_name text, reply_to text,
  enabled boolean NOT NULL DEFAULT false,
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
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid,
  event text NOT NULL CHECK (event IN ('connection_saved', 'secret_changed', 'connection_removed', 'saved', 'enabled', 'disabled', 'test_ok', 'test_failed', 'requeued')),
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
CREATE OR REPLACE FUNCTION private.email_log(_org uuid, _event text, _note text, _conn uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.email_events (organization_id, connection_id, event, note, actor, actor_name)
    VALUES (_org, _conn, _event, nullif(trim(coalesce(_note, '')), ''), auth.uid(),
            CASE WHEN auth.uid() IS NULL THEN 'System' ELSE coalesce((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'Super Admin') END);
END $$;
CREATE OR REPLACE FUNCTION private.email_secret_name(_conn uuid) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'email_connection_secret_' || _conn::text; $$;
CREATE OR REPLACE FUNCTION private.email_secret_put(_conn uuid, _secret text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _name text := private.email_secret_name(_conn);
BEGIN
  BEGIN
    EXECUTE 'select id from vault.secrets where name = $1' INTO _id USING _name;
    IF _id IS NULL THEN EXECUTE 'select vault.create_secret($1, $2, $3)' USING _secret, _name, 'Microsoft 365 client secret';
    ELSE EXECUTE 'select vault.update_secret($1, $2)' USING _id, _secret; END IF;
  EXCEPTION WHEN undefined_table OR invalid_schema_name OR undefined_function THEN
    RAISE EXCEPTION 'Secure storage for the client secret is not available on this system';
  END;
END $$;
CREATE OR REPLACE FUNCTION private.email_secret_get(_conn uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text;
BEGIN
  BEGIN EXECUTE 'select decrypted_secret from vault.decrypted_secrets where name = $1' INTO _s USING private.email_secret_name(_conn);
  EXCEPTION WHEN undefined_table OR invalid_schema_name THEN RETURN NULL; END;
  RETURN _s;
END $$;
CREATE OR REPLACE FUNCTION private.email_secret_drop(_conn uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN EXECUTE 'delete from vault.secrets where name = $1' USING private.email_secret_name(_conn);
  EXCEPTION WHEN undefined_table OR invalid_schema_name THEN NULL; END;
END $$;
REVOKE ALL ON FUNCTION private.email_admin(uuid, uuid), private.email_viewer(uuid, uuid), private.email_log(uuid, text, text, uuid), private.email_secret_name(uuid),
  private.email_secret_put(uuid, text), private.email_secret_get(uuid), private.email_secret_drop(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Connections (Super Admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_connection_save(_id uuid, _name text, _tenant text, _client text, _secret text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.email_connections%ROWTYPE; _n text := trim(coalesce(_name, '')); _t text := lower(trim(coalesce(_tenant, ''))); _c text := lower(trim(coalesce(_client, '')));
  _sec text := nullif(trim(coalesce(_secret, '')), ''); changed boolean; r record; had boolean := false; _cid uuid;
BEGIN
  IF NOT private.email_admin(auth.uid(), NULL) THEN RAISE EXCEPTION 'Only the Super Admin sets up email' USING ERRCODE = '42501'; END IF;
  IF length(_n) < 2 OR length(_n) > 80 THEN RAISE EXCEPTION 'Give the connection a name, for example NTA Microsoft 365'; END IF;
  IF _t !~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9][a-z0-9.-]*\.[a-z]{2,})$' THEN RAISE EXCEPTION 'Enter the Microsoft 365 tenant ID (a GUID) or the tenant domain'; END IF;
  IF _c !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Enter the application (client) ID as a GUID'; END IF;
  IF _sec IS NOT NULL AND length(_sec) < 8 THEN RAISE EXCEPTION 'The client secret looks too short; copy the secret VALUE, not its ID'; END IF;
  IF _id IS NOT NULL THEN SELECT * INTO c FROM public.email_connections WHERE id = _id FOR UPDATE; had := FOUND; IF NOT had THEN RAISE EXCEPTION 'Unknown connection'; END IF; END IF;
  IF NOT had AND _sec IS NULL THEN RAISE EXCEPTION 'Enter the client secret'; END IF;
  IF EXISTS (SELECT 1 FROM public.email_connections WHERE lower(name) = lower(_n) AND id IS DISTINCT FROM _id) THEN RAISE EXCEPTION 'A connection with that name already exists'; END IF;
  changed := had AND (c.tenant_id <> _t OR c.client_id <> _c OR _sec IS NOT NULL);
  IF NOT had THEN
    INSERT INTO public.email_connections (name, tenant_id, client_id, secret_saved_at, updated_by) VALUES (_n, _t, _c, now(), auth.uid()) RETURNING id INTO _cid;
  ELSE
    _cid := _id;
    UPDATE public.email_connections SET name = _n, tenant_id = _t, client_id = _c, secret_saved_at = CASE WHEN _sec IS NOT NULL THEN now() ELSE secret_saved_at END, updated_by = auth.uid(), updated_at = now() WHERE id = _id;
  END IF;
  IF _sec IS NOT NULL THEN PERFORM private.email_secret_put(_cid, _sec); END IF;
  PERFORM private.email_log(NULL, CASE WHEN _sec IS NOT NULL AND had THEN 'secret_changed' ELSE 'connection_saved' END, _n || CASE WHEN NOT had THEN ' created' WHEN changed THEN ' changed; centres using it were switched off until tested again' ELSE ' saved' END, _cid);
  -- different credentials have not been tested for the centres that use them
  IF changed THEN
    FOR r IN SELECT organization_id, enabled FROM public.email_settings WHERE connection_id = _cid LOOP
      UPDATE public.email_settings SET enabled = false, last_test_ok = NULL, last_test_error = NULL, last_test_at = NULL, updated_at = now() WHERE organization_id = r.organization_id;
      IF r.enabled THEN PERFORM private.email_log(r.organization_id, 'disabled', 'Switched off because the connection "' || _n || '" changed; send a test email to switch it on again', _cid); END IF;
    END LOOP;
  END IF;
  RETURN _cid;
END $$;

CREATE OR REPLACE FUNCTION public.email_connection_delete(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.email_connections%ROWTYPE;
BEGIN
  IF NOT private.email_admin(auth.uid(), NULL) THEN RAISE EXCEPTION 'Only the Super Admin sets up email' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.email_connections WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown connection'; END IF;
  IF EXISTS (SELECT 1 FROM public.email_settings WHERE connection_id = _id) THEN RAISE EXCEPTION 'Centres still use this connection; move them to another connection first'; END IF;
  DELETE FROM public.email_connections WHERE id = _id;
  PERFORM private.email_secret_drop(_id);
  PERFORM private.email_log(NULL, 'connection_removed', c.name || ' removed', _id);
END $$;

CREATE OR REPLACE FUNCTION public.email_connections_list() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.email_admin(auth.uid(), NULL) THEN RAISE EXCEPTION 'Only the Super Admin sets up email' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'tenant_id', c.tenant_id, 'client_id', c.client_id, 'has_secret', c.secret_saved_at IS NOT NULL,
      'secret_saved_at', c.secret_saved_at, 'centres', coalesce((SELECT jsonb_agg(o.name ORDER BY o.name) FROM public.email_settings s JOIN public.organizations o ON o.id = s.organization_id WHERE s.connection_id = c.id), '[]'::jsonb)) ORDER BY c.name)
    FROM public.email_connections c), '[]'::jsonb);
END $$;

-- ---------------------------------------------------------------------------
-- What the administrator sees and changes, per centre
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_settings_get(_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.email_settings%ROWTYPE; _super boolean := private.email_admin(auth.uid(), _org);
BEGIN
  IF NOT private.email_viewer(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.email_settings WHERE organization_id = _org;
  RETURN jsonb_build_object(
    'configured', FOUND,
    'can_edit', _super,
    'centre', (SELECT name FROM public.organizations WHERE id = _org),
    'settings', CASE WHEN FOUND THEN jsonb_build_object('connection_id', CASE WHEN _super THEN s.connection_id END,
        'connection_name', CASE WHEN _super THEN (SELECT name FROM public.email_connections WHERE id = s.connection_id) END,
        'email_domain', s.email_domain, 'sender_address', s.sender_address, 'sender_name', s.sender_name,
        'reply_to', s.reply_to, 'enabled', s.enabled,
        'last_test_at', s.last_test_at, 'last_test_ok', s.last_test_ok, 'last_test_error', s.last_test_error, 'last_test_to', s.last_test_to, 'updated_at', s.updated_at) END,
    'queue', jsonb_build_object(
      'queued', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = _org AND channel = 'email' AND status IN ('queued', 'sending')),
      'sent', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = _org AND channel = 'email' AND status = 'sent' AND sent_at > now() - interval '7 days'),
      'failed', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = _org AND channel = 'email' AND status = 'failed'),
      'last_error', (SELECT error FROM public.outbound_messages WHERE organization_id = _org AND channel = 'email' AND error IS NOT NULL ORDER BY created_at DESC LIMIT 1)),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event, 'note', e.note, 'by', e.actor_name, 'at', e.at) ORDER BY e.at DESC)
        FROM (SELECT * FROM public.email_events WHERE organization_id = _org ORDER BY at DESC LIMIT 30) e), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.email_settings_save(_org uuid, _connection uuid, _domain text, _sender text, _sender_name text, _reply_to text, _enabled boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.email_settings%ROWTYPE; had boolean; _d text := lower(trim(coalesce(_domain, ''))); _snd text := lower(trim(coalesce(_sender, '')));
  _rt text := nullif(lower(trim(coalesce(_reply_to, ''))), ''); changed boolean; new_enabled boolean;
BEGIN
  IF NOT private.email_admin(auth.uid(), _org) THEN RAISE EXCEPTION 'Only the Super Admin sets up email' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org) THEN RAISE EXCEPTION 'Unknown centre'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.email_connections WHERE id = _connection) THEN RAISE EXCEPTION 'Choose the Microsoft 365 connection this centre uses'; END IF;
  IF _d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN RAISE EXCEPTION 'Enter the centre''s email domain, for example nvtc.edu.na'; END IF;
  IF _snd !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_snd) > 200 THEN RAISE EXCEPTION 'Enter the mailbox the system sends from, for example no-reply@nvtc.edu.na'; END IF;
  IF split_part(_snd, '@', 2) <> _d THEN RAISE EXCEPTION 'The sending mailbox must be on the centre''s own domain (@%)', _d; END IF;
  IF _rt IS NOT NULL AND _rt !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'The reply-to address is not a valid email address'; END IF;
  IF EXISTS (SELECT 1 FROM public.email_settings WHERE email_domain = _d AND organization_id <> _org) THEN RAISE EXCEPTION 'Another centre already uses the domain %', _d; END IF;
  SELECT * INTO s FROM public.email_settings WHERE organization_id = _org FOR UPDATE;
  had := FOUND;
  changed := NOT had OR s.connection_id <> _connection OR s.sender_address <> _snd OR s.email_domain <> _d;
  -- a different connection, domain or mailbox has not been tested yet, so email stays off until the next successful test
  new_enabled := CASE WHEN changed THEN false ELSE coalesce(_enabled, false) END;
  IF new_enabled AND NOT coalesce(s.last_test_ok, false) THEN RAISE EXCEPTION 'Send a successful test email before turning email on'; END IF;
  IF NOT had THEN
    INSERT INTO public.email_settings (organization_id, connection_id, email_domain, sender_address, sender_name, reply_to, enabled, updated_by)
      VALUES (_org, _connection, _d, _snd, nullif(trim(coalesce(_sender_name, '')), ''), _rt, false, auth.uid());
  ELSE
    UPDATE public.email_settings SET connection_id = _connection, email_domain = _d, sender_address = _snd, sender_name = nullif(trim(coalesce(_sender_name, '')), ''), reply_to = _rt,
        enabled = new_enabled, last_test_ok = CASE WHEN changed THEN NULL ELSE last_test_ok END, last_test_error = CASE WHEN changed THEN NULL ELSE last_test_error END,
        last_test_at = CASE WHEN changed THEN NULL ELSE last_test_at END, updated_by = auth.uid(), updated_at = now()
     WHERE organization_id = _org;
  END IF;
  PERFORM private.email_log(_org, 'saved', CASE WHEN changed THEN 'Settings saved; send a test email before turning email on' ELSE 'Settings saved' END, _connection);
  IF had AND s.enabled IS DISTINCT FROM new_enabled THEN PERFORM private.email_log(_org, CASE WHEN new_enabled THEN 'enabled' ELSE 'disabled' END, NULL, _connection);
  ELSIF NOT had AND new_enabled THEN PERFORM private.email_log(_org, 'enabled', NULL, _connection); END IF;
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
      'connection_name', c.name, 'email_domain', s.email_domain, 'sender_address', s.sender_address, 'last_test_ok', s.last_test_ok,
      'queued', (SELECT count(*) FROM public.outbound_messages m WHERE m.organization_id = o.id AND m.channel = 'email' AND m.status IN ('queued', 'sending')),
      'failed', (SELECT count(*) FROM public.outbound_messages m WHERE m.organization_id = o.id AND m.channel = 'email' AND m.status = 'failed')) ORDER BY o.name)
    FROM public.organizations o LEFT JOIN public.email_settings s ON s.organization_id = o.id LEFT JOIN public.email_connections c ON c.id = s.connection_id), '[]'::jsonb);
END $$;

-- ---------------------------------------------------------------------------
-- Used by the edge functions (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_settings_credentials(_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.email_settings%ROWTYPE; c public.email_connections%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.email_settings WHERE organization_id = _org;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.email_connections WHERE id = s.connection_id;
  RETURN jsonb_build_object('tenant_id', c.tenant_id, 'client_id', c.client_id, 'client_secret', private.email_secret_get(c.id), 'sender_address', s.sender_address,
    'sender_name', s.sender_name, 'reply_to', s.reply_to, 'enabled', s.enabled, 'connection_id', c.id);
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

REVOKE ALL ON FUNCTION public.email_connection_save(uuid, text, text, text, text), public.email_connection_delete(uuid), public.email_connections_list(),
  public.email_settings_get(uuid), public.email_settings_save(uuid, uuid, text, text, text, text, boolean), public.email_requeue_failed(uuid), public.email_settings_centres(),
  public.email_settings_credentials(uuid), public.email_settings_record_test(uuid, boolean, text, text, uuid), public.verify_dispatch_secret(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_connection_save(uuid, text, text, text, text), public.email_connection_delete(uuid), public.email_connections_list(),
  public.email_settings_get(uuid), public.email_settings_save(uuid, uuid, text, text, text, text, boolean), public.email_requeue_failed(uuid), public.email_settings_centres() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.email_settings_credentials(uuid), public.email_settings_record_test(uuid, boolean, text, text, uuid), public.verify_dispatch_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.email_settings_credentials(uuid), public.email_settings_record_test(uuid, boolean, text, text, uuid), public.verify_dispatch_secret(text) TO service_role;
