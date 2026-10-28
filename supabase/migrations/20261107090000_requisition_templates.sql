-- Requisition template manager (phase 3 of docs/requisition-and-org-structure-plan.md).
-- The template owns the fields, item-table columns, labels, instructions and mandatory documents of the
-- requisition form. The approval stages and their decisions are fixed by the workflow definition and are never
-- part of a template. A requisition is pinned to the template it was created on; publishing a new version
-- never changes an earlier requisition.
-- The Procurement Officer proposes a version, the Head of Finance and Administration (the Centre Manager at a
-- centre that has none) confirms it, and never the person who proposed it.

-- ---------------------------------------------------------------------------
-- 1. Tables and columns
-- ---------------------------------------------------------------------------
CREATE TABLE public.requisition_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_confirmation', 'published', 'superseded', 'rejected')),
  definition jsonb NOT NULL,
  change_note text,
  proposed_by uuid, proposed_at timestamptz,
  decided_by uuid, decided_at timestamptz, decision_note text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, version)
);
-- at most one proposal in progress per centre
CREATE UNIQUE INDEX uq_requisition_template_open ON public.requisition_templates (organization_id) WHERE status IN ('draft', 'pending_confirmation');
CREATE UNIQUE INDEX uq_requisition_template_published ON public.requisition_templates (organization_id) WHERE status = 'published';

CREATE TABLE public.requisition_template_events (
  id bigserial PRIMARY KEY,
  template_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  event text NOT NULL,
  note text,
  actor uuid, actor_name text, actor_role text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_req_tpl_events ON public.requisition_template_events (template_id, at);
CREATE TRIGGER trg_requisition_template_events_append_only BEFORE UPDATE OR DELETE ON public.requisition_template_events FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();

CREATE OR REPLACE FUNCTION public.requisition_template_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'A template that was submitted is kept for the record' USING ERRCODE = '42501'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (NEW.definition IS DISTINCT FROM OLD.definition OR NEW.version IS DISTINCT FROM OLD.version OR NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
    RAISE EXCEPTION 'A submitted template can never be edited; propose a new version' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_requisition_template_guard BEFORE UPDATE OR DELETE ON public.requisition_templates FOR EACH ROW EXECUTE FUNCTION public.requisition_template_guard();

ALTER TABLE public.requisition_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisition_template_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Template managers read templates" ON public.requisition_templates FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['procurement_officer', 'head_of_finance_admin', 'centre_manager']));
CREATE POLICY "Template managers read template history" ON public.requisition_template_events FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['procurement_officer', 'head_of_finance_admin', 'centre_manager']));
CREATE POLICY "Centre isolation" ON public.requisition_templates AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
CREATE POLICY "Centre isolation" ON public.requisition_template_events AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.requisition_templates, public.requisition_template_events FROM anon, authenticated;

ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.requisition_templates(id),
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.purchase_requisition_items ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.requisition_snapshots ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.requisition_documents'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%kind%' LOOP
    EXECUTE format('ALTER TABLE public.requisition_documents DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.requisition_documents ADD CONSTRAINT requisition_documents_kind_check CHECK (kind IN ('quotation', 'order', 'delivery', 'other', 'request'));
ALTER TABLE public.requisition_documents ADD COLUMN IF NOT EXISTS doc_key text;

-- ---------------------------------------------------------------------------
-- 2. Template rules
-- ---------------------------------------------------------------------------
-- The built-in form (version 1): what every centre starts with and what a requisition falls back to.
CREATE OR REPLACE FUNCTION private.requisition_default_template() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'instructions', '',
    'labels', jsonb_build_object('purpose', 'Purpose / justification', 'department', 'Department', 'quantity', 'Quantity', 'description', 'Description', 'specifications', 'Specifications'),
    'fields', '[]'::jsonb, 'columns', '[]'::jsonb, 'documents', '[]'::jsonb);
$$;

