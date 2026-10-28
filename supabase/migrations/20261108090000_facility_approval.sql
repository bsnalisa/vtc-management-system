-- Classes, buildings/workshops and rooms: created by the Head of Training, approved by the Centre Manager.
-- Everything that exists today stays approved. A new row made by a signed-in user starts as pending and can only be
-- approved or rejected by the Centre Manager of that centre through facility_decide (the Centre Manager has no other
-- write access). A pending or rejected class cannot be used for enrolment or the timetable, and neither can a pending
-- or rejected room. Editing a rejected item sends it back for approval. Decisions are kept in an append-only log.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes', 'training_buildings', 'training_rooms'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT ''approved'' CHECK (approval_status IN (''pending'', ''approved'', ''rejected''))', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS approval_by uuid, ADD COLUMN IF NOT EXISTS approval_at timestamptz, ADD COLUMN IF NOT EXISTS approval_note text, ADD COLUMN IF NOT EXISTS created_by uuid', t);
  END LOOP;
END $$;

CREATE TABLE public.facility_approval_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('class', 'building', 'room')),
  item_id uuid NOT NULL,
  item_label text,
  event text NOT NULL CHECK (event IN ('submitted', 'approved', 'rejected', 'resubmitted')),
  note text,
  actor uuid, actor_name text, actor_role text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_facility_events_item ON public.facility_approval_events (item_id, at);
