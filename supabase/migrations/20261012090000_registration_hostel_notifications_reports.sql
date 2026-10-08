-- Returning-trainee self-registration and application windows, "request more information" on applications,
-- emailed induction / library / placement / registration notices, online hostel room requests, hostel complaints,
-- and certification reports.

-- ---------------------------------------------------------------------------
-- Windows: when applications and returning-trainee registrations are open. Opt-in per centre and type:
-- a centre with no window of a type is not restricted for applications; self-registration needs a window.
-- ---------------------------------------------------------------------------
CREATE TABLE public.registration_windows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  window_type text NOT NULL CHECK (window_type IN ('application','registration')),
  academic_year text NOT NULL,
  opens_on date NOT NULL,
  closes_on date NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_on >= opens_on)
);
CREATE INDEX idx_registration_windows_org ON public.registration_windows (organization_id, window_type, opens_on);
ALTER TABLE public.registration_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Centre members read windows" ON public.registration_windows FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));
CREATE POLICY "Registration staff manage windows" ON public.registration_windows FOR ALL
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','registration_officer','head_of_training']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','registration_officer','head_of_training']));

-- Online applications are refused after the closing date when the centre has set application windows
CREATE OR REPLACE FUNCTION public.enforce_application_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.application_source = 'online'
     AND EXISTS (SELECT 1 FROM public.registration_windows w WHERE w.organization_id = NEW.organization_id AND w.window_type = 'application')
     AND NOT EXISTS (SELECT 1 FROM public.registration_windows w WHERE w.organization_id = NEW.organization_id AND w.window_type = 'application'
                     AND CURRENT_DATE BETWEEN w.opens_on AND w.closes_on) THEN
    RAISE EXCEPTION 'Applications are closed at the moment';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_enforce_application_window BEFORE INSERT ON public.trainee_applications
FOR EACH ROW EXECUTE FUNCTION public.enforce_application_window();

-- Public: is there an open application window? (null = the centre has not set any)
CREATE OR REPLACE FUNCTION public.application_window_status(_org_slug text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.registration_windows w WHERE w.organization_id = o.id AND w.window_type = 'application') THEN NULL
    ELSE jsonb_build_object(
      'open', EXISTS (SELECT 1 FROM public.registration_windows w WHERE w.organization_id = o.id AND w.window_type = 'application' AND CURRENT_DATE BETWEEN w.opens_on AND w.closes_on),
      'next_opens', (SELECT min(w.opens_on) FROM public.registration_windows w WHERE w.organization_id = o.id AND w.window_type = 'application' AND w.opens_on > CURRENT_DATE),
      'closes_on', (SELECT max(w.closes_on) FROM public.registration_windows w WHERE w.organization_id = o.id AND w.window_type = 'application' AND CURRENT_DATE BETWEEN w.opens_on AND w.closes_on))
  END
  FROM public.organizations o WHERE o.subdomain = _org_slug AND o.active;