-- Checks a proposed definition and returns it in its normal form. Purpose, department, quantity and description
-- are fixed by the system: a template can rename them but never remove them or make them optional, and the
-- approval stages are not part of a template at all.
CREATE OR REPLACE FUNCTION private.requisition_validate_template(_def jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _labels jsonb := private.requisition_default_template() -> 'labels'; k text; v text; _out_fields jsonb := '[]'::jsonb; _out_cols jsonb := '[]'::jsonb; _out_docs jsonb := '[]'::jsonb;
        f jsonb; _seen text[] := ARRAY[]::text[]; _opts jsonb; o text; _oseen text[]; _type text; _reserved text[] := ARRAY['purpose', 'department', 'quantity', 'description', 'specifications', 'no', 'status', 'round'];
        _kind text; _list jsonb; _max integer; _types text[];
BEGIN
  IF _def IS NULL OR jsonb_typeof(_def) <> 'object' THEN RAISE EXCEPTION 'The template is not in the expected form'; END IF;
  FOR k IN SELECT jsonb_object_keys(_def) LOOP
    IF k NOT IN ('instructions', 'labels', 'fields', 'columns', 'documents') THEN RAISE EXCEPTION 'The template cannot contain "%"; approval stages are fixed by the workflow', k; END IF;
  END LOOP;
  IF length(coalesce(_def ->> 'instructions', '')) > 2000 THEN RAISE EXCEPTION 'The instructions are too long (at most 2000 characters)'; END IF;
  IF _def ? 'labels' THEN
    IF jsonb_typeof(_def -> 'labels') <> 'object' THEN RAISE EXCEPTION 'The labels are not in the expected form'; END IF;
    FOR k IN SELECT jsonb_object_keys(_def -> 'labels') LOOP
      IF NOT (_labels ? k) THEN RAISE EXCEPTION 'Unknown label "%"', k; END IF;
      v := trim(coalesce(_def -> 'labels' ->> k, ''));
      IF v = '' OR length(v) > 60 THEN RAISE EXCEPTION 'The label for % must be 1 to 60 characters', k; END IF;
      _labels := _labels || jsonb_build_object(k, v);
    END LOOP;
  END IF;

  FOREACH _kind IN ARRAY ARRAY['fields', 'columns'] LOOP
    _list := coalesce(_def -> _kind, '[]'::jsonb);
    IF jsonb_typeof(_list) <> 'array' THEN RAISE EXCEPTION 'The % are not in the expected form', _kind; END IF;
    _max := CASE _kind WHEN 'fields' THEN 12 ELSE 6 END;
    IF jsonb_array_length(_list) > _max THEN RAISE EXCEPTION 'A template can have at most % extra %', _max, _kind; END IF;
    _types := CASE _kind WHEN 'fields' THEN ARRAY['text', 'textarea', 'number', 'date', 'select'] ELSE ARRAY['text', 'number', 'date', 'select'] END;
    _seen := ARRAY[]::text[];
    FOR f IN SELECT * FROM jsonb_array_elements(_list) LOOP
      IF jsonb_typeof(f) <> 'object' THEN RAISE EXCEPTION 'An entry in the % is not in the expected form', _kind; END IF;
      k := coalesce(f ->> 'key', '');
      IF k !~ '^[a-z][a-z0-9_]{1,29}$' THEN RAISE EXCEPTION 'The key "%" must start with a letter and use only lower-case letters, digits and underscores', k; END IF;
      IF k = ANY (_reserved) THEN RAISE EXCEPTION 'The key "%" is used by the system', k; END IF;
      IF k = ANY (_seen) THEN RAISE EXCEPTION 'The key "%" is used twice', k; END IF;
      _seen := _seen || k;
      v := trim(coalesce(f ->> 'label', ''));
      IF v = '' OR length(v) > 80 THEN RAISE EXCEPTION 'Every entry needs a label of up to 80 characters (%)', k; END IF;
      _type := coalesce(f ->> 'type', 'text');
      IF NOT (_type = ANY (_types)) THEN RAISE EXCEPTION 'The type "%" is not available for % (%)', _type, _kind, k; END IF;
      IF coalesce(f ->> 'required', 'false') NOT IN ('true', 'false') THEN RAISE EXCEPTION 'Required must be yes or no (%)', k; END IF;
      IF length(coalesce(f ->> 'help', '')) > 200 THEN RAISE EXCEPTION 'The help text for % is too long (at most 200 characters)', k; END IF;
      _opts := '[]'::jsonb;
      IF _type = 'select' THEN
        IF jsonb_typeof(coalesce(f -> 'options', 'null'::jsonb)) <> 'array' OR jsonb_array_length(f -> 'options') NOT BETWEEN 2 AND 20 THEN RAISE EXCEPTION 'Give 2 to 20 options for the choice list "%"', k; END IF;
        _oseen := ARRAY[]::text[];
        FOR o IN SELECT jsonb_array_elements_text(f -> 'options') LOOP
          o := trim(o);
          IF o = '' OR length(o) > 60 THEN RAISE EXCEPTION 'Each option of "%" must be 1 to 60 characters', k; END IF;
          IF o = ANY (_oseen) THEN RAISE EXCEPTION 'The option "%" is listed twice in "%"', o, k; END IF;
          _oseen := _oseen || o; _opts := _opts || to_jsonb(o);
        END LOOP;
      ELSIF f ? 'options' AND jsonb_typeof(f -> 'options') = 'array' AND jsonb_array_length(f -> 'options') > 0 THEN
        RAISE EXCEPTION 'Only choice lists have options (%)', k;
      END IF;
      f := jsonb_build_object('key', k, 'label', v, 'type', _type, 'required', coalesce((f ->> 'required')::boolean, false), 'help', trim(coalesce(f ->> 'help', '')), 'options', _opts);
      IF _kind = 'fields' THEN _out_fields := _out_fields || f; ELSE _out_cols := _out_cols || f; END IF;
    END LOOP;
  END LOOP;

  _list := coalesce(_def -> 'documents', '[]'::jsonb);
  IF jsonb_typeof(_list) <> 'array' THEN RAISE EXCEPTION 'The documents are not in the expected form'; END IF;
  IF jsonb_array_length(_list) > 8 THEN RAISE EXCEPTION 'A template can list at most 8 documents'; END IF;
  _seen := ARRAY[]::text[];
  FOR f IN SELECT * FROM jsonb_array_elements(_list) LOOP
    IF jsonb_typeof(f) <> 'object' THEN RAISE EXCEPTION 'A document entry is not in the expected form'; END IF;
    k := coalesce(f ->> 'key', '');
    IF k !~ '^[a-z][a-z0-9_]{1,29}$' THEN RAISE EXCEPTION 'The document key "%" must start with a letter and use only lower-case letters, digits and underscores', k; END IF;
    IF k = ANY (_seen) THEN RAISE EXCEPTION 'The document key "%" is used twice', k; END IF;
    _seen := _seen || k;
    v := trim(coalesce(f ->> 'label', ''));
    IF v = '' OR length(v) > 80 THEN RAISE EXCEPTION 'Every document needs a name of up to 80 characters (%)', k; END IF;
    IF coalesce(f ->> 'required', 'false') NOT IN ('true', 'false') THEN RAISE EXCEPTION 'Required must be yes or no (%)', k; END IF;
    _out_docs := _out_docs || jsonb_build_object('key', k, 'label', v, 'required', coalesce((f ->> 'required')::boolean, false));
  END LOOP;

  RETURN jsonb_build_object('instructions', trim(coalesce(_def ->> 'instructions', '')), 'labels', _labels, 'fields', _out_fields, 'columns', _out_cols, 'documents', _out_docs);
END $$;

-- the template a new requisition is created on: the centre's published version, else the built-in form (version 1)
CREATE OR REPLACE FUNCTION private.requisition_template_row(_org uuid) RETURNS TABLE (id uuid, version integer, definition jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.version, t.definition FROM public.requisition_templates t WHERE t.organization_id = _org AND t.status = 'published'
  UNION ALL
  SELECT NULL::uuid, 1, private.requisition_default_template()
  WHERE NOT EXISTS (SELECT 1 FROM public.requisition_templates t WHERE t.organization_id = _org AND t.status = 'published')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.requisition_template_def(_tid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT t.definition FROM public.requisition_templates t WHERE t.id = _tid), private.requisition_default_template());
$$;

-- keeps only the values the pinned template defines, checked against their type
CREATE OR REPLACE FUNCTION private.requisition_clean_values(_def jsonb, _vals jsonb, _kind text) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE _specs jsonb := coalesce(_def -> _kind, '[]'::jsonb); _out jsonb := '{}'::jsonb; k text; v text; s jsonb;
BEGIN
  IF _vals IS NULL OR jsonb_typeof(_vals) <> 'object' THEN RETURN '{}'::jsonb; END IF;
  FOR k IN SELECT jsonb_object_keys(_vals) LOOP
    SELECT e INTO s FROM jsonb_array_elements(_specs) e WHERE e ->> 'key' = k;
    IF s IS NULL THEN RAISE EXCEPTION 'The form has no field "%"; reload it and try again', k; END IF;
    v := trim(coalesce(_vals ->> k, ''));
    IF v = '' THEN CONTINUE; END IF;
    CASE s ->> 'type'
      WHEN 'number' THEN IF v !~ '^-?[0-9]{1,15}(\.[0-9]{1,6})?$' THEN RAISE EXCEPTION '"%" must be a number', s ->> 'label'; END IF;
      WHEN 'date' THEN
        BEGIN PERFORM v::date; EXCEPTION WHEN others THEN RAISE EXCEPTION '"%" must be a date', s ->> 'label'; END;
        IF v !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION '"%" must be a date', s ->> 'label'; END IF;
      WHEN 'select' THEN IF NOT (s -> 'options') @> to_jsonb(v) THEN RAISE EXCEPTION 'Choose one of the listed options for "%"', s ->> 'label'; END IF;
      WHEN 'textarea' THEN IF length(v) > 2000 THEN RAISE EXCEPTION '"%" is too long (at most 2000 characters)', s ->> 'label'; END IF;
      ELSE IF length(v) > 200 THEN RAISE EXCEPTION '"%" is too long (at most 200 characters)', s ->> 'label'; END IF;
    END CASE;
    _out := _out || jsonb_build_object(k, v);
  END LOOP;
  RETURN _out;
END $$;

-- what the template makes mandatory, checked when the requester submits
CREATE OR REPLACE FUNCTION private.requisition_check_required(_def jsonb, _req uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; s jsonb; i record;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _req;
  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(_def -> 'fields', '[]'::jsonb)) WHERE (value ->> 'required')::boolean LOOP
    IF coalesce(r.custom_fields ->> (s ->> 'key'), '') = '' THEN RAISE EXCEPTION 'Complete "%" before submitting', s ->> 'label'; END IF;
  END LOOP;
  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(_def -> 'columns', '[]'::jsonb)) WHERE (value ->> 'required')::boolean LOOP
    FOR i IN SELECT line_no, extra FROM public.purchase_requisition_items WHERE requisition_id = _req LOOP
      IF coalesce(i.extra ->> (s ->> 'key'), '') = '' THEN RAISE EXCEPTION 'Item %: complete "%" before submitting', i.line_no, s ->> 'label'; END IF;
    END LOOP;
  END LOOP;
  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(_def -> 'documents', '[]'::jsonb)) WHERE (value ->> 'required')::boolean LOOP
    IF NOT EXISTS (SELECT 1 FROM public.requisition_documents d WHERE d.requisition_id = _req AND d.kind = 'request' AND d.doc_key = s ->> 'key') THEN
      RAISE EXCEPTION 'Attach the required document "%" before submitting', s ->> 'label';
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.requisition_default_template(), private.requisition_validate_template(jsonb), private.requisition_template_row(uuid), private.requisition_template_def(uuid),
  private.requisition_clean_values(jsonb, jsonb, text), private.requisition_check_required(jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Managing templates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.requisition_template_log(_tid uuid, _org uuid, _event text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p jsonb := private.requisition_person(_org, auth.uid());
BEGIN
  INSERT INTO public.requisition_template_events (template_id, organization_id, event, note, actor, actor_name, actor_role)
    VALUES (_tid, _org, _event, nullif(trim(coalesce(_note, '')), ''), auth.uid(), _p ->> 'name', _p ->> 'role');
END $$;
REVOKE ALL ON FUNCTION private.requisition_template_log(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- the person who confirms: the Head of Finance and Administration, or the Centre Manager where the centre has none
CREATE OR REPLACE FUNCTION private.requisition_template_confirmer(_user uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user, _org, ARRAY['head_of_finance_admin'])
      OR (public.has_org_role(_user, _org, ARRAY['centre_manager']) AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.organization_id = _org AND ur.role::text = 'head_of_finance_admin'));
$$;
REVOKE ALL ON FUNCTION private.requisition_template_confirmer(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- the form a staff member fills in (the published version, or a requisition's own pinned version)
CREATE OR REPLACE FUNCTION public.requisition_template_current(_org uuid, _requisition uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; r public.purchase_requisitions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant')) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF _requisition IS NOT NULL THEN
    SELECT * INTO r FROM public.purchase_requisitions WHERE id = _requisition AND organization_id = _org;
    IF NOT FOUND OR NOT public.requisition_can_view(auth.uid(), _requisition) THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object('template_id', r.template_id, 'version', r.template_version, 'definition', private.requisition_template_def(r.template_id), 'pinned', true);
  END IF;
  SELECT * INTO t FROM private.requisition_template_row(_org);
  RETURN jsonb_build_object('template_id', t.id, 'version', t.version, 'definition', t.definition, 'pinned', false);
END $$;

CREATE OR REPLACE FUNCTION public.requisition_template_overview(_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _open record; _cur record; _po boolean; _conf boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['procurement_officer', 'head_of_finance_admin', 'centre_manager']) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  _po := public.has_org_role(auth.uid(), _org, ARRAY['procurement_officer']);
  _conf := private.requisition_template_confirmer(auth.uid(), _org);
  SELECT * INTO _cur FROM private.requisition_template_row(_org);
  SELECT * INTO _open FROM public.requisition_templates WHERE organization_id = _org AND status IN ('draft', 'pending_confirmation');
  RETURN jsonb_build_object(
    'current', jsonb_build_object('template_id', _cur.id, 'version', _cur.version, 'definition', _cur.definition),
    'default', private.requisition_default_template(),
    'open', CASE WHEN _open.id IS NULL THEN NULL ELSE jsonb_build_object('id', _open.id, 'version', _open.version, 'status', _open.status, 'definition', _open.definition, 'change_note', _open.change_note,
              'proposed_by', (private.requisition_person(_org, _open.proposed_by) ->> 'name'), 'proposed_at', _open.proposed_at,
              'proposed_by_me', _open.proposed_by = auth.uid()) END,
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'version', t.version, 'status', t.status, 'change_note', t.change_note, 'decision_note', t.decision_note,
                 'proposed_by', private.requisition_person(_org, t.proposed_by) ->> 'name', 'decided_by', private.requisition_person(_org, t.decided_by) ->> 'name',
                 'published_at', t.published_at, 'decided_at', t.decided_at, 'proposed_at', t.proposed_at,
                 'used_by', (SELECT count(*) FROM public.purchase_requisitions pr WHERE pr.template_id = t.id), 'definition', t.definition) ORDER BY t.version DESC)
                 FROM public.requisition_templates t WHERE t.organization_id = _org AND t.status <> 'draft'), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event, 'note', e.note, 'by', e.actor_name, 'role', e.actor_role, 'at', e.at, 'template_id', e.template_id) ORDER BY e.at DESC)
                 FROM (SELECT * FROM public.requisition_template_events WHERE organization_id = _org ORDER BY at DESC LIMIT 50) e), '[]'::jsonb),
    'can_edit', _po, 'can_confirm', _conf);
