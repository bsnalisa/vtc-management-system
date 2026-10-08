-- 1. Timetable: scoped to the centre, with a publish step so trainees only see approved timetables
-- 2. Draft invoices created automatically when a registration is completed
-- 3. Version control and custom metadata for uploaded documents

-- ---------------------------------------------------------------------------
-- 1. Timetable visibility
-- ---------------------------------------------------------------------------
ALTER TABLE public.timetable_entries
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- rows without a centre belong to their class's centre
UPDATE public.timetable_entries te SET organization_id = c.organization_id
  FROM public.classes c WHERE te.class_id = c.id AND te.organization_id IS NULL;
-- what trainees can see today stays visible; only entries saved from now on start as drafts
UPDATE public.timetable_entries SET published = true, published_at = now() WHERE NOT published;

DROP POLICY IF EXISTS "Authenticated users can view timetable entries" ON public.timetable_entries;
DROP POLICY IF EXISTS "HoT and admin can manage timetable entries" ON public.timetable_entries;
DROP POLICY IF EXISTS "Centre members read timetable entries" ON public.timetable_entries;
DROP POLICY IF EXISTS "Timetable managers manage entries" ON public.timetable_entries;
CREATE POLICY "Centre members read timetable entries" ON public.timetable_entries FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid())
         AND (published OR public.is_org_staff(auth.uid(), organization_id)));
CREATE POLICY "Timetable managers manage entries" ON public.timetable_entries FOR ALL
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','head_of_training']) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','head_of_training']) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view time structure" ON public.academic_time_structure;
DROP POLICY IF EXISTS "HoT and admin can manage time structure" ON public.academic_time_structure;
DROP POLICY IF EXISTS "Centre members read time structure" ON public.academic_time_structure;
DROP POLICY IF EXISTS "Timetable managers manage time structure" ON public.academic_time_structure;
CREATE POLICY "Centre members read time structure" ON public.academic_time_structure FOR SELECT
  USING (organization_id IS NULL OR organization_id = public.get_user_organization(auth.uid()));
CREATE POLICY "Timetable managers manage time structure" ON public.academic_time_structure FOR ALL
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','head_of_training']) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','head_of_training']) OR public.is_super_admin(auth.uid()));

-- Publish or withdraw the timetable of one year and term. Returns the number of entries changed.
CREATE OR REPLACE FUNCTION public.publish_timetable(_academic_year text, _term integer, _publish boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); n integer;
BEGIN
  IF _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['admin','organization_admin','head_of_training']) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.timetable_entries SET published = _publish, published_at = CASE WHEN _publish THEN now() ELSE NULL END
   WHERE organization_id = _org AND academic_year = _academic_year AND term = _term AND published IS DISTINCT FROM _publish;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF _publish AND n > 0 THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
    SELECT DISTINCT t.user_id, _org, 'timetable', 'Class timetable published',
           'The timetable for ' || _academic_year || ', term ' || _term || ' is available.', '/trainee/timetable'
    FROM public.class_enrollments ce JOIN public.trainees t ON t.id = ce.trainee_id
    JOIN public.timetable_entries te ON te.class_id = ce.class_id
    WHERE ce.status = 'active' AND t.user_id IS NOT NULL AND te.organization_id = _org AND te.academic_year = _academic_year AND te.term = _term;
  END IF;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.publish_timetable(text, integer, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Draft invoices when a registration is completed
-- ---------------------------------------------------------------------------
CREATE TABLE public.finance_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_draft_invoices boolean NOT NULL DEFAULT true,
  invoice_due_days integer NOT NULL DEFAULT 30 CHECK (invoice_due_days BETWEEN 0 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance staff manage finance settings" ON public.finance_settings FOR ALL
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','debtor_officer']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','debtor_officer']));

-- One DRAFT invoice per fee record of the registered year, for finance staff to review and issue.
-- The invoice total equals the fee record's total (no tax is added here); nothing is sent to the trainee.
CREATE OR REPLACE FUNCTION public.auto_draft_invoice_on_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.finance_settings%ROWTYPE; f record; _by uuid := COALESCE(auth.uid(), NEW.registered_by); _inv uuid;
BEGIN
  IF NEW.registration_status <> 'registered' OR (TG_OP = 'UPDATE' AND OLD.registration_status IS NOT DISTINCT FROM 'registered') THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.finance_settings WHERE organization_id = NEW.organization_id;
  IF FOUND AND NOT s.auto_draft_invoices THEN RETURN NEW; END IF;
  IF _by IS NULL THEN RETURN NEW; END IF; -- invoices need a creator; skipped for system changes with no user
  FOR f IN SELECT fr.* FROM public.fee_records fr
           WHERE fr.trainee_id = NEW.trainee_id AND fr.academic_year = NEW.academic_year AND fr.total_fee > 0
             AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.fee_record_id = fr.id)
  LOOP
    INSERT INTO public.invoices (organization_id, invoice_number, trainee_id, fee_record_id, due_date, subtotal, tax_amount, total_amount, amount_paid, status, notes, created_by)
    VALUES (NEW.organization_id, public.generate_invoice_number(NEW.organization_id), NEW.trainee_id, f.id,
            CURRENT_DATE + COALESCE(s.invoice_due_days, 30), f.total_fee, 0, f.total_fee, f.amount_paid, 'draft',
            'Created automatically when the registration for ' || NEW.academic_year || ' was completed. Review before issuing.', _by)
    RETURNING id INTO _inv;
    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price) VALUES (_inv, 'Training fees ' || NEW.academic_year, 1, f.total_fee);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_draft_invoice AFTER INSERT OR UPDATE OF registration_status ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.auto_draft_invoice_on_registration();

