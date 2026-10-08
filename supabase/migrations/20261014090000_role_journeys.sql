-- Back-end for the role journeys that had no records behind them:
-- roles that could not be assigned, projects, HR (staff records, leave, recruitment, performance),
-- blended learning (virtual sessions, progress), RPL credit mapping, liaison partner contacts, resource-centre access.

-- ---------------------------------------------------------------------------
-- 0. Roles that exist in the application but could not be assigned to a user (missing from custom_roles)
-- ---------------------------------------------------------------------------
INSERT INTO public.custom_roles (role_code, role_name, description, is_system_role, active) VALUES
  ('placement_officer', 'Placement Officer', 'Places trainees with employers for industrial attachment and tracks alumni', true, true),
  ('head_of_trainee_support', 'Head of Trainee Support', 'Leads trainee affairs: counselling, discipline, health, grievances and events', true, true),
  ('projects_coordinator', 'Projects Coordinator', 'Plans and tracks centre projects and their milestones', true, true),
  ('hr_officer', 'HR Officer', 'Manages staff records, leave, recruitment and performance reviews', true, true),
  ('bdl_coordinator', 'BDL Coordinator', 'Coordinates blended and distance learning classes, sessions and trainee progress', true, true),
  ('rpl_coordinator', 'RPL Coordinator', 'Coordinates recognition of prior learning applications, assessments and credit decisions', true, true),
  ('liaison_officer', 'Liaison Officer', 'Maintains relationships with employers and industry partners', true, true),
  ('resource_center_coordinator', 'Resource Centre Coordinator', 'Runs the resource centre: catalogue, circulation, members and fines', true, true)
ON CONFLICT (role_code) DO NOTHING;

-- the resource-centre coordinator has the same library powers as the librarian
CREATE OR REPLACE FUNCTION public.is_library_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.organization_id = _org
      AND ur.role::text IN ('admin', 'organization_admin', 'librarian', 'resource_center_coordinator')
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. Projects
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_staff(_user_id uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['admin','organization_admin','projects_coordinator']);
$$;

CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_code text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','on_hold','completed','cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  start_date date,
  end_date date,
  budget numeric(14,2) CHECK (budget IS NULL OR budget >= 0),
  spent numeric(14,2) NOT NULL DEFAULT 0 CHECK (spent >= 0),
  lead_user_id uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  UNIQUE (organization_id, project_code)
);
CREATE TABLE public.project_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','blocked')),
  owner_user_id uuid,
  completed_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  note text NOT NULL,
  progress_percent integer CHECK (progress_percent BETWEEN 0 AND 100),
  author_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_milestones_project ON public.project_milestones (project_id, due_date);
CREATE INDEX idx_project_updates_project ON public.project_updates (project_id, created_at DESC);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read projects" ON public.projects FOR SELECT USING (public.is_org_staff(auth.uid(), organization_id));
CREATE POLICY "Project staff manage projects" ON public.projects FOR ALL
  USING (public.is_project_staff(auth.uid(), organization_id)) WITH CHECK (public.is_project_staff(auth.uid(), organization_id));
CREATE POLICY "Staff read milestones" ON public.project_milestones FOR SELECT USING (public.is_org_staff(auth.uid(), organization_id));
CREATE POLICY "Project staff manage milestones" ON public.project_milestones FOR ALL
  USING (public.is_project_staff(auth.uid(), organization_id)) WITH CHECK (public.is_project_staff(auth.uid(), organization_id));
CREATE POLICY "Milestone owners update their milestones" ON public.project_milestones FOR UPDATE
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Staff read project updates" ON public.project_updates FOR SELECT USING (public.is_org_staff(auth.uid(), organization_id));
CREATE POLICY "Project staff post updates" ON public.project_updates FOR INSERT
  WITH CHECK (public.is_project_staff(auth.uid(), organization_id) AND author_id = auth.uid());

