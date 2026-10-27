-- Complete reset of test data.
-- Test trainees (and optionally the test staff logins) can be removed in one step by the Super Admin, together with everything that hangs off
-- them: registrations, fees, results, transfers, identity records, issued numbers, logins, roles and queued messages. Real data is never
-- touched: a person is only removed when their identity is marked as a test identity, and a login only when it belongs solely to test people
-- (staff logins only when their address ends in @vms-test.example). The reset can be previewed (dry run) and every real run is logged.

-- ---------------------------------------------------------------------------
-- 1. Which identities are test identities
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainee_identities ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.trainee_identities_mark_test() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trainee_number ILIKE 'TEST-%' THEN NEW.is_test := true; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_identities_mark_test ON public.trainee_identities;
CREATE TRIGGER trg_identities_mark_test BEFORE INSERT OR UPDATE OF trainee_number ON public.trainee_identities
  FOR EACH ROW EXECUTE FUNCTION public.trainee_identities_mark_test();

UPDATE public.trainee_identities SET is_test = true
 WHERE NOT is_test AND (trainee_number ILIKE 'TEST-%'
   OR id IN (SELECT identity_id FROM public.trainees WHERE identity_id IS NOT NULL AND (email ILIKE '%@vms-test.example' OR system_email ILIKE '%@vms-test.example')));

-- append-only log of resets (counts only, no personal data)
CREATE TABLE IF NOT EXISTS public.test_data_purges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_by uuid, run_at timestamptz NOT NULL DEFAULT now(),
  include_staff boolean NOT NULL, counts jsonb NOT NULL
);
ALTER TABLE public.test_data_purges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read test data purges" ON public.test_data_purges FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.test_data_purges_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'The reset log can never be changed or removed' USING ERRCODE = '42501'; END $$;
CREATE TRIGGER trg_test_data_purges_append_only BEFORE UPDATE OR DELETE ON public.test_data_purges FOR EACH ROW EXECUTE FUNCTION public.test_data_purges_append_only();

-- files uploaded by test logins; the database cannot delete storage files, so the purge-test-storage function removes them from this list
CREATE TABLE IF NOT EXISTS public.test_storage_queue (
  bucket_id text NOT NULL, name text NOT NULL, queued_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id, name)
);
ALTER TABLE public.test_storage_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read the test file queue" ON public.test_storage_queue FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION private.queue_test_files(_uids uuid[]) RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE n integer := 0;
BEGIN
  BEGIN
    EXECUTE 'INSERT INTO public.test_storage_queue (bucket_id, name) SELECT bucket_id, name FROM storage.objects WHERE owner = ANY ($1) ON CONFLICT DO NOTHING' USING _uids;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN undefined_table OR undefined_column OR invalid_schema_name THEN n := 0;
  END;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.queue_test_files(uuid[]) FROM PUBLIC, anon, authenticated;
SELECT private.queue_test_files(coalesce(array_agg(id), '{}')) FROM auth.users WHERE email ILIKE '%@vms-test.example';