-- ---------------------------------------------------------------------------
-- 3. Document versions and metadata
-- ---------------------------------------------------------------------------
-- Which kinds of records can carry versioned documents. Staff of the centre can always see them; the owner of the
-- record sees their own.
CREATE OR REPLACE FUNCTION public.can_access_document_entity(_user_id uuid, _org uuid, _type text, _entity uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_org_staff(_user_id, _org)
    OR (_type = 'application' AND EXISTS (SELECT 1 FROM public.trainee_applications a WHERE a.id = _entity AND a.organization_id = _org AND a.user_id = _user_id))
    OR (_type = 'assessment_request' AND EXISTS (SELECT 1 FROM public.assessment_requests r WHERE r.id = _entity AND r.organization_id = _org AND r.created_by = _user_id))
    OR (_type = 'trainee' AND EXISTS (SELECT 1 FROM public.trainees t WHERE t.id = _entity AND t.organization_id = _org AND t.user_id = _user_id)));
$$;

CREATE TABLE public.document_metadata_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('application','assessment_request','trainee')),
  field_key text NOT NULL CHECK (field_key ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  UNIQUE (organization_id, entity_type, field_key)
);
ALTER TABLE public.document_metadata_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Centre members read document fields" ON public.document_metadata_fields FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));
CREATE POLICY "Admins manage document fields" ON public.document_metadata_fields FOR ALL
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin']));

CREATE TABLE public.document_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('application','assessment_request','trainee')),
  entity_id uuid NOT NULL,
  slot text NOT NULL,                       -- which document: 'id_document', 'evidence', ...
  version_no integer NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_current boolean NOT NULL DEFAULT true,
  uploaded_by uuid DEFAULT auth.uid(),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, entity_type, entity_id, slot, version_no)
);
CREATE UNIQUE INDEX uq_document_current ON public.document_versions (organization_id, entity_type, entity_id, slot) WHERE is_current;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Entity members read document versions" ON public.document_versions FOR SELECT
  USING (public.can_access_document_entity(auth.uid(), organization_id, entity_type, entity_id));
-- versions are written only through the functions below (no update or delete: the history is kept)

CREATE OR REPLACE FUNCTION public.add_document_version(
  _entity_type text, _entity uuid, _slot text, _path text, _file_name text, _mime text, _size bigint, _note text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _next integer; f record;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT public.can_access_document_entity(auth.uid(), _org, _entity_type, _entity) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF COALESCE(trim(_slot), '') = '' OR COALESCE(trim(_path), '') = '' OR COALESCE(trim(_file_name), '') = '' THEN RAISE EXCEPTION 'The document needs a name and a file'; END IF;
  IF split_part(_path, '/', 1) <> _org::text THEN RAISE EXCEPTION 'The file must be stored in your centre''s folder'; END IF;
  FOR f IN SELECT field_key, label FROM public.document_metadata_fields
           WHERE organization_id = _org AND entity_type = _entity_type AND required LOOP
    IF COALESCE(trim(_metadata ->> f.field_key), '') = '' THEN RAISE EXCEPTION 'Please fill in: %', f.label; END IF;
  END LOOP;
  SELECT COALESCE(max(version_no), 0) + 1 INTO _next FROM public.document_versions
   WHERE organization_id = _org AND entity_type = _entity_type AND entity_id = _entity AND slot = _slot;
  UPDATE public.document_versions SET is_current = false
   WHERE organization_id = _org AND entity_type = _entity_type AND entity_id = _entity AND slot = _slot AND is_current;
  INSERT INTO public.document_versions (organization_id, entity_type, entity_id, slot, version_no, storage_path, file_name, mime_type, size_bytes, note, metadata)
  VALUES (_org, _entity_type, _entity, _slot, _next, _path, left(_file_name, 255), left(_mime, 100), _size, left(_note, 500), COALESCE(_metadata, '{}'::jsonb));
  RETURN _next;
END $$;
GRANT EXECUTE ON FUNCTION public.add_document_version(text, uuid, text, text, text, text, bigint, text, jsonb) TO authenticated;

-- Make an earlier version the current one again (staff only; the other versions are kept)
CREATE OR REPLACE FUNCTION public.restore_document_version(_version uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.document_versions%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.document_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;
  IF NOT public.is_org_staff(auth.uid(), v.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.document_versions SET is_current = false
   WHERE organization_id = v.organization_id AND entity_type = v.entity_type AND entity_id = v.entity_id AND slot = v.slot AND is_current;
  UPDATE public.document_versions SET is_current = true WHERE id = v.id;
END $$;
GRANT EXECUTE ON FUNCTION public.restore_document_version(uuid) TO authenticated;