-- project and milestone rows take their centre from the project; codes are PRJ-YY-nnn; completion dates are stamped
CREATE OR REPLACE FUNCTION public.project_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF TG_TABLE_NAME = 'projects' THEN
    NEW.updated_at := now();
    IF TG_OP = 'INSERT' AND COALESCE(NEW.project_code, '') = '' THEN
      SELECT count(*) + 1 INTO _n FROM public.projects WHERE organization_id = NEW.organization_id AND project_code LIKE 'PRJ-' || to_char(now(), 'YY') || '-%';
      LOOP
        NEW.project_code := 'PRJ-' || to_char(now(), 'YY') || '-' || lpad(_n::text, 3, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.projects WHERE organization_id = NEW.organization_id AND project_code = NEW.project_code);
        _n := _n + 1;
      END LOOP;
    END IF;
  ELSE
    NEW.organization_id := (SELECT organization_id FROM public.projects WHERE id = NEW.project_id);
    IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
    IF TG_TABLE_NAME = 'project_milestones' THEN
      IF NEW.status = 'done' THEN NEW.completed_on := COALESCE(NEW.completed_on, CURRENT_DATE); ELSE NEW.completed_on := NULL; END IF;
      IF TG_OP = 'UPDATE' AND NOT public.is_project_staff(auth.uid(), NEW.organization_id) AND auth.uid() IS NOT NULL THEN
        -- owners may only move the status along
        NEW.project_id := OLD.project_id; NEW.title := OLD.title; NEW.description := OLD.description; NEW.due_date := OLD.due_date; NEW.owner_user_id := OLD.owner_user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_projects_write BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.project_before_write();
CREATE TRIGGER trg_milestones_write BEFORE INSERT OR UPDATE ON public.project_milestones FOR EACH ROW EXECUTE FUNCTION public.project_before_write();
CREATE TRIGGER trg_project_updates_write BEFORE INSERT ON public.project_updates FOR EACH ROW EXECUTE FUNCTION public.project_before_write();

-- ---------------------------------------------------------------------------
-- 2. HR: staff records, leave, recruitment, performance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_hr_staff(_user_id uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['admin','organization_admin','hr_officer']);
$$;

-- HR details for a person who already has a login and a role in the centre
CREATE TABLE public.staff_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  employee_number text,
  job_title text,
  department text,
  employment_type text NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent','contract','part_time','temporary')),
  employment_status text NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active','on_leave','suspended','resigned','terminated')),
  start_date date,
  end_date date,
  phone text,
  emergency_contact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE TABLE public.leave_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  days_per_year integer NOT NULL DEFAULT 0 CHECK (days_per_year BETWEEN 0 AND 366),
  paid boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (organization_id, name)
);
CREATE TABLE public.leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(5,1) NOT NULL CHECK (days > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decision_notes text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_leave_requests_org ON public.leave_requests (organization_id, status, start_date);
CREATE TABLE public.vacancies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  department text,
  description text,
  closes_on date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','filled')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vacancy_applicants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vacancy_id uuid NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  stage text NOT NULL DEFAULT 'received' CHECK (stage IN ('received','shortlisted','interview','offer','hired','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.performance_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_user_id uuid NOT NULL,
  period text NOT NULL,
  reviewer_user_id uuid DEFAULT auth.uid(),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  goals text,
  comments text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','acknowledged')),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_user_id, period)
);
ALTER TABLE public.staff_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancy_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage staff records" ON public.staff_records FOR ALL
  USING (public.is_hr_staff(auth.uid(), organization_id)) WITH CHECK (public.is_hr_staff(auth.uid(), organization_id));
CREATE POLICY "Staff read their own record" ON public.staff_records FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Staff read leave types" ON public.leave_types FOR SELECT USING (public.is_org_staff(auth.uid(), organization_id));
CREATE POLICY "HR manage leave types" ON public.leave_types FOR ALL
  USING (public.is_hr_staff(auth.uid(), organization_id)) WITH CHECK (public.is_hr_staff(auth.uid(), organization_id));