$$;
GRANT EXECUTE ON FUNCTION public.application_window_status(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Returning trainees register themselves for a new academic year
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.self_register_returning(_academic_year text, _hostel_required boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trainees%ROWTYPE; _owing numeric; _status text; _reg uuid; r record;
BEGIN
  SELECT * INTO t FROM public.trainees WHERE user_id = auth.uid() AND status = 'active' ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only active trainees can register for a new year'; END IF;
  IF COALESCE(trim(_academic_year), '') = '' THEN RAISE EXCEPTION 'Choose the academic year'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.registration_windows w WHERE w.organization_id = t.organization_id AND w.window_type = 'registration'
                 AND w.academic_year = _academic_year AND CURRENT_DATE BETWEEN w.opens_on AND w.closes_on) THEN
    RAISE EXCEPTION 'Registration for % is not open', _academic_year;
  END IF;
  IF EXISTS (SELECT 1 FROM public.registrations x WHERE x.trainee_id = t.id AND x.academic_year = _academic_year) THEN
    RAISE EXCEPTION 'You are already registered, or waiting to be registered, for %', _academic_year;
  END IF;
  SELECT COALESCE(sum(f.balance), 0) INTO _owing FROM public.fee_records f WHERE f.trainee_id = t.id AND f.balance > 0 AND f.academic_year <> _academic_year;
  _status := CASE WHEN _owing > 0 THEN 'fee_pending' ELSE 'pending' END;

  INSERT INTO public.registrations (organization_id, trainee_id, qualification_id, academic_year, hostel_required, registration_status)
  VALUES (t.organization_id, t.id, t.qualification_id, _academic_year, COALESCE(_hostel_required, false), _status) RETURNING id INTO _reg;

  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = t.organization_id AND ur.role::text = 'registration_officer' LOOP
    PERFORM public.notify_person(t.organization_id, r.user_id, NULL, 'registration', 'Registration request: ' || t.first_name || ' ' || t.last_name,
      t.first_name || ' ' || t.last_name || ' (' || t.trainee_id || ') asks to register for ' || _academic_year
        || CASE WHEN _owing > 0 THEN '. Outstanding fees: ' || _owing ELSE '' END || '.', '/registrations');
  END LOOP;
  RETURN jsonb_build_object('registration_id', _reg, 'status', _status, 'outstanding', _owing);
END $$;
GRANT EXECUTE ON FUNCTION public.self_register_returning(text, boolean) TO authenticated;

-- Tell the trainee at each step of their registration
CREATE OR REPLACE FUNCTION public.notify_registration_step()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trainees%ROWTYPE; _msg text; _title text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.registration_status IS NOT DISTINCT FROM OLD.registration_status THEN RETURN NEW; END IF;
  SELECT * INTO t FROM public.trainees WHERE id = NEW.trainee_id;
  _title := CASE NEW.registration_status WHEN 'registered' THEN 'You are registered for ' || NEW.academic_year
                                         WHEN 'fee_pending' THEN 'Registration for ' || NEW.academic_year || ': fees outstanding'
                                         ELSE 'Registration for ' || NEW.academic_year || ' received' END;
  _msg := CASE NEW.registration_status
    WHEN 'registered' THEN 'Dear ' || t.first_name || ', your registration for ' || NEW.academic_year || ' is complete. You can print your proof of registration from the portal.'
    WHEN 'fee_pending' THEN 'Dear ' || t.first_name || ', please settle your outstanding fees so your registration for ' || NEW.academic_year || ' can be completed.'
    ELSE 'Dear ' || t.first_name || ', we received your registration for ' || NEW.academic_year || ' and will confirm it shortly.' END;
  PERFORM public.notify_person(NEW.organization_id, t.user_id, t.email, 'registration', _title, _msg, '/trainee/registration');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_registration_step AFTER INSERT OR UPDATE OF registration_status ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.notify_registration_step();

-- ---------------------------------------------------------------------------
-- Ask an applicant for more information
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainee_applications
  ADD COLUMN IF NOT EXISTS info_request_note text,
  ADD COLUMN IF NOT EXISTS info_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.request_application_info(_application uuid, _note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.trainee_applications%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.trainee_applications WHERE id = _application FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF NOT public.has_org_role(auth.uid(), a.organization_id, ARRAY['admin','organization_admin','registration_officer']) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF COALESCE(trim(_note), '') = '' THEN RAISE EXCEPTION 'Say what information is missing'; END IF;
  UPDATE public.trainee_applications SET info_request_note = trim(_note), info_requested_at = now() WHERE id = a.id;
  PERFORM public.notify_person(a.organization_id, a.user_id, a.email, 'application',
    'More information needed: application ' || a.application_number,
    'Dear ' || a.first_name || ', we need more information to process your application (' || a.application_number || '): ' || trim(_note)
      || ' Please contact the registration office with the details.', '/trainee/application/status');
END $$;
GRANT EXECUTE ON FUNCTION public.request_application_info(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Emailed notices: assessment induction, library, placement allocation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_sitting_induction(_sitting uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.assessment_sittings%ROWTYPE; n integer := 0; r record; _msg text;
BEGIN
  SELECT * INTO s FROM public.assessment_sittings WHERE id = _sitting;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sitting not found'; END IF;
  IF NOT public.is_assessment_staff(auth.uid(), s.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF s.induction_date IS NULL THEN RAISE EXCEPTION 'Set the induction date first'; END IF;
  _msg := 'Induction on ' || to_char(s.induction_date, 'DD Mon YYYY HH24:MI') || COALESCE(' at ' || s.induction_venue, '') || COALESCE('. ' || s.induction_agenda, '');
  FOR r IN
    SELECT t.user_id, COALESCE(NULLIF(trim(t.email), ''), NULLIF(trim(p.email), '')) AS email
    FROM public.assessment_sitting_candidates c JOIN public.trainees t ON t.id = c.trainee_id LEFT JOIN public.profiles p ON p.user_id = t.user_id
    WHERE c.sitting_id = s.id AND c.status <> 'withdrawn'
  LOOP
    PERFORM public.notify_person(s.organization_id, r.user_id, r.email, 'assessment', 'Assessment induction: ' || s.title, _msg, '/trainee/exams/timetable');
    n := n + 1;
  END LOOP;
  UPDATE public.assessment_sittings SET induction_notified_at = now() WHERE id = s.id;
  RETURN n;
END $$;

-- Library: in-app every day as before, plus an email on the first overdue day and then weekly
CREATE OR REPLACE FUNCTION public.library_process_overdue(_org uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.library_settings%ROWTYPE;
  b record;
  n integer := 0;
  d integer;
BEGIN
  IF NOT (public.is_library_staff(auth.uid(), _org) OR public.is_job_runner()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT * INTO s FROM public.library_settings WHERE organization_id = _org;
  IF NOT FOUND THEN s.fine_per_day := 1.00; s.reminder_days_before := 1; END IF;

  FOR b IN
    SELECT lb.id, lb.due_date, m.user_id, m.email, i.title
    FROM public.library_borrowing lb
    JOIN public.library_members m ON m.id = lb.borrower_id
    JOIN public.library_items i ON i.id = lb.library_item_id
    WHERE lb.organization_id = _org AND lb.status = 'borrowed'
      AND lb.due_date = CURRENT_DATE + s.reminder_days_before AND (m.user_id IS NOT NULL OR m.email IS NOT NULL)
  LOOP
    PERFORM public.notify_person(_org, b.user_id, b.email, 'library', 'Library item due soon',
            '"' || b.title || '" is due on ' || b.due_date || '.', '/library');
  END LOOP;

  FOR b IN
    SELECT lb.id, lb.borrower_id, lb.due_date, m.user_id, m.email, i.title
    FROM public.library_borrowing lb
    JOIN public.library_members m ON m.id = lb.borrower_id
    JOIN public.library_items i ON i.id = lb.library_item_id
    WHERE lb.organization_id = _org AND lb.status IN ('borrowed','overdue') AND lb.due_date < CURRENT_DATE
      AND NOT EXISTS (SELECT 1 FROM public.library_fines lf WHERE lf.borrowing_id = lb.id AND lf.fine_type IN ('lost','damaged'))
  LOOP
    d := CURRENT_DATE - b.due_date;
    UPDATE public.library_borrowing SET status = 'overdue' WHERE id = b.id AND status = 'borrowed';

    UPDATE public.library_fines SET days_overdue = d, fine_amount = d * s.fine_per_day
      WHERE borrowing_id = b.id AND fine_type = 'overdue' AND status = 'pending';
    IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.library_fines WHERE borrowing_id = b.id AND fine_type = 'overdue') THEN
      INSERT INTO public.library_fines (organization_id, borrowing_id, borrower_id, fine_amount, days_overdue, fine_type)
      VALUES (_org, b.id, b.borrower_id, d * s.fine_per_day, d, 'overdue');
    END IF;

    IF d = 1 OR d % 7 = 0 THEN
      PERFORM public.notify_person(_org, b.user_id, b.email, 'library', 'Library item overdue',
              '"' || b.title || '" is ' || d || ' day(s) overdue.', '/library');
    ELSIF b.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
      VALUES (b.user_id, _org, 'library', 'Library item overdue', '"' || b.title || '" is ' || d || ' day(s) overdue.', '/library');
    END IF;
    n := n + 1;
  END LOOP;

  UPDATE public.library_reservations SET status = 'expired'
    WHERE organization_id = _org AND status = 'ready' AND expires_at < now();
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.library_send_announcement(_org uuid, _title text, _message text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; r record;
BEGIN
  IF NOT public.is_library_staff(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  FOR r IN SELECT m.user_id, lower(NULLIF(trim(m.email), '')) AS email FROM public.library_members m
           WHERE m.organization_id = _org AND m.status = 'active' AND (m.user_id IS NOT NULL OR NULLIF(trim(m.email), '') IS NOT NULL)
  LOOP
    PERFORM public.notify_person(_org, r.user_id, r.email, 'library', _title, _message, '/library');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Placement approved: tell the trainee and the trainers of the classes they attend
CREATE OR REPLACE FUNCTION public.notify_placement_allocated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trainees%ROWTYPE; _emp text; _msg text; r record;
BEGIN
  IF NEW.status <> 'approved' OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'approved') THEN RETURN NEW; END IF;
  SELECT * INTO t FROM public.trainees WHERE id = NEW.trainee_id;
  SELECT name INTO _emp FROM public.employers WHERE id = NEW.employer_id;
  _msg := t.first_name || ' ' || t.last_name || ' (' || t.trainee_id || ') is placed at ' || COALESCE(_emp, 'an employer')
    || ' from ' || to_char(NEW.start_date, 'DD Mon YYYY') || COALESCE(' to ' || to_char(NEW.end_date, 'DD Mon YYYY'), '')
    || COALESCE('. Supervisor: ' || NEW.supervisor_name, '') || '.';
  PERFORM public.notify_person(NEW.organization_id, t.user_id, t.email, 'placement', 'Industrial attachment placement confirmed', 'Dear ' || t.first_name || ', your placement is confirmed. ' || _msg, '/trainee/logbook');
  FOR r IN SELECT DISTINCT tr.user_id FROM public.class_enrollments ce JOIN public.classes c ON c.id = ce.class_id JOIN public.trainers tr ON tr.id = c.trainer_id
           WHERE ce.trainee_id = NEW.trainee_id AND ce.status = 'active' AND tr.user_id IS NOT NULL LOOP
    PERFORM public.notify_person(NEW.organization_id, r.user_id, NULL, 'placement', 'Trainee placed for industrial attachment', _msg, '/logbook-review');
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_placement_allocated AFTER INSERT OR UPDATE OF status ON public.internship_placements
FOR EACH ROW EXECUTE FUNCTION public.notify_placement_allocated();

-- ---------------------------------------------------------------------------
-- Hostel: trainees ask for a room online, the coordinator decides; hostel complaints
-- ---------------------------------------------------------------------------
CREATE TABLE public.hostel_room_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','cancelled')),
  note text,
  decision_notes text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_hostel_request_open ON public.hostel_room_requests (trainee_id) WHERE status = 'requested';
ALTER TABLE public.hostel_room_requests ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_hostel_staff(_user_id uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['admin','organization_admin','hostel_coordinator']);
$$;
CREATE POLICY "Hostel staff view room requests" ON public.hostel_room_requests FOR SELECT USING (public.is_hostel_staff(auth.uid(), organization_id));
CREATE POLICY "Trainees view own room requests" ON public.hostel_room_requests FOR SELECT USING (public.is_own_trainee(trainee_id));
-- all changes go through the functions below

-- Rooms a trainee may ask for: right gender, active, with a free bed
CREATE OR REPLACE FUNCTION public.list_available_hostel_rooms()
RETURNS TABLE (room_id uuid, building_name text, room_number text, floor_number integer, room_type text, capacity integer, free_beds bigint, monthly_fee numeric, amenities text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, b.building_name, r.room_number, r.floor_number, r.room_type::text, r.capacity,
         (SELECT count(*) FROM public.hostel_beds hb WHERE hb.room_id = r.id AND hb.status = 'available'), r.monthly_fee, r.amenities
  FROM public.trainees t
  JOIN public.hostel_rooms r ON r.organization_id = t.organization_id AND r.active
  JOIN public.hostel_buildings b ON b.id = r.building_id AND b.active
  WHERE t.user_id = auth.uid() AND t.status = 'active'
    AND (r.gender_type::text IN (t.gender::text, 'mixed') AND b.gender_type::text IN (t.gender::text, 'mixed'))
    AND r.status <> 'maintenance'
    AND EXISTS (SELECT 1 FROM public.hostel_beds hb WHERE hb.room_id = r.id AND hb.status = 'available')
  ORDER BY b.building_name, r.room_number;
$$;
GRANT EXECUTE ON FUNCTION public.list_available_hostel_rooms() TO authenticated;

CREATE OR REPLACE FUNCTION public.request_hostel_room(_room uuid, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trainees%ROWTYPE; _id uuid; r record;
BEGIN
  SELECT * INTO t FROM public.trainees WHERE user_id = auth.uid() AND status = 'active' ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only active trainees can request a room'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.list_available_hostel_rooms() x WHERE x.room_id = _room) THEN RAISE EXCEPTION 'That room is not available to you'; END IF;
  IF EXISTS (SELECT 1 FROM public.hostel_allocations a WHERE a.trainee_id = t.id AND a.status IN ('active','pending')) THEN RAISE EXCEPTION 'You already have a hostel allocation'; END IF;
  INSERT INTO public.hostel_room_requests (organization_id, trainee_id, room_id, note) VALUES (t.organization_id, t.id, _room, left(_note, 500)) RETURNING id INTO _id;
  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = t.organization_id AND ur.role::text = 'hostel_coordinator' LOOP
    PERFORM public.notify_person(t.organization_id, r.user_id, NULL, 'hostel', 'Hostel room request: ' || t.first_name || ' ' || t.last_name,
      t.first_name || ' ' || t.last_name || ' (' || t.trainee_id || ') asked for a room. Open Hostel management to decide.', '/hostel-management');
  END LOOP;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.request_hostel_room(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_hostel_room_request(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.hostel_room_requests SET status = 'cancelled' WHERE id = _id AND status = 'requested' AND public.is_own_trainee(trainee_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_hostel_room_request(uuid) TO authenticated;

-- Approving allocates the first free bed of the room (the existing occupancy trigger keeps counts in step)
CREATE OR REPLACE FUNCTION public.decide_hostel_room_request(_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.hostel_room_requests%ROWTYPE; t public.trainees%ROWTYPE; rm public.hostel_rooms%ROWTYPE; _bed uuid;
BEGIN
  SELECT * INTO q FROM public.hostel_room_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.is_hostel_staff(auth.uid(), q.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF q.status <> 'requested' THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
  IF NOT _approve AND COALESCE(trim(_notes), '') = '' THEN RAISE EXCEPTION 'Give a reason for declining'; END IF;
  SELECT * INTO t FROM public.trainees WHERE id = q.trainee_id;
  SELECT * INTO rm FROM public.hostel_rooms WHERE id = q.room_id FOR UPDATE;

  IF _approve THEN
    IF EXISTS (SELECT 1 FROM public.hostel_allocations a WHERE a.trainee_id = q.trainee_id AND a.status IN ('active','pending')) THEN RAISE EXCEPTION 'The trainee already has an allocation'; END IF;
    SELECT hb.id INTO _bed FROM public.hostel_beds hb WHERE hb.room_id = q.room_id AND hb.status = 'available' ORDER BY hb.bed_number LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF _bed IS NULL THEN RAISE EXCEPTION 'No bed is free in this room any more'; END IF;
    INSERT INTO public.hostel_allocations (organization_id, trainee_id, bed_id, room_id, building_id, check_in_date, allocated_by, monthly_fee, notes)
    VALUES (q.organization_id, q.trainee_id, _bed, rm.id, rm.building_id, CURRENT_DATE, auth.uid(), rm.monthly_fee, 'Requested online');
  END IF;
  UPDATE public.hostel_room_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         decision_notes = _notes, decided_by = auth.uid(), decided_at = now() WHERE id = q.id;
  PERFORM public.notify_person(q.organization_id, t.user_id, t.email, 'hostel',
    CASE WHEN _approve THEN 'Hostel room approved' ELSE 'Hostel room request declined' END,
    CASE WHEN _approve THEN 'Your hostel room request was approved. Room ' || rm.room_number || '. Collect your keys at the hostel office.'
         ELSE 'Your hostel room request was declined: ' || _notes END, '/trainee/hostel');
  RETURN CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_hostel_room_request(uuid, boolean, text) TO authenticated;

-- Hostel complaints are ordinary grievances tagged "hostel"; the hostel coordinator can see and answer those
ALTER TABLE public.trainee_affairs_records ADD COLUMN IF NOT EXISTS category text;
CREATE POLICY "Hostel coordinators see hostel complaints" ON public.trainee_affairs_records FOR SELECT
  USING (category = 'hostel' AND public.is_hostel_staff(auth.uid(), organization_id));
CREATE POLICY "Hostel coordinators answer hostel complaints" ON public.trainee_affairs_records FOR UPDATE
  USING (category = 'hostel' AND public.is_hostel_staff(auth.uid(), organization_id))
  WITH CHECK (category = 'hostel' AND public.is_hostel_staff(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- Certification reports (approved results only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.certified_trainees_report(_academic_year text DEFAULT NULL)
RETURNS TABLE (trainee_number text, first_name text, last_name text, trade text, level integer, qualification text, qualification_code text, nqf_level integer, academic_year text, certified_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid());
BEGIN
  IF _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['admin','organization_admin','registration_officer','head_of_training','assessment_coordinator','placement_officer','hod']) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
    SELECT t.trainee_id, t.first_name, t.last_name, tr.name, t.level, q.qualification_title, q.qualification_code, q.nqf_level, r.academic_year, max(r.approved_at)::date
    FROM public.qualification_results r
    JOIN public.trainees t ON t.id = r.trainee_id
    JOIN public.qualifications q ON q.id = r.qualification_id
    LEFT JOIN public.trades tr ON tr.id = t.trade_id
    WHERE t.organization_id = _org AND (_academic_year IS NULL OR r.academic_year = _academic_year)
    GROUP BY t.id, t.trainee_id, t.first_name, t.last_name, tr.name, t.level, q.id, q.qualification_title, q.qualification_code, q.nqf_level, r.academic_year
    HAVING bool_and(r.approved_at IS NOT NULL AND r.result_status IN ('pass','competent'))
    ORDER BY tr.name, t.level, t.last_name;
END $$;
GRANT EXECUTE ON FUNCTION public.certified_trainees_report(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assessment_certification_summary(_academic_year text DEFAULT NULL)
RETURNS TABLE (qualification text, qualification_code text, academic_year text, candidates bigint, certified bigint, not_yet_certified bigint, certification_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid());
BEGIN
  IF _org IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['admin','organization_admin','registration_officer','head_of_training','assessment_coordinator','hod']) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
    SELECT s.qualification_title, s.qualification_code, s.academic_year, count(*), count(*) FILTER (WHERE s.ok), count(*) FILTER (WHERE NOT s.ok),
           round(100.0 * count(*) FILTER (WHERE s.ok) / NULLIF(count(*), 0), 1)
    FROM (
      SELECT q.qualification_title, q.qualification_code, r.academic_year, r.trainee_id,
             bool_and(r.approved_at IS NOT NULL AND r.result_status IN ('pass','competent')) AS ok
      FROM public.qualification_results r JOIN public.qualifications q ON q.id = r.qualification_id
      WHERE r.organization_id = _org AND (_academic_year IS NULL OR r.academic_year = _academic_year)
      GROUP BY q.id, q.qualification_title, q.qualification_code, r.academic_year, r.trainee_id
    ) s
    GROUP BY s.qualification_title, s.qualification_code, s.academic_year
    ORDER BY s.academic_year DESC, s.qualification_title;
END $$;
GRANT EXECUTE ON FUNCTION public.assessment_certification_summary(text) TO authenticated;