END $$;

CREATE OR REPLACE FUNCTION public.requisition_template_save_draft(_org uuid, _definition jsonb, _note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _def jsonb; _o public.requisition_templates%ROWTYPE; _id uuid; _v integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['procurement_officer']) THEN RAISE EXCEPTION 'Only the Procurement Officer prepares the requisition template' USING ERRCODE = '42501'; END IF;
  _def := private.requisition_validate_template(_definition);
  IF length(coalesce(_note, '')) > 1000 THEN RAISE EXCEPTION 'The note is too long'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('req_tpl:' || _org::text));
  SELECT * INTO _o FROM public.requisition_templates WHERE organization_id = _org AND status IN ('draft', 'pending_confirmation') FOR UPDATE;
  IF FOUND AND _o.status = 'pending_confirmation' THEN RAISE EXCEPTION 'A proposal is waiting for confirmation. Withdraw it before changing it.'; END IF;
  IF FOUND THEN
    UPDATE public.requisition_templates SET definition = _def, change_note = nullif(trim(coalesce(_note, '')), '') WHERE id = _o.id;
    RETURN _o.id;
  END IF;
  SELECT greatest(coalesce(max(version), 1) + 1, 2) INTO _v FROM public.requisition_templates WHERE organization_id = _org;
  INSERT INTO public.requisition_templates (organization_id, version, status, definition, change_note, proposed_by) VALUES (_org, _v, 'draft', _def, nullif(trim(coalesce(_note, '')), ''), auth.uid()) RETURNING id INTO _id;
  PERFORM private.requisition_template_log(_id, _org, 'drafted', 'Version ' || _v);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.requisition_template_submit(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.requisition_templates%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.requisition_templates WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), t.organization_id, ARRAY['procurement_officer']) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF t.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be sent for confirmation'; END IF;
  IF t.definition = (SELECT d.definition FROM private.requisition_template_row(t.organization_id) d) THEN RAISE EXCEPTION 'This is identical to the form in use; change something first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.organization_id = t.organization_id AND ur.role::text IN ('head_of_finance_admin', 'centre_manager')) THEN
    RAISE EXCEPTION 'There is nobody at this centre who can confirm a template yet (Head of Finance and Administration or Centre Manager)';
  END IF;
  UPDATE public.requisition_templates SET status = 'pending_confirmation', proposed_by = auth.uid(), proposed_at = now() WHERE id = _id;
  PERFORM private.requisition_template_log(_id, t.organization_id, 'submitted', 'Version ' || t.version || ' sent for confirmation');