CREATE POLICY "HR see leave requests" ON public.leave_requests FOR SELECT USING (public.is_hr_staff(auth.uid(), organization_id));
CREATE POLICY "Staff see their leave requests" ON public.leave_requests FOR SELECT USING (user_id = auth.uid());
-- requests and decisions go through the functions below
CREATE POLICY "HR manage vacancies" ON public.vacancies FOR ALL
  USING (public.is_hr_staff(auth.uid(), organization_id)) WITH CHECK (public.is_hr_staff(auth.uid(), organization_id));
CREATE POLICY "HR manage applicants" ON public.vacancy_applicants FOR ALL
  USING (public.is_hr_staff(auth.uid(), organization_id)) WITH CHECK (public.is_hr_staff(auth.uid(), organization_id));
CREATE POLICY "HR manage performance reviews" ON public.performance_reviews FOR ALL
  USING (public.is_hr_staff(auth.uid(), organization_id)) WITH CHECK (public.is_hr_staff(auth.uid(), organization_id));
CREATE POLICY "Staff read their submitted reviews" ON public.performance_reviews FOR SELECT
  USING (employee_user_id = auth.uid() AND status IN ('submitted','acknowledged'));

CREATE OR REPLACE FUNCTION public.hr_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'vacancy_applicants' THEN
    NEW.organization_id := (SELECT organization_id FROM public.vacancies WHERE id = NEW.vacancy_id);
    IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Vacancy not found'; END IF;
  ELSIF TG_TABLE_NAME = 'staff_records' THEN
    NEW.updated_at := now();
    IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = NEW.user_id AND ur.organization_id = NEW.organization_id AND ur.role::text <> 'trainee') THEN
      RAISE EXCEPTION 'That person is not a staff member of this centre';
    END IF;
  ELSIF TG_TABLE_NAME = 'performance_reviews' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = NEW.employee_user_id AND ur.organization_id = NEW.organization_id AND ur.role::text <> 'trainee') THEN
      RAISE EXCEPTION 'That person is not a staff member of this centre';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_hr_staff_records BEFORE INSERT OR UPDATE ON public.staff_records FOR EACH ROW EXECUTE FUNCTION public.hr_before_write();
CREATE TRIGGER trg_hr_applicants BEFORE INSERT OR UPDATE ON public.vacancy_applicants FOR EACH ROW EXECUTE FUNCTION public.hr_before_write();
CREATE TRIGGER trg_hr_reviews BEFORE INSERT ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION public.hr_before_write();

