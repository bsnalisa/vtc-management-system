-- Academic calendar (spec 3.x) and trainee deferral of training.

-- ---------------------------------------------------------------------------
-- Academic calendar: terms, holidays, registration and exam periods, graduation. Everyone in the centre can read it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.academic_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'other' CHECK (event_type IN ('term','holiday','registration','exam','assessment','graduation','break','other')),
  academic_year text,
  start_date date NOT NULL,
  end_date date,
  description text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_academic_calendar_org_date ON public.academic_calendar_events (organization_id, start_date);
ALTER TABLE public.academic_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Centre members read the academic calendar" ON public.academic_calendar_events FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));
CREATE POLICY "Academic staff manage the academic calendar" ON public.academic_calendar_events FOR ALL
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','head_of_training','registration_officer']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['admin','organization_admin','head_of_training','registration_officer']));
CREATE TRIGGER update_academic_calendar_events_updated_at BEFORE UPDATE ON public.academic_calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Deferral of training: the trainee asks, registration / training staff decide.
-- Approval sets the trainee's status to "deferred"; reinstating sets it back to "active".
-- ---------------------------------------------------------------------------
CREATE TABLE public.deferral_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  reason text NOT NULL,
  defer_from date NOT NULL DEFAULT CURRENT_DATE,
  expected_return date,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','cancelled','reinstated')),
  decision_notes text,
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expected_return IS NULL OR expected_return >= defer_from)
);
CREATE INDEX idx_deferral_requests_org ON public.deferral_requests (organization_id, status);
CREATE INDEX idx_deferral_requests_trainee ON public.deferral_requests (trainee_id);
-- one open request per trainee
CREATE UNIQUE INDEX uq_deferral_one_open ON public.deferral_requests (trainee_id) WHERE status IN ('submitted','approved');
ALTER TABLE public.deferral_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_deferral_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['admin','organization_admin','registration_officer','head_of_training','head_of_trainee_support','head_trainee_support']);
$$;

CREATE POLICY "Staff view deferral requests" ON public.deferral_requests FOR SELECT
  USING (public.is_deferral_staff(auth.uid(), organization_id));
CREATE POLICY "Trainees view their deferral requests" ON public.deferral_requests FOR SELECT
  USING (public.is_own_trainee(trainee_id));
CREATE POLICY "Trainees ask to defer" ON public.deferral_requests FOR INSERT
  WITH CHECK (status = 'submitted' AND created_by = auth.uid() AND public.is_own_trainee(trainee_id)
              AND organization_id = (SELECT t.organization_id FROM public.trainees t WHERE t.id = deferral_requests.trainee_id));
CREATE POLICY "Trainees withdraw a pending request" ON public.deferral_requests FOR UPDATE
  USING (status = 'submitted' AND public.is_own_trainee(trainee_id))
  WITH CHECK (status = 'cancelled' AND public.is_own_trainee(trainee_id));

-- Decisions go through the functions below; a trainee can only change status to cancelled.
CREATE OR REPLACE FUNCTION public.guard_deferral_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND COALESCE(current_setting('app.deferral_apply', true), '') <> 'on' THEN
    NEW.organization_id := OLD.organization_id; NEW.trainee_id := OLD.trainee_id; NEW.created_by := OLD.created_by;
    NEW.reason := OLD.reason; NEW.defer_from := OLD.defer_from; NEW.expected_return := OLD.expected_return;
    NEW.decision_notes := OLD.decision_notes; NEW.decided_by := OLD.decided_by; NEW.decided_at := OLD.decided_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_deferral_request BEFORE INSERT OR UPDATE ON public.deferral_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_deferral_request();

-- Tell registration staff when a request arrives
CREATE OR REPLACE FUNCTION public.notify_deferral_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trainees%ROWTYPE; r record;
BEGIN
  SELECT * INTO t FROM public.trainees WHERE id = NEW.trainee_id;
  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
           WHERE ur.organization_id = NEW.organization_id AND ur.role::text IN ('registration_officer','head_of_trainee_support','head_trainee_support') LOOP
    PERFORM public.notify_person(NEW.organization_id, r.user_id, NULL, 'deferral',
      'Deferral request: ' || t.first_name || ' ' || t.last_name,
      t.first_name || ' ' || t.last_name || ' (' || t.trainee_id || ') asks to defer training. Open Deferral requests to decide.',
      '/deferral-requests');
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_deferral_submitted AFTER INSERT ON public.deferral_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_deferral_submitted();

CREATE OR REPLACE FUNCTION public.decide_deferral(_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deferral_requests%ROWTYPE; t public.trainees%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deferral_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.is_deferral_staff(auth.uid(), d.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF d.status <> 'submitted' THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
  IF NOT _approve AND COALESCE(trim(_notes), '') = '' THEN RAISE EXCEPTION 'Give a reason for declining'; END IF;
  SELECT * INTO t FROM public.trainees WHERE id = d.trainee_id;

  PERFORM set_config('app.deferral_apply', 'on', true);
  UPDATE public.deferral_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         decision_notes = _notes, decided_by = auth.uid(), decided_at = now() WHERE id = d.id;
  PERFORM set_config('app.deferral_apply', 'off', true);

  IF _approve THEN
    UPDATE public.trainees SET status = 'deferred' WHERE id = d.trainee_id AND status = 'active';
  END IF;
  PERFORM public.notify_person(d.organization_id, t.user_id, t.email, 'deferral',
    CASE WHEN _approve THEN 'Deferral approved' ELSE 'Deferral declined' END,
    CASE WHEN _approve THEN 'Your request to defer training has been approved.' || COALESCE(' ' || _notes, '')
         ELSE 'Your request to defer training was declined: ' || _notes END,
    '/trainee/deferral');
  RETURN CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_deferral(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reinstate_deferred_trainee(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deferral_requests%ROWTYPE; t public.trainees%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deferral_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.is_deferral_staff(auth.uid(), d.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF d.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved deferral can be ended'; END IF;
  SELECT * INTO t FROM public.trainees WHERE id = d.trainee_id;
  PERFORM set_config('app.deferral_apply', 'on', true);
  UPDATE public.deferral_requests SET status = 'reinstated', decided_by = auth.uid(), decided_at = now() WHERE id = d.id;
  PERFORM set_config('app.deferral_apply', 'off', true);
  UPDATE public.trainees SET status = 'active' WHERE id = d.trainee_id AND status = 'deferred';
  PERFORM public.notify_person(d.organization_id, t.user_id, t.email, 'deferral', 'Welcome back',
    'Your deferral has ended and your training status is active again.', '/trainee/deferral');
END $$;
GRANT EXECUTE ON FUNCTION public.reinstate_deferred_trainee(uuid) TO authenticated;