END $$;

CREATE OR REPLACE FUNCTION public.requisition_template_withdraw(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.requisition_templates%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.requisition_templates WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), t.organization_id, ARRAY['procurement_officer']) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF t.status <> 'pending_confirmation' THEN RAISE EXCEPTION 'Only a proposal waiting for confirmation can be withdrawn'; END IF;
  UPDATE public.requisition_templates SET status = 'draft' WHERE id = _id;
  PERFORM private.requisition_template_log(_id, t.organization_id, 'withdrawn', NULL);
END $$;

CREATE OR REPLACE FUNCTION public.requisition_template_decide(_id uuid, _approve boolean, _note text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.requisition_templates%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.requisition_templates WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT private.requisition_template_confirmer(auth.uid(), t.organization_id) THEN RAISE EXCEPTION 'Only the Head of Finance and Administration confirms a requisition template' USING ERRCODE = '42501'; END IF;
  IF t.status <> 'pending_confirmation' THEN RAISE EXCEPTION 'This proposal is not waiting for confirmation'; END IF;
  IF t.proposed_by = auth.uid() THEN RAISE EXCEPTION 'You proposed this template, so someone else must confirm it' USING ERRCODE = '42501'; END IF;
  IF NOT _approve AND length(trim(coalesce(_note, ''))) < 5 THEN RAISE EXCEPTION 'Give the reason for rejecting the proposal'; END IF;
  IF _approve THEN
    UPDATE public.requisition_templates SET status = 'superseded' WHERE organization_id = t.organization_id AND status = 'published';
    UPDATE public.requisition_templates SET status = 'published', decided_by = auth.uid(), decided_at = now(), published_at = now(), decision_note = nullif(trim(coalesce(_note, '')), '') WHERE id = _id;
    PERFORM private.requisition_template_log(_id, t.organization_id, 'published', 'Version ' || t.version || ' confirmed' || CASE WHEN coalesce(trim(_note), '') <> '' THEN ': ' || trim(_note) ELSE '' END);
  ELSE
    UPDATE public.requisition_templates SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = trim(_note) WHERE id = _id;
    PERFORM private.requisition_template_log(_id, t.organization_id, 'rejected', trim(_note));
  END IF;
  RETURN t.version;
END $$;

-- documents the template asks the requester to attach (kept separate from the procurement documents)
CREATE OR REPLACE FUNCTION public.requisition_attach_request_document(_id uuid, _doc_key text, _path text, _name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id;
  IF NOT FOUND OR r.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  IF r.status NOT IN ('draft', 'returned_for_correction') THEN RAISE EXCEPTION 'Documents can be attached while the requisition is a draft or returned for correction'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(private.requisition_template_def(r.template_id) -> 'documents') d WHERE d ->> 'key' = _doc_key) THEN RAISE EXCEPTION 'The form does not ask for this document'; END IF;
  IF _path NOT LIKE r.organization_id::text || '/requisitions/' || _id::text || '/%' OR position('..' IN _path) > 0 THEN RAISE EXCEPTION 'Upload the document from the requisition page'; END IF;
  IF (SELECT count(*) FROM public.requisition_documents WHERE requisition_id = _id AND kind = 'request') >= 30 THEN RAISE EXCEPTION 'At most 30 documents can be attached'; END IF;
  INSERT INTO public.requisition_documents (requisition_id, kind, doc_key, file_path, file_name, uploaded_by) VALUES (_id, 'request', _doc_key, _path, left(coalesce(_name, 'document'), 200), auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.requisition_remove_request_document(_doc uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.requisition_documents%ROWTYPE; r public.purchase_requisitions%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.requisition_documents WHERE id = _doc AND kind = 'request';
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = d.requisition_id;
  IF r.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Document not found' USING ERRCODE = '42501'; END IF;
  IF r.status NOT IN ('draft', 'returned_for_correction') THEN RAISE EXCEPTION 'Documents can only be removed while the requisition is a draft or returned for correction'; END IF;
  DELETE FROM public.requisition_documents WHERE id = _doc;
END $$;

REVOKE ALL ON FUNCTION public.requisition_template_current(uuid, uuid), public.requisition_template_overview(uuid), public.requisition_template_save_draft(uuid, jsonb, text),
  public.requisition_template_submit(uuid), public.requisition_template_withdraw(uuid), public.requisition_template_decide(uuid, boolean, text),
  public.requisition_attach_request_document(uuid, text, text, text), public.requisition_remove_request_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_template_current(uuid, uuid), public.requisition_template_overview(uuid), public.requisition_template_save_draft(uuid, jsonb, text),
  public.requisition_template_submit(uuid), public.requisition_template_withdraw(uuid), public.requisition_template_decide(uuid, boolean, text),
  public.requisition_attach_request_document(uuid, text, text, text), public.requisition_remove_request_document(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. The requisition form uses its pinned template
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.requisition_save_draft(uuid, uuid, text, text, jsonb);
CREATE OR REPLACE FUNCTION public.requisition_save_draft(_id uuid, _org uuid, _purpose text, _department text, _items jsonb, _fields jsonb DEFAULT '{}'::jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; _req uuid; it jsonb; n integer := 0; _tpl record; _def jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'Add the items you need'; END IF;
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'A requisition can list at most 100 items'; END IF;
  IF length(coalesce(_purpose, '')) > 4000 OR length(coalesce(_department, '')) > 120 THEN RAISE EXCEPTION 'The purpose or department is too long'; END IF;
  IF _id IS NULL THEN
    IF _org IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = _org AND ur.role::text NOT IN ('trainee', 'applicant')) THEN
      RAISE EXCEPTION 'Only staff can make a requisition' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO _tpl FROM private.requisition_template_row(_org);
    _def := _tpl.definition;
    PERFORM set_config('app.requisition_fn', 'on', true);
    INSERT INTO public.purchase_requisitions (organization_id, requisition_number, requested_by, department, justification, status, requester_role, template_id, template_version, custom_fields)
      VALUES (_org, 'DRAFT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), auth.uid(), nullif(trim(_department), ''), nullif(trim(_purpose), ''), 'draft',
              private.requisition_person(_org, auth.uid()) ->> 'role', _tpl.id, _tpl.version, private.requisition_clean_values(_def, _fields, 'fields'))
      RETURNING id INTO _req;
    PERFORM set_config('app.requisition_fn', 'off', true);
    INSERT INTO public.requisition_status_history (requisition_id, from_status, to_status, reason, changed_by) VALUES (_req, NULL, 'draft', 'Draft created', auth.uid());
  ELSE
    SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id FOR UPDATE;
    IF NOT FOUND OR r.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
    IF r.status NOT IN ('draft', 'returned_for_correction') THEN RAISE EXCEPTION 'This requisition can no longer be edited'; END IF;
    _def := private.requisition_template_def(r.template_id);
    UPDATE public.purchase_requisitions SET department = nullif(trim(_department), ''), justification = nullif(trim(_purpose), ''), custom_fields = private.requisition_clean_values(_def, _fields, 'fields'), updated_at = now() WHERE id = _id;
    DELETE FROM public.purchase_requisition_items WHERE requisition_id = _id;
    _req := _id;
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    n := n + 1;
    IF coalesce(trim(it ->> 'description'), '') = '' OR length(it ->> 'description') > 500 THEN RAISE EXCEPTION 'Item %: describe what you need (up to 500 characters)', n; END IF;
    IF coalesce((it ->> 'quantity') ~ '^[0-9]+$', false) = false OR (it ->> 'quantity')::bigint NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Item %: the quantity must be a whole number of at least 1', n; END IF;
    IF length(coalesce(it ->> 'specifications', '')) > 2000 THEN RAISE EXCEPTION 'Item %: the specifications are too long', n; END IF;
    INSERT INTO public.purchase_requisition_items (requisition_id, line_no, item_description, quantity, specifications, estimated_unit_cost, extra)
      VALUES (_req, n, trim(it ->> 'description'), (it ->> 'quantity')::integer, nullif(trim(coalesce(it ->> 'specifications', '')), ''), 0, private.requisition_clean_values(_def, it -> 'extra', 'columns'));
  END LOOP;
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.requisition_submit(_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; _sup uuid[]; _inst uuid; _num text; _old uuid; _names text; _items jsonb; _me jsonb; _def jsonb;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR r.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  IF r.status NOT IN ('draft', 'returned_for_correction') THEN RAISE EXCEPTION 'This requisition has already been submitted'; END IF;
  IF coalesce(trim(r.justification), '') = '' THEN RAISE EXCEPTION 'State the purpose of the requisition before submitting'; END IF;
  IF coalesce(trim(r.department), '') = '' THEN RAISE EXCEPTION 'Enter your department before submitting'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('no', line_no, 'quantity', quantity, 'description', item_description, 'specifications', specifications, 'extra', extra) ORDER BY line_no), '[]'::jsonb)
    INTO _items FROM public.purchase_requisition_items WHERE requisition_id = _id;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'List at least one item before submitting'; END IF;

  _def := private.requisition_template_def(r.template_id);
  PERFORM private.requisition_check_required(_def, _id);

  _sup := array_remove(public.workflow_supervisor_level(r.organization_id, auth.uid(), 1), auth.uid());
  _sup := ARRAY(SELECT u FROM unnest(_sup) u WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u AND (a.banned_until IS NULL OR a.banned_until < now())));
  IF cardinality(_sup) = 0 THEN
    RAISE EXCEPTION 'You do not have a line supervisor configured, so this requisition cannot enter the approval process. Ask your Organisational Admin to set your reporting line, then submit again.' USING ERRCODE = 'P0001';
  END IF;
  SELECT string_agg(private.requisition_person(r.organization_id, u) ->> 'name', ', ') INTO _names FROM unnest(_sup) u;

  _old := r.workflow_instance_id;
  IF _old IS NOT NULL AND EXISTS (SELECT 1 FROM public.workflow_instances WHERE id = _old AND status IN ('awaiting_info', 'in_progress')) THEN
    -- a corrected resubmission starts a new approval round; the earlier round and its decisions stay on record
    UPDATE public.workflow_tasks SET status = 'cancelled' WHERE instance_id = _old AND status IN ('pending', 'info_requested');
    UPDATE public.workflow_instances SET status = 'cancelled', completed_at = now(), outcome_comment = 'Superseded by the corrected resubmission', next_action = 'None: superseded' WHERE id = _old;
    PERFORM public.workflow_log(_old, NULL, 'superseded', auth.uid(), 'app', 'Corrected and resubmitted as a new round');
  END IF;

  _num := r.requisition_number;
  IF _num LIKE 'DRAFT-%' THEN _num := 'REQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.requisition_reference_seq')::text, 6, '0'); END IF;
  _me := private.requisition_person(r.organization_id, auth.uid());
  PERFORM set_config('app.requisition_fn', 'on', true);
  UPDATE public.purchase_requisitions SET requisition_number = _num, round = r.round + 1, submitted_at = now(), requester_role = _me ->> 'role', updated_at = now() WHERE id = _id;
  PERFORM set_config('app.requisition_fn', 'off', true);

  _inst := public.finance_new_request(r.organization_id, 'purchase_requisition', _num || ': ' || left(r.justification, 80),
    jsonb_build_object('Requisition', _num, 'Department', r.department, 'Purpose', left(r.justification, 300), 'Items', jsonb_array_length(_items)), NULL, _id);
  PERFORM set_config('app.requisition_fn', 'on', true);
  UPDATE public.purchase_requisitions SET workflow_instance_id = _inst WHERE id = _id;
  PERFORM set_config('app.requisition_fn', 'off', true);

  INSERT INTO public.requisition_snapshots (requisition_id, round, purpose, department, items, template_version, requester_name, requester_role, supervisor_names, fields)
    VALUES (_id, r.round + 1, r.justification, r.department, _items, r.template_version, _me ->> 'name', _me ->> 'role', _names, r.custom_fields);
  PERFORM private.requisition_set_status(_id, 'submitted', CASE WHEN r.round = 0 THEN 'Submitted' ELSE 'Resubmitted after correction' END);
  PERFORM public.workflow_submit(_inst);
  PERFORM private.requisition_set_status(_id, 'pending_line_supervisor', 'Sent to ' || _names);
  RETURN jsonb_build_object('requisition_id', _id, 'requisition_number', _num, 'round', r.round + 1, 'supervisor', _names);
