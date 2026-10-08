-- Notification links that pointed at screens that do not exist: the hostel screen is /hostel and registration requests go to the registration officer dashboard.

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
        || CASE WHEN _owing > 0 THEN '. Outstanding fees: ' || _owing ELSE '' END || '.', '/registration-officer-dashboard');
  END LOOP;
  RETURN jsonb_build_object('registration_id', _reg, 'status', _status, 'outstanding', _owing);
END $$;
GRANT EXECUTE ON FUNCTION public.self_register_returning(text, boolean) TO authenticated;

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
      t.first_name || ' ' || t.last_name || ' (' || t.trainee_id || ') asked for a room. Open Hostel management to decide.', '/hostel');
  END LOOP;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.request_hostel_room(uuid, text) TO authenticated;

