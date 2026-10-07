-- Notifications that were missing:
--  * online application submitted -> applicant (email, in-app if they have an account) and registration officers
--  * application screened -> applicant
--  * exam timetable published or changed -> candidates, Head of Training, trainers
--  * extra-curricular event reminders -> trainees (sweep, run on a schedule or from the screen)
-- In-app notices appear immediately; emails are queued in outbound_messages for the dispatcher (docs/messaging-setup.md).

-- One person, in-app and/or email. The email address defaults to the user's profile email.
CREATE OR REPLACE FUNCTION public.notify_person(
  _org uuid, _user uuid, _email text, _type text, _title text, _message text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _to text := NULLIF(trim(COALESCE(_email, '')), '');
BEGIN
  IF _user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
    VALUES (_user, _org, _type, _title, _message, _link);
    IF _to IS NULL THEN SELECT NULLIF(trim(COALESCE(email, '')), '') INTO _to FROM public.profiles WHERE user_id = _user; END IF;
  END IF;
  IF _to IS NOT NULL AND _to ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    INSERT INTO public.outbound_messages (organization_id, channel, recipient, subject, body)
    VALUES (_org, 'email', lower(_to), _title, _message);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.notify_person(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_application_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org_name text; r record;
BEGIN
  SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;
  PERFORM public.notify_person(NEW.organization_id, NEW.user_id, NEW.email, 'application',
    'Application received: ' || NEW.application_number,
    'Dear ' || NEW.first_name || ', ' || COALESCE(_org_name, 'the training centre') || ' has received your application (reference '
      || NEW.application_number || '). We will review it and contact you about the next steps. Please quote the reference number in any communication.',
    '/trainee/application/status');

  IF COALESCE(NEW.application_source, '') = 'online' THEN
    FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
             WHERE ur.organization_id = NEW.organization_id AND ur.role::text = 'registration_officer' LOOP
      PERFORM public.notify_person(NEW.organization_id, r.user_id, NULL, 'application',
        'New online application: ' || NEW.first_name || ' ' || NEW.last_name,
        'Application ' || NEW.application_number || ' was submitted online by ' || NEW.first_name || ' ' || NEW.last_name || '. Open the online applications inbox to screen it.',
        '/online-applications');
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_application_submitted AFTER INSERT ON public.trainee_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_submitted();

CREATE OR REPLACE FUNCTION public.notify_application_screened()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org_name text;
BEGIN
  IF OLD.qualification_status = 'pending' AND NEW.qualification_status IN ('provisionally_qualified', 'does_not_qualify') THEN
    SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;
    PERFORM public.notify_person(NEW.organization_id, NEW.user_id, NEW.email, 'application',
      'Application ' || NEW.application_number || ' screened',
      CASE NEW.qualification_status
        WHEN 'provisionally_qualified' THEN 'Dear ' || NEW.first_name || ', your application (' || NEW.application_number || ') has been screened and you provisionally qualify for the programme. '
          || COALESCE(_org_name, 'The training centre') || ' will contact you about the next steps.'
        ELSE 'Dear ' || NEW.first_name || ', your application (' || NEW.application_number || ') has been screened and does not currently meet the entry requirements for the programme. '
          || 'Please contact ' || COALESCE(_org_name, 'the training centre') || ' if you would like to discuss your options.'
      END,
      '/trainee/application/status');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_application_screened AFTER UPDATE OF qualification_status ON public.trainee_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_screened();

-- ---------------------------------------------------------------------------
-- Exam timetables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_exam_timetable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _kind text; _when text; _title text; _msg text; r record;
BEGIN
  IF NOT NEW.published THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' OR NOT COALESCE(OLD.published, false) THEN
    _kind := 'published';
  ELSIF (NEW.exam_date, NEW.start_time, NEW.end_time, NEW.venue, NEW.room_id) IS DISTINCT FROM (OLD.exam_date, OLD.start_time, OLD.end_time, OLD.venue, OLD.room_id) THEN
    _kind := 'changed';
  ELSE
    RETURN NEW;
  END IF;

  _when := to_char(NEW.exam_date, 'DD Mon YYYY')
    || COALESCE(' ' || to_char(NEW.start_time, 'HH24:MI') || COALESCE('-' || to_char(NEW.end_time, 'HH24:MI'), ''), '')
    || COALESCE(' at ' || NEW.venue, '');
  _title := CASE _kind WHEN 'published' THEN 'Exam timetable: ' ELSE 'Exam timetable changed: ' END || NEW.subject_name;
  _msg := CASE _kind WHEN 'published' THEN 'The ' ELSE 'The new details for the ' END || NEW.subject_name
    || COALESCE(' ' || NEW.exam_type, '') || ' examination: ' || _when || '.';

  FOR r IN
    -- candidates: the gradebook's trainees when the exam is tied to one, otherwise active trainees on the qualification (and level)
    SELECT t.user_id, COALESCE(NULLIF(trim(t.email), ''), NULLIF(trim(p.email), '')) AS email
    FROM public.trainees t LEFT JOIN public.profiles p ON p.user_id = t.user_id
    WHERE t.organization_id = NEW.organization_id AND t.status = 'active'
      AND ((NEW.gradebook_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.gradebook_trainees gt WHERE gt.gradebook_id = NEW.gradebook_id AND gt.trainee_id = t.id))
        OR (NEW.gradebook_id IS NULL AND t.qualification_id = NEW.qualification_id AND (NEW.level IS NULL OR t.level = NEW.level)))
  LOOP
    PERFORM public.notify_person(NEW.organization_id, r.user_id, r.email, 'assessment', _title, _msg, '/trainee/exams/timetable');
  END LOOP;

  FOR r IN
    -- Head of Training and the trainers of classes on this qualification
    SELECT DISTINCT u.user_id FROM (
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = NEW.organization_id AND ur.role::text = 'head_of_training'
      UNION SELECT tr.user_id FROM public.classes c JOIN public.trainers tr ON tr.id = c.trainer_id
            WHERE c.organization_id = NEW.organization_id AND c.qualification_id = NEW.qualification_id AND (NEW.level IS NULL OR c.level = NEW.level)
    ) u WHERE u.user_id IS NOT NULL
  LOOP
    PERFORM public.notify_person(NEW.organization_id, r.user_id, NULL, 'assessment', _title, _msg, '/exam-timetable-publishing');
  END LOOP;

  -- The invigilator is an external person (email only, no system account)
  FOR r IN SELECT i.email FROM public.invigilators i WHERE i.id = NEW.invigilator_id AND i.active AND COALESCE(i.email, '') <> '' LOOP
    PERFORM public.notify_person(NEW.organization_id, NULL, r.email, 'assessment', _title, _msg, NULL);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_exam_timetable AFTER INSERT OR UPDATE ON public.exam_timetables
FOR EACH ROW EXECUTE FUNCTION public.notify_exam_timetable();

-- ---------------------------------------------------------------------------
-- Extra-curricular event reminders
-- ---------------------------------------------------------------------------
-- Sends each due reminder once. An event is due when it starts within its reminder window. Events whose start has
-- already passed without a reminder are closed silently so nobody is told about the past.
CREATE OR REPLACE FUNCTION public.extracurricular_send_reminders(_org uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.extracurricular_events%ROWTYPE; r record; n integer := 0; _msg text;
BEGIN
  IF NOT (public.is_trainee_affairs_staff(auth.uid(), _org) OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'Not authorised'; END IF;

  UPDATE public.extracurricular_events SET reminder_sent = true
   WHERE organization_id = _org AND NOT reminder_sent AND start_date <= now();

  FOR e IN SELECT * FROM public.extracurricular_events
           WHERE organization_id = _org AND NOT reminder_sent AND start_date > now()
             AND start_date <= now() + make_interval(days => reminder_days_before)
           FOR UPDATE
  LOOP
    _msg := e.title || ' starts on ' || to_char(e.start_date, 'DD Mon YYYY HH24:MI') || COALESCE(' at ' || e.location, '') || '.'
            || COALESCE(' ' || e.description, '');
    FOR r IN
      SELECT t.user_id, COALESCE(NULLIF(trim(t.email), ''), NULLIF(trim(p.email), '')) AS email
      FROM public.trainees t LEFT JOIN public.profiles p ON p.user_id = t.user_id
      WHERE t.organization_id = _org AND t.status = 'active'
    LOOP
      PERFORM public.notify_person(_org, r.user_id, r.email, 'general', 'Reminder: ' || e.title, _msg, '/trainee/events');
    END LOOP;
    UPDATE public.extracurricular_events SET reminder_sent = true WHERE id = e.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.extracurricular_send_reminders(uuid) TO authenticated, service_role;

-- Changing an event's date puts it back in the queue for a fresh reminder
CREATE OR REPLACE FUNCTION public.reset_event_reminder()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.reminder_days_before IS DISTINCT FROM OLD.reminder_days_before THEN
    NEW.reminder_sent := false;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reset_event_reminder BEFORE UPDATE ON public.extracurricular_events
FOR EACH ROW EXECUTE FUNCTION public.reset_event_reminder();

-- Candidates are notified by qualification and level when an exam is not tied to a gradebook, so they must also be able
-- to see that timetable in the portal (the existing policy only covers gradebook-linked exams).
CREATE POLICY "Trainees view published exams for their qualification" ON public.exam_timetables FOR SELECT
  USING (published AND gradebook_id IS NULL AND EXISTS (
    SELECT 1 FROM public.trainees t
    WHERE t.user_id = auth.uid() AND t.organization_id = exam_timetables.organization_id AND t.status = 'active'
      AND t.qualification_id = exam_timetables.qualification_id
      AND (exam_timetables.level IS NULL OR t.level = exam_timetables.level)));