END $$;

CREATE OR REPLACE FUNCTION public.requisition_view(_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; _stages jsonb := '[]'::jsonb; s record; _people jsonb; _dec record; _task record; _my_task uuid; _can_decide boolean := false;
        _inst public.workflow_instances%ROWTYPE;
BEGIN
  IF NOT public.requisition_can_view(auth.uid(), _id) THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id;
  IF r.workflow_instance_id IS NOT NULL THEN SELECT * INTO _inst FROM public.workflow_instances WHERE id = r.workflow_instance_id; END IF;

  FOR s IN SELECT n AS step_no FROM generate_series(1, 4) n LOOP
    SELECT * INTO _dec FROM public.requisition_decisions d WHERE d.requisition_id = _id AND d.round = r.round AND d.stage_no = s.step_no ORDER BY d.decided_at DESC LIMIT 1;
    SELECT t.id, t.status INTO _task FROM public.workflow_tasks t WHERE t.instance_id = r.workflow_instance_id AND t.step_no = s.step_no AND t.step_name NOT LIKE 'Higher-level approval%' ORDER BY t.created_at DESC LIMIT 1;
    IF _task.id IS NOT NULL AND _task.status = 'pending' THEN
      SELECT coalesce(jsonb_agg(private.requisition_person(r.organization_id, a.user_id)), '[]'::jsonb) INTO _people FROM public.workflow_task_assignees a WHERE a.task_id = _task.id;
      IF public.workflow_can_act(auth.uid(), _task.id) AND auth.uid() IS DISTINCT FROM r.requested_by THEN _can_decide := true; _my_task := _task.id; END IF;
    ELSIF _dec.id IS NOT NULL THEN
      _people := jsonb_build_array(jsonb_build_object('user_id', _dec.decided_by, 'name', _dec.decided_by_name, 'role', _dec.decided_by_role));
    ELSIF s.step_no = 1 THEN
      SELECT coalesce(jsonb_agg(private.requisition_person(r.organization_id, u)), '[]'::jsonb) INTO _people
        FROM unnest(array_remove(public.workflow_supervisor_level(r.organization_id, r.requested_by, 1), r.requested_by)) u;
    ELSE
      SELECT coalesce(jsonb_agg(private.requisition_person(r.organization_id, x.user_id)), '[]'::jsonb) INTO _people
        FROM (SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = r.organization_id
               AND role::text = CASE s.step_no WHEN 2 THEN 'accountant' WHEN 3 THEN 'head_of_finance_admin' ELSE 'centre_manager' END) x;
    END IF;
    _stages := _stages || jsonb_build_object(
      'stage_no', s.step_no, 'stage_key', public.requisition_stage_key(s.step_no),
      'state', CASE WHEN _dec.id IS NOT NULL AND _dec.decision <> 'return' THEN 'decided'
                    WHEN _dec.id IS NOT NULL AND _dec.decision = 'return' THEN 'returned'
                    WHEN _task.id IS NOT NULL AND _task.status = 'pending' THEN 'current' ELSE 'upcoming' END,
      'people', coalesce(_people, '[]'::jsonb),
      'decision', CASE WHEN _dec.id IS NULL THEN NULL ELSE jsonb_build_object('decision', _dec.decision, 'comments', _dec.comments, 'gl_code', _dec.gl_code, 'at', _dec.decided_at,
                   'by', _dec.decided_by_name, 'role', _dec.decided_by_role) END);
  END LOOP;

  RETURN jsonb_build_object(
    'id', r.id, 'organization_id', r.organization_id, 'requisition_number', r.requisition_number, 'status', r.status, 'round', r.round,
    'purpose', r.justification, 'department', r.department, 'template_version', r.template_version,
    'template', private.requisition_template_def(r.template_id), 'fields', r.custom_fields,
    'request_documents', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'doc_key', x.doc_key, 'file_path', x.file_path, 'file_name', x.file_name, 'at', x.uploaded_at) ORDER BY x.uploaded_at) FROM public.requisition_documents x WHERE x.requisition_id = r.id AND x.kind = 'request'), '[]'::jsonb),
    'submitted_at', r.submitted_at, 'created_at', r.created_at,
    'requester', private.requisition_person(r.organization_id, r.requested_by), 'is_requester', r.requested_by = auth.uid(),
    'next_action', _inst.next_action,
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('no', line_no, 'quantity', quantity, 'description', item_description, 'specifications', specifications, 'extra', extra) ORDER BY line_no)
                        FROM public.purchase_requisition_items WHERE requisition_id = r.id), '[]'::jsonb),
    'stages', _stages,
    'can_decide', _can_decide, 'task_id', _my_task,
    'can_edit', r.requested_by = auth.uid() AND r.status IN ('draft', 'returned_for_correction'),
    'can_reopen', r.requested_by = auth.uid() AND r.status IN ('not_recommended', 'funding_not_available'),
    'can_cancel', r.requested_by = auth.uid() AND r.status IN ('draft', 'returned_for_correction', 'pending_line_supervisor', 'pending_accountant', 'pending_head_finance', 'pending_centre_manager', 'not_recommended', 'funding_not_available', 'not_approved'),
    'decisions', coalesce((SELECT jsonb_agg(jsonb_build_object('round', d.round, 'stage_key', d.stage_key, 'stage_no', d.stage_no, 'decision', d.decision, 'gl_code', d.gl_code, 'comments', d.comments,
                   'by', d.decided_by_name, 'role', d.decided_by_role, 'at', d.decided_at) ORDER BY d.decided_at) FROM public.requisition_decisions d WHERE d.requisition_id = r.id), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('from', h.from_status, 'to', h.to_status, 'reason', h.reason, 'at', h.changed_at,
                   'by', (SELECT coalesce(nullif(trim(p.full_name), ''), p.email) FROM public.profiles p WHERE p.user_id = h.changed_by)) ORDER BY h.changed_at, h.id) FROM public.requisition_status_history h WHERE h.requisition_id = r.id), '[]'::jsonb),
    'rounds', coalesce((SELECT jsonb_agg(jsonb_build_object('round', sn.round, 'submitted_at', sn.submitted_at, 'purpose', sn.purpose, 'fields', sn.fields, 'items', sn.items, 'supervisor', sn.supervisor_names) ORDER BY sn.round)
                          FROM public.requisition_snapshots sn WHERE sn.requisition_id = r.id), '[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.requisition_save_draft(uuid, uuid, text, text, jsonb, jsonb), public.requisition_submit(uuid), public.requisition_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_save_draft(uuid, uuid, text, text, jsonb, jsonb), public.requisition_submit(uuid), public.requisition_view(uuid) TO authenticated, service_role;