-- A staff member asks for leave; HR officers are told
CREATE OR REPLACE FUNCTION public.request_leave(_leave_type uuid, _start date, _end date, _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid()); _days numeric; _id uuid; _name text; r record; _bal numeric;
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL OR NOT public.is_org_staff(auth.uid(), _org) THEN RAISE EXCEPTION 'Only staff can request leave'; END IF;
  IF _end < _start THEN RAISE EXCEPTION 'The last day cannot be before the first day'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leave_types WHERE id = _leave_type AND organization_id = _org AND active) THEN RAISE EXCEPTION 'Choose a leave type'; END IF;
  -- working days (Monday to Friday)
  SELECT count(*) INTO _days FROM generate_series(_start, _end, interval '1 day') d WHERE extract(isodow FROM d) < 6;
  IF _days <= 0 THEN RAISE EXCEPTION 'That period has no working days'; END IF;
  IF EXISTS (SELECT 1 FROM public.leave_requests x WHERE x.user_id = auth.uid() AND x.status IN ('pending','approved') AND x.start_date <= _end AND x.end_date >= _start) THEN
    RAISE EXCEPTION 'You already have leave requested or approved in that period';
  END IF;
  SELECT lt.days_per_year - COALESCE((SELECT sum(x.days) FROM public.leave_requests x WHERE x.user_id = auth.uid() AND x.leave_type_id = lt.id AND x.status IN ('pending','approved')
                                      AND extract(year FROM x.start_date) = extract(year FROM _start)), 0) INTO _bal FROM public.leave_types lt WHERE lt.id = _leave_type;
  IF (SELECT days_per_year FROM public.leave_types WHERE id = _leave_type) > 0 AND _days > _bal THEN
    RAISE EXCEPTION 'That is % working day(s) but only % remain for this leave type this year', _days, _bal;
  END IF;
  INSERT INTO public.leave_requests (organization_id, user_id, leave_type_id, start_date, end_date, days, reason)
  VALUES (_org, auth.uid(), _leave_type, _start, _end, _days, left(_reason, 500)) RETURNING id INTO _id;
  SELECT COALESCE(full_name, email) INTO _name FROM public.profiles WHERE user_id = auth.uid();
  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.organization_id = _org AND ur.role::text = 'hr_officer' LOOP
    PERFORM public.notify_person(_org, r.user_id, NULL, 'leave', 'Leave request: ' || COALESCE(_name, 'staff member'),
      COALESCE(_name, 'A staff member') || ' asks for ' || _days || ' working day(s) from ' || to_char(_start, 'DD Mon YYYY') || ' to ' || to_char(_end, 'DD Mon YYYY') || '.', '/hr/leave');
  END LOOP;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.request_leave(uuid, date, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_leave(_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.leave_requests%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.leave_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave request not found'; END IF;
  IF NOT public.is_hr_staff(auth.uid(), l.organization_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF l.user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot decide on your own leave'; END IF;
  IF l.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
  IF NOT _approve AND COALESCE(trim(_notes), '') = '' THEN RAISE EXCEPTION 'Give a reason for declining'; END IF;
  UPDATE public.leave_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, decision_notes = _notes, decided_by = auth.uid(), decided_at = now() WHERE id = l.id;
  PERFORM public.notify_person(l.organization_id, l.user_id, NULL, 'leave', CASE WHEN _approve THEN 'Leave approved' ELSE 'Leave declined' END,
    CASE WHEN _approve THEN 'Your leave from ' || to_char(l.start_date, 'DD Mon YYYY') || ' to ' || to_char(l.end_date, 'DD Mon YYYY') || ' was approved.'
         ELSE 'Your leave request was declined: ' || _notes END, '/hr/leave');
  RETURN CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_leave(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_leave(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.leave_requests SET status = 'cancelled' WHERE id = _id AND user_id = auth.uid() AND status IN ('pending','approved') AND start_date > CURRENT_DATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only your own pending or future leave can be cancelled'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_leave(uuid) TO authenticated;

-- Remaining days per leave type for one person and year
CREATE OR REPLACE FUNCTION public.leave_balances(_user uuid DEFAULT NULL, _year integer DEFAULT NULL)
RETURNS TABLE (leave_type_id uuid, leave_type text, days_per_year integer, taken numeric, pending numeric, remaining numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid := COALESCE(_user, auth.uid()); _org uuid := public.get_user_organization(auth.uid()); _y integer := COALESCE(_year, extract(year FROM CURRENT_DATE)::int);
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF _u <> auth.uid() AND NOT public.is_hr_staff(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
    SELECT lt.id, lt.name, lt.days_per_year,
      COALESCE(sum(l.days) FILTER (WHERE l.status = 'approved'), 0), COALESCE(sum(l.days) FILTER (WHERE l.status = 'pending'), 0),
      lt.days_per_year - COALESCE(sum(l.days) FILTER (WHERE l.status IN ('approved','pending')), 0)
    FROM public.leave_types lt
    LEFT JOIN public.leave_requests l ON l.leave_type_id = lt.id AND l.user_id = _u AND extract(year FROM l.start_date) = _y
    WHERE lt.organization_id = _org AND lt.active GROUP BY lt.id, lt.name, lt.days_per_year ORDER BY lt.name;
END $$;
GRANT EXECUTE ON FUNCTION public.leave_balances(uuid, integer) TO authenticated;

-- Staff directory for HR: everyone with a non-trainee role, with their HR record when there is one
CREATE OR REPLACE FUNCTION public.hr_staff_directory()
RETURNS TABLE (user_id uuid, full_name text, email text, roles text, employee_number text, job_title text, department text, employment_type text, employment_status text, start_date date, on_leave_today boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_organization(auth.uid());
BEGIN
  IF _org IS NULL OR NOT public.is_hr_staff(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
    SELECT p.user_id, p.full_name, p.email, string_agg(DISTINCT ur.role::text, ', ' ORDER BY ur.role::text), sr.employee_number, sr.job_title, sr.department, sr.employment_type, sr.employment_status, sr.start_date,
           EXISTS (SELECT 1 FROM public.leave_requests l WHERE l.user_id = p.user_id AND l.status = 'approved' AND CURRENT_DATE BETWEEN l.start_date AND l.end_date)
    FROM public.user_roles ur JOIN public.profiles p ON p.user_id = ur.user_id
    LEFT JOIN public.staff_records sr ON sr.user_id = ur.user_id AND sr.organization_id = _org
    WHERE ur.organization_id = _org AND ur.role::text <> 'trainee'
    GROUP BY p.user_id, p.full_name, p.email, sr.employee_number, sr.job_title, sr.department, sr.employment_type, sr.employment_status, sr.start_date
    ORDER BY p.full_name;
END $$;
GRANT EXECUTE ON FUNCTION public.hr_staff_directory() TO authenticated;

-- The employee acknowledges a submitted review
CREATE OR REPLACE FUNCTION public.acknowledge_review(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.performance_reviews SET status = 'acknowledged', acknowledged_at = now() WHERE id = _id AND employee_user_id = auth.uid() AND status = 'submitted';
  IF NOT FOUND THEN RAISE EXCEPTION 'Review not found'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.acknowledge_review(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Blended / distance learning: virtual sessions and progress
-- ---------------------------------------------------------------------------
-- the BDL coordinator manages the learning space of blended classes (not every class)
CREATE OR REPLACE FUNCTION public.can_manage_class_learning(_user_id uuid, _class uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.classes c LEFT JOIN public.trainers t ON t.id = c.trainer_id
    WHERE c.id = _class
      AND (t.user_id = _user_id
           OR public.has_org_role(_user_id, c.organization_id, ARRAY['admin','organization_admin','head_of_training','hod'])
           OR (c.training_mode::text = 'bdl' AND public.has_org_role(_user_id, c.organization_id, ARRAY['bdl_coordinator']))));
$$;

CREATE TABLE public.virtual_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  meeting_url text NOT NULL CHECK (meeting_url ~* '^https?://'),
  host_name text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','held','cancelled')),
  reminder_sent boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX idx_virtual_sessions_class ON public.virtual_sessions (class_id, starts_at);
CREATE TRIGGER trg_virtual_sessions_org BEFORE INSERT OR UPDATE OF class_id ON public.virtual_sessions FOR EACH ROW EXECUTE FUNCTION public.set_learning_org();
ALTER TABLE public.virtual_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class managers manage virtual sessions" ON public.virtual_sessions FOR ALL
  USING (public.can_manage_class_learning(auth.uid(), class_id)) WITH CHECK (public.can_manage_class_learning(auth.uid(), class_id));
CREATE POLICY "Enrolled trainees see virtual sessions" ON public.virtual_sessions FOR SELECT
  USING (status <> 'cancelled' AND public.is_enrolled_in_class(auth.uid(), class_id));

-- Tell the class when a session is scheduled or its time changes
CREATE OR REPLACE FUNCTION public.notify_virtual_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _msg text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'held' THEN RETURN NEW; END IF;
  _msg := NEW.title || ' on ' || to_char(NEW.starts_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.' || CASE WHEN NEW.status = 'cancelled' THEN ' This session was cancelled.' ELSE ' Join: ' || NEW.meeting_url END;
  FOR r IN SELECT t.user_id, COALESCE(NULLIF(trim(t.email), ''), NULLIF(trim(p.email), '')) AS email
           FROM public.class_enrollments ce JOIN public.trainees t ON t.id = ce.trainee_id LEFT JOIN public.profiles p ON p.user_id = t.user_id
           WHERE ce.class_id = NEW.class_id AND ce.status = 'active' LOOP
    PERFORM public.notify_person(NEW.organization_id, r.user_id, r.email, 'session',
      CASE WHEN NEW.status = 'cancelled' THEN 'Session cancelled: ' ELSE 'Virtual session: ' END || NEW.title, _msg, '/learning');
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_virtual_session AFTER INSERT OR UPDATE OF starts_at, status ON public.virtual_sessions FOR EACH ROW EXECUTE FUNCTION public.notify_virtual_session();

-- Trainees tick off content they have worked through
CREATE TABLE public.learning_item_completions (
  item_id uuid NOT NULL REFERENCES public.learning_items(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, trainee_id)
);
ALTER TABLE public.learning_item_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainees see their completions" ON public.learning_item_completions FOR SELECT USING (public.is_own_trainee(trainee_id));
CREATE POLICY "Class managers see completions" ON public.learning_item_completions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.learning_items i WHERE i.id = item_id AND public.can_manage_class_learning(auth.uid(), i.class_id)));

CREATE OR REPLACE FUNCTION public.set_item_completed(_item uuid, _done boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.learning_items%ROWTYPE; t public.trainees%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.learning_items WHERE id = _item AND published;
  IF NOT FOUND OR NOT public.is_enrolled_in_class(auth.uid(), i.class_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  SELECT * INTO t FROM public.trainees WHERE user_id = auth.uid() AND organization_id = i.organization_id ORDER BY created_at LIMIT 1;
  IF _done THEN
    INSERT INTO public.learning_item_completions (item_id, trainee_id, organization_id) VALUES (i.id, t.id, i.organization_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.learning_item_completions WHERE item_id = i.id AND trainee_id = t.id;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.set_item_completed(uuid, boolean) TO authenticated;

-- Progress of every active trainee of a class (managers only)
CREATE OR REPLACE FUNCTION public.class_progress(_class uuid)
RETURNS TABLE (trainee_id uuid, trainee_number text, first_name text, last_name text, items_total bigint, items_done bigint, assignments_total bigint, assignments_submitted bigint,
               quizzes_total bigint, quizzes_passed bigint, last_activity timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_class_learning(auth.uid(), _class) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
    SELECT t.id, t.trainee_id, t.first_name, t.last_name,
      (SELECT count(*) FROM public.learning_items i WHERE i.class_id = _class AND i.published),
      (SELECT count(*) FROM public.learning_item_completions c JOIN public.learning_items i ON i.id = c.item_id WHERE c.trainee_id = t.id AND i.class_id = _class AND i.published),
      (SELECT count(*) FROM public.learning_assignments a WHERE a.class_id = _class AND a.published),
      (SELECT count(*) FROM public.assignment_submissions s JOIN public.learning_assignments a ON a.id = s.assignment_id WHERE s.trainee_id = t.id AND a.class_id = _class),
      (SELECT count(*) FROM public.learning_quizzes q WHERE q.class_id = _class AND q.published),
      (SELECT count(DISTINCT qa.quiz_id) FROM public.quiz_attempts qa JOIN public.learning_quizzes q ON q.id = qa.quiz_id WHERE qa.trainee_id = t.id AND q.class_id = _class AND qa.passed),
      GREATEST((SELECT max(c.completed_at) FROM public.learning_item_completions c JOIN public.learning_items i ON i.id = c.item_id WHERE c.trainee_id = t.id AND i.class_id = _class),
               (SELECT max(s.submitted_at) FROM public.assignment_submissions s JOIN public.learning_assignments a ON a.id = s.assignment_id WHERE s.trainee_id = t.id AND a.class_id = _class),
               (SELECT max(qa.submitted_at) FROM public.quiz_attempts qa JOIN public.learning_quizzes q ON q.id = qa.quiz_id WHERE qa.trainee_id = t.id AND q.class_id = _class))
    FROM public.class_enrollments ce JOIN public.trainees t ON t.id = ce.trainee_id
    WHERE ce.class_id = _class AND ce.status = 'active' ORDER BY t.last_name, t.first_name;
END $$;
GRANT EXECUTE ON FUNCTION public.class_progress(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPL credit mapping
-- ---------------------------------------------------------------------------
CREATE TABLE public.rpl_credit_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.assessment_requests(id) ON DELETE CASCADE,
  unit_standard_code text NOT NULL,
  unit_standard_title text,
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  decision text NOT NULL DEFAULT 'granted' CHECK (decision IN ('granted','not_granted')),
  evidence_note text,
  decided_by uuid DEFAULT auth.uid(),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, unit_standard_code)
);
ALTER TABLE public.rpl_credit_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment staff manage credit mappings" ON public.rpl_credit_mappings FOR ALL
  USING (public.is_assessment_staff(auth.uid(), organization_id)) WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));
CREATE POLICY "Applicants see their credit mappings" ON public.rpl_credit_mappings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.assessment_requests r WHERE r.id = request_id AND r.created_by = auth.uid()));
CREATE OR REPLACE FUNCTION public.rpl_mapping_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.assessment_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.assessment_requests WHERE id = NEW.request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.request_type <> 'rpl' THEN RAISE EXCEPTION 'Credits are mapped on RPL applications only'; END IF;
  NEW.organization_id := r.organization_id;
  IF NEW.decision = 'not_granted' THEN NEW.credits := 0; END IF;
  NEW.decided_by := COALESCE(auth.uid(), NEW.decided_by); NEW.decided_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rpl_mapping_write BEFORE INSERT OR UPDATE ON public.rpl_credit_mappings FOR EACH ROW EXECUTE FUNCTION public.rpl_mapping_before_write();

-- ---------------------------------------------------------------------------
-- 5. Liaison: contact log with employers and partners
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_liaison_staff(_user_id uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['admin','organization_admin','liaison_officer','placement_officer']);
$$;
CREATE TABLE public.partner_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  interaction_type text NOT NULL DEFAULT 'call' CHECK (interaction_type IN ('call','email','visit','meeting','event','other')),
  interaction_date date NOT NULL DEFAULT CURRENT_DATE,
  summary text NOT NULL,
  outcome text,
  follow_up_date date,
  follow_up_done boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_partner_interactions_org ON public.partner_interactions (organization_id, interaction_date DESC);
ALTER TABLE public.partner_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Liaison staff manage partner interactions" ON public.partner_interactions FOR ALL
  USING (public.is_liaison_staff(auth.uid(), organization_id)) WITH CHECK (public.is_liaison_staff(auth.uid(), organization_id));
CREATE OR REPLACE FUNCTION public.partner_interaction_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.organization_id := (SELECT organization_id FROM public.employers WHERE id = NEW.employer_id);
  IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Partner not found'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_partner_interaction_write BEFORE INSERT OR UPDATE OF employer_id ON public.partner_interactions FOR EACH ROW EXECUTE FUNCTION public.partner_interaction_before_write();
-- liaison officers keep the partner register
CREATE POLICY "Liaison officers manage employers" ON public.employers FOR ALL
  USING (public.is_liaison_staff(auth.uid(), organization_id)) WITH CHECK (public.is_liaison_staff(auth.uid(), organization_id));