CREATE TRIGGER trg_facility_events_append_only BEFORE UPDATE OR DELETE ON public.facility_approval_events FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();
ALTER TABLE public.facility_approval_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Training and centre management read approvals" ON public.facility_approval_events FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['centre_manager', 'head_of_training', 'hod']));
CREATE POLICY "Centre isolation" ON public.facility_approval_events AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.facility_approval_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.facility_kind(_table text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _table WHEN 'classes' THEN 'class' WHEN 'training_buildings' THEN 'building' ELSE 'room' END;
$$;

CREATE OR REPLACE FUNCTION private.facility_log(_org uuid, _kind text, _id uuid, _label text, _event text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p jsonb := private.requisition_person(_org, auth.uid());
BEGIN
  INSERT INTO public.facility_approval_events (organization_id, kind, item_id, item_label, event, note, actor, actor_name, actor_role)
    VALUES (_org, _kind, _id, _label, _event, nullif(trim(coalesce(_note, '')), ''), auth.uid(), _p ->> 'name', _p ->> 'role');
END $$;
REVOKE ALL ON FUNCTION private.facility_kind(text), private.facility_log(uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- New rows made by a signed-in user start pending; the approval fields can only change through facility_decide
CREATE OR REPLACE FUNCTION public.facility_approval_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _kind text := private.facility_kind(TG_TABLE_NAME); _label text; r record;
BEGIN
  _label := coalesce(to_jsonb(NEW) ->> 'class_name', to_jsonb(NEW) ->> 'name');
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND coalesce(current_setting('app.facility_fn', true), '') <> 'on' THEN
      NEW.approval_status := 'pending'; NEW.approval_by := NULL; NEW.approval_at := NULL; NEW.approval_note := NULL; NEW.created_by := auth.uid();
      PERFORM private.facility_log(NEW.organization_id, _kind, NEW.id, _label, 'submitted', NULL);
      FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = NEW.organization_id AND ur.role::text = 'centre_manager' LOOP
        PERFORM public.notify_person(NEW.organization_id, r.user_id, NULL, 'facility_approval',
          'Approval needed: ' || _kind || ' ' || _label, 'The Head of Training added a ' || _kind || ' (' || _label || '). Open Classes to approve or reject it.', '/classes');
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('app.facility_fn', true), '') <> 'on' THEN
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status OR NEW.approval_by IS DISTINCT FROM OLD.approval_by OR NEW.approval_at IS DISTINCT FROM OLD.approval_at OR NEW.approval_note IS DISTINCT FROM OLD.approval_note THEN
      IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Only the Centre Manager approves classes, buildings and rooms' USING ERRCODE = '42501'; END IF;
    ELSIF OLD.approval_status = 'rejected' AND auth.uid() IS NOT NULL THEN
      -- correcting a rejected item sends it back for approval
      NEW.approval_status := 'pending'; NEW.approval_by := NULL; NEW.approval_at := NULL;
      PERFORM private.facility_log(NEW.organization_id, _kind, NEW.id, _label, 'resubmitted', NULL);
      FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = NEW.organization_id AND ur.role::text = 'centre_manager' LOOP
        PERFORM public.notify_person(NEW.organization_id, r.user_id, NULL, 'facility_approval',
          'Approval needed: ' || _kind || ' ' || _label, 'A rejected ' || _kind || ' (' || _label || ') was corrected and sent back for approval.', '/classes');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes', 'training_buildings', 'training_rooms'] LOOP
    EXECUTE format('CREATE TRIGGER trg_facility_approval_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.facility_approval_guard()', t);
  END LOOP;
END $$;

-- The Centre Manager's decision
CREATE OR REPLACE FUNCTION public.facility_decide(_kind text, _id uuid, _approve boolean, _note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _status text; _label text; _by uuid; _bstatus text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF _kind = 'class' THEN SELECT organization_id, approval_status, class_name, created_by INTO _org, _status, _label, _by FROM public.classes WHERE id = _id FOR UPDATE;
  ELSIF _kind = 'building' THEN SELECT organization_id, approval_status, name, created_by INTO _org, _status, _label, _by FROM public.training_buildings WHERE id = _id FOR UPDATE;
  ELSIF _kind = 'room' THEN SELECT organization_id, approval_status, name, created_by INTO _org, _status, _label, _by FROM public.training_rooms WHERE id = _id FOR UPDATE;
  ELSE RAISE EXCEPTION 'Unknown kind'; END IF;
  IF _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['centre_manager']) THEN RAISE EXCEPTION 'Only the Centre Manager approves classes, buildings and rooms' USING ERRCODE = '42501'; END IF;
  IF _status <> 'pending' THEN RAISE EXCEPTION 'This % is not waiting for approval', _kind; END IF;
  IF NOT _approve AND length(trim(coalesce(_note, ''))) < 5 THEN RAISE EXCEPTION 'Give the reason for rejecting it'; END IF;
  IF _approve AND _kind = 'room' THEN
    SELECT b.approval_status INTO _bstatus FROM public.training_rooms r JOIN public.training_buildings b ON b.id = r.building_id WHERE r.id = _id;
    IF _bstatus <> 'approved' THEN RAISE EXCEPTION 'Approve the building or workshop first'; END IF;
  END IF;
  PERFORM set_config('app.facility_fn', 'on', true);
  IF _kind = 'class' THEN UPDATE public.classes SET approval_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, approval_by = auth.uid(), approval_at = now(), approval_note = nullif(trim(coalesce(_note, '')), '') WHERE id = _id;
  ELSIF _kind = 'building' THEN UPDATE public.training_buildings SET approval_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, approval_by = auth.uid(), approval_at = now(), approval_note = nullif(trim(coalesce(_note, '')), '') WHERE id = _id;
  ELSE UPDATE public.training_rooms SET approval_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, approval_by = auth.uid(), approval_at = now(), approval_note = nullif(trim(coalesce(_note, '')), '') WHERE id = _id; END IF;
  PERFORM set_config('app.facility_fn', 'off', true);
  PERFORM private.facility_log(_org, _kind, _id, _label, CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, _note);
  IF _by IS NOT NULL THEN
    PERFORM public.notify_person(_org, _by, NULL, 'facility_approval', CASE WHEN _approve THEN 'Approved: ' ELSE 'Rejected: ' END || _kind || ' ' || _label,
      CASE WHEN _approve THEN 'The Centre Manager approved ' || _label || '. It can now be used.' ELSE 'The Centre Manager rejected ' || _label || ': ' || trim(_note) || '. Correct it to send it back for approval.' END, '/classes');
  END IF;
  RETURN CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
END $$;

-- what is waiting for the Centre Manager (and what was decided recently)
CREATE OR REPLACE FUNCTION public.facility_approval_summary(_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['centre_manager', 'head_of_training', 'hod']) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'classes', (SELECT count(*) FROM public.classes WHERE organization_id = _org AND approval_status = 'pending'),
    'buildings', (SELECT count(*) FROM public.training_buildings WHERE organization_id = _org AND approval_status = 'pending'),
    'rooms', (SELECT count(*) FROM public.training_rooms WHERE organization_id = _org AND approval_status = 'pending'),
    'rejected', (SELECT (SELECT count(*) FROM public.classes WHERE organization_id = _org AND approval_status = 'rejected') + (SELECT count(*) FROM public.training_buildings WHERE organization_id = _org AND approval_status = 'rejected')
                        + (SELECT count(*) FROM public.training_rooms WHERE organization_id = _org AND approval_status = 'rejected')));
END $$;
REVOKE ALL ON FUNCTION public.facility_approval_guard(), public.facility_decide(text, uuid, boolean, text), public.facility_approval_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facility_decide(text, uuid, boolean, text), public.facility_approval_summary(uuid) TO authenticated, service_role;

-- Only approved classes and rooms can be used (enrolment and timetable)
CREATE OR REPLACE FUNCTION public.facility_use_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text; _n text; _room uuid; _class uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  _class := (to_jsonb(NEW) ->> 'class_id')::uuid;
  IF _class IS NOT NULL AND (TG_OP = 'INSERT' OR _class IS DISTINCT FROM (to_jsonb(OLD) ->> 'class_id')::uuid) THEN
    SELECT approval_status, class_name INTO _s, _n FROM public.classes WHERE id = _class;
    IF _s IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'The class "%" is waiting for the Centre Manager''s approval, so it cannot be used yet', _n; END IF;
  END IF;
  IF TG_TABLE_NAME = 'timetable_entries' THEN
    _room := (to_jsonb(NEW) ->> 'room_id')::uuid;
    IF _room IS NOT NULL AND (TG_OP = 'INSERT' OR _room IS DISTINCT FROM (to_jsonb(OLD) ->> 'room_id')::uuid) THEN
      SELECT approval_status, name INTO _s, _n FROM public.training_rooms WHERE id = _room;
      IF _s IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'The room "%" is waiting for the Centre Manager''s approval, so it cannot be used yet', _n; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.facility_use_guard() FROM PUBLIC, anon;
CREATE TRIGGER trg_facility_use_guard BEFORE INSERT OR UPDATE ON public.class_enrollments FOR EACH ROW EXECUTE FUNCTION public.facility_use_guard();
CREATE TRIGGER trg_facility_use_guard BEFORE INSERT OR UPDATE ON public.timetable_entries FOR EACH ROW EXECUTE FUNCTION public.facility_use_guard();
CREATE TRIGGER trg_facility_use_guard BEFORE INSERT OR UPDATE ON public.timetable_slots FOR EACH ROW EXECUTE FUNCTION public.facility_use_guard();

-- Automatic enrolment only uses approved classes, and approving a class enrols its matching trainees
CREATE OR REPLACE FUNCTION public.auto_enroll_trainee_in_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    INSERT INTO public.class_enrollments (class_id, trainee_id, status)
    SELECT c.id, NEW.id, 'active'
    FROM public.classes c
    WHERE c.trade_id = NEW.trade_id
      AND c.level = NEW.level
      AND c.training_mode = NEW.training_mode::training_mode
      AND c.academic_year = NEW.academic_year
      AND c.active = true
      AND c.approval_status = 'approved'
      AND c.organization_id = NEW.organization_id
    ON CONFLICT (class_id, trainee_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_enroll_class_trainees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.active = true AND NEW.approval_status = 'approved' THEN
    INSERT INTO public.class_enrollments (class_id, trainee_id, status)
    SELECT NEW.id, t.id, 'active'
    FROM public.trainees t
    WHERE t.trade_id = NEW.trade_id
      AND t.level = NEW.level
      AND t.training_mode::text = NEW.training_mode::text
      AND t.academic_year = NEW.academic_year
      AND t.status = 'active'
      AND t.organization_id = NEW.organization_id
    ON CONFLICT (class_id, trainee_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_enroll_class ON public.classes;
CREATE TRIGGER trg_auto_enroll_class
AFTER INSERT OR UPDATE OF trade_id, level, training_mode, academic_year, active, trainer_id, approval_status
ON public.classes
FOR EACH ROW
EXECUTE FUNCTION public.auto_enroll_class_trainees();