CREATE OR REPLACE FUNCTION public.mark_test_identities(_numbers text[], _is_test boolean DEFAULT true) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only the Super Admin can mark test trainees' USING ERRCODE = '42501'; END IF;
  UPDATE public.trainee_identities SET is_test = _is_test WHERE trainee_number = ANY (_numbers) AND (_is_test OR trainee_number NOT ILIKE 'TEST-%');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.list_test_identities() RETURNS TABLE (trainee_number text, full_name text, centre text, status text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only the Super Admin can list test trainees' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT i.trainee_number, trim(coalesce(i.first_name, '') || ' ' || coalesce(i.last_name, '')),
           coalesce((SELECT string_agg(DISTINCT o.name, ', ') FROM public.trainees t JOIN public.organizations o ON o.id = t.organization_id WHERE t.identity_id = i.id), '-'),
           i.status
      FROM public.trainee_identities i WHERE i.is_test ORDER BY i.trainee_number;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The reset
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

-- Deletes the rows of _tbl matching _pred together with everything that references them. Foreign-key actions do not run while triggers
-- are off (the append-only guards would otherwise block the reset), so the dependants are followed here: nullable references are cleared,
-- the rest are removed. Core set-up tables are protected: if the walk would remove any of their rows it stops and nothing changes.
CREATE OR REPLACE FUNCTION private.purge_cascade(_tbl regclass, _pred text, _path regclass[]) RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE fk record; _cols text; _pcols text; _cond text; _nullable boolean; _n bigint;
  _protected text[] := ARRAY['organizations', 'qualifications', 'trades', 'academic_years'];
BEGIN
  IF cardinality(_path) > 10 THEN RAISE EXCEPTION 'Reset stopped: dependency chain too deep at %', _tbl; END IF;
  FOR fk IN SELECT c.conrelid::regclass AS child, c.conkey, c.confkey FROM pg_constraint c WHERE c.contype = 'f' AND c.confrelid = _tbl LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord), bool_and(NOT a.attnotnull) INTO _cols, _nullable
      FROM unnest(fk.conkey) WITH ORDINALITY k(attnum, ord) JOIN pg_attribute a ON a.attrelid = fk.child AND a.attnum = k.attnum;
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord) INTO _pcols
      FROM unnest(fk.confkey) WITH ORDINALITY k(attnum, ord) JOIN pg_attribute a ON a.attrelid = _tbl AND a.attnum = k.attnum;
    _cond := format('(%s) IN (SELECT %s FROM %s WHERE %s)', _cols, _pcols, _tbl, _pred);
    IF fk.child = _tbl OR fk.child = ANY (_path) THEN
      -- a loop back to a table already being cleared: detach where possible, otherwise remove only the directly linked rows
      IF _nullable THEN
        EXECUTE format('UPDATE %s SET %s WHERE %s', fk.child, (SELECT string_agg(c || ' = NULL', ', ') FROM unnest(string_to_array(_cols, ', ')) c), _cond);
      ELSE
        EXECUTE format('DELETE FROM %s WHERE %s', fk.child, _cond);
        GET DIAGNOSTICS _n = ROW_COUNT;
        IF _n > 0 THEN INSERT INTO pg_temp.purge_counts VALUES (fk.child::text, _n) ON CONFLICT (tbl) DO UPDATE SET n = purge_counts.n + EXCLUDED.n; END IF;
      END IF;
    ELSIF _nullable AND (SELECT confdeltype FROM pg_constraint c WHERE c.contype = 'f' AND c.conrelid = fk.child AND c.confrelid = _tbl AND c.conkey = fk.conkey LIMIT 1) IN ('n', 'd') THEN
      EXECUTE format('UPDATE %s SET %s WHERE %s', fk.child, (SELECT string_agg(c || ' = NULL', ', ') FROM unnest(string_to_array(_cols, ', ')) c), _cond);
    ELSE
      PERFORM private.purge_cascade(fk.child, _cond, _path || _tbl);
    END IF;
  END LOOP;
  EXECUTE format('SELECT count(*) FROM %s WHERE %s', _tbl, _pred) INTO _n;
  IF _n > 0 THEN
    IF regexp_replace(_tbl::text, '^public\.', '') = ANY (_protected) THEN RAISE EXCEPTION 'Reset stopped: it would remove % row(s) of %, which is core set-up data', _n, _tbl; END IF;
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = _tbl AND attname = 'id' AND atttypid = 'uuid'::regtype AND NOT attisdropped) THEN
      EXECUTE format('INSERT INTO pg_temp.purge_ids SELECT id::text FROM %s WHERE %s ON CONFLICT DO NOTHING', _tbl, _pred);
    END IF;
    EXECUTE format('DELETE FROM %s WHERE %s', _tbl, _pred);
    INSERT INTO pg_temp.purge_counts VALUES (_tbl::text, _n) ON CONFLICT (tbl) DO UPDATE SET n = purge_counts.n + EXCLUDED.n;
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.purge_cascade(regclass, text, regclass[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reset_test_data(_dry_run boolean DEFAULT true, _include_staff boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE _iids uuid[]; _uids uuid[]; _staff uuid[]; _res jsonb; _msg text; r record; _n bigint;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only the Super Admin can reset test data' USING ERRCODE = '42501'; END IF;
  CREATE TEMP TABLE IF NOT EXISTS purge_counts (tbl text PRIMARY KEY, n bigint NOT NULL);
  DELETE FROM purge_counts;
  CREATE TEMP TABLE IF NOT EXISTS purge_ids (id text PRIMARY KEY);
  DELETE FROM purge_ids;
  BEGIN
    -- SET LOCAL, not set_config(): the hosted database allows the statement but refuses the function
    EXECUTE 'SET LOCAL session_replication_role = replica';
    SELECT coalesce(array_agg(id), '{}') INTO _iids FROM public.trainee_identities WHERE is_test;
    -- logins of test trainees, unless the login also belongs to a real person or holds a staff role
    SELECT coalesce(array_agg(DISTINCT t.user_id), '{}') INTO _uids FROM public.trainees t
     WHERE t.identity_id = ANY (_iids) AND t.user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.trainees o WHERE o.user_id = t.user_id AND NOT (o.identity_id = ANY (_iids)))
       AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = t.user_id AND ur.role::text NOT IN ('trainee', 'applicant'));
    IF _include_staff THEN
      SELECT coalesce(array_agg(u.id), '{}') INTO _staff FROM auth.users u
       WHERE u.email ILIKE '%@vms-test.example' AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role::text IN ('super_admin', 'platform_admin'));
      _uids := ARRAY(SELECT DISTINCT unnest(_uids || _staff));
    END IF;

    DELETE FROM public.outbound_messages WHERE recipient ILIKE '%@vms-test.example'
       OR recipient IN (SELECT email FROM auth.users WHERE id = ANY (_uids));
    GET DIAGNOSTICS _n = ROW_COUNT;
    IF _n > 0 THEN INSERT INTO purge_counts VALUES ('outbound_messages', _n); END IF;

    IF cardinality(_iids) > 0 THEN
      PERFORM private.purge_cascade('public.trainee_identities'::regclass, format('is_test'), '{}');
    END IF;
    IF cardinality(_uids) > 0 THEN
      -- rows that point at the login without a foreign key
      FOR r IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
                WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND c.data_type = 'uuid'
                  AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.contype = 'f' AND k.conrelid = ('public.' || quote_ident(c.table_name))::regclass AND k.confrelid = 'auth.users'::regclass
                                   AND k.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = ('public.' || quote_ident(c.table_name))::regclass AND attname = 'user_id')]) LOOP
        EXECUTE format('DELETE FROM public.%I WHERE user_id = ANY ($1)', r.table_name) USING _uids;
        GET DIAGNOSTICS _n = ROW_COUNT;
        IF _n > 0 THEN INSERT INTO purge_counts VALUES (r.table_name, _n) ON CONFLICT (tbl) DO UPDATE SET n = purge_counts.n + EXCLUDED.n; END IF;
      END LOOP;
      PERFORM private.queue_test_files(_uids);
      PERFORM private.purge_cascade('auth.users'::regclass, format('id = ANY (%L::uuid[])', _uids::text), '{}');
    END IF;

    -- log entries that only name a removed record or login (no foreign key): audit, activity and history rows
    FOR r IN SELECT c.table_name, c.column_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
              WHERE c.table_schema = 'public' AND c.column_name IN ('entity_id', 'record_id', 'subject_id') AND c.data_type IN ('uuid', 'text', 'character varying') LOOP
      EXECUTE format('DELETE FROM public.%I WHERE %I::text IN (SELECT id FROM purge_ids)', r.table_name, r.column_name);
      GET DIAGNOSTICS _n = ROW_COUNT;
      IF _n > 0 THEN INSERT INTO purge_counts VALUES (r.table_name || ' (log entries)', _n) ON CONFLICT (tbl) DO UPDATE SET n = purge_counts.n + EXCLUDED.n; END IF;
    END LOOP;
    IF cardinality(_uids) > 0 THEN
      FOR r IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
                WHERE c.table_schema = 'public' AND c.column_name = 'actor_id' AND c.data_type = 'uuid' LOOP
        EXECUTE format('DELETE FROM public.%I WHERE actor_id = ANY ($1)', r.table_name) USING _uids;
        GET DIAGNOSTICS _n = ROW_COUNT;
        IF _n > 0 THEN INSERT INTO purge_counts VALUES (r.table_name || ' (actions by test logins)', _n) ON CONFLICT (tbl) DO UPDATE SET n = purge_counts.n + EXCLUDED.n; END IF;
      END LOOP;
    END IF;
    SELECT count(*) INTO _n FROM public.test_storage_queue;

    SELECT coalesce(jsonb_object_agg(tbl, n ORDER BY tbl), '{}') INTO _res FROM purge_counts;
    _res := jsonb_build_object('dry_run', _dry_run, 'identities', cardinality(_iids), 'logins', cardinality(_uids), 'files_queued', _n, 'rows', _res);
    IF _dry_run THEN RAISE EXCEPTION 'DRY:%', _res::text USING ERRCODE = 'P0099'; END IF;
    INSERT INTO public.test_data_purges (run_by, include_staff, counts) VALUES (auth.uid(), _include_staff, _res);
    EXECUTE 'SET LOCAL session_replication_role = origin';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN
    GET STACKED DIAGNOSTICS _msg = MESSAGE_TEXT;
    _res := substr(_msg, 5)::jsonb;
  END;
  EXECUTE 'SET LOCAL session_replication_role = origin';
  RETURN _res;
END $$;

REVOKE ALL ON FUNCTION public.mark_test_identities(text[], boolean), public.list_test_identities(), public.reset_test_data(boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_test_identities(text[], boolean), public.list_test_identities(), public.reset_test_data(boolean, boolean) TO authenticated, service_role;
