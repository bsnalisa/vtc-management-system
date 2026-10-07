-- Trainee Affairs module (spec section 10): incidents, counselling, discipline,
-- career guidance, health services, grievances, extracurricular calendar,
-- anonymous suggestion box and anonymous trainer evaluations.

CREATE OR REPLACE FUNCTION public.is_trainee_affairs_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.organization_id = _org
      AND ur.role::text IN ('admin', 'organization_admin', 'head_of_trainee_support', 'head_trainee_support', 'registration_officer')
  );
$$;

CREATE TABLE public.trainee_affairs_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trainee_id uuid REFERENCES public.trainees(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('incident','counselling','discipline','career_guidance','health','grievance','feedback')),
  title text NOT NULL,
  description text NOT NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  severity text CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  action_taken text,
  follow_up_date date,
  confidential boolean NOT NULL DEFAULT true,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tar_org_type ON public.trainee_affairs_records (organization_id, record_type);
CREATE INDEX idx_tar_trainee ON public.trainee_affairs_records (trainee_id);
ALTER TABLE public.trainee_affairs_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage affairs records" ON public.trainee_affairs_records
FOR ALL
USING (public.is_trainee_affairs_staff(auth.uid(), organization_id))
WITH CHECK (public.is_trainee_affairs_staff(auth.uid(), organization_id));

-- Trainees may raise and read their own grievances/feedback only
CREATE POLICY "Trainees raise own grievances" ON public.trainee_affairs_records
FOR INSERT
WITH CHECK (
  record_type IN ('grievance','feedback')
  AND trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
  AND recorded_by = auth.uid()
);
CREATE POLICY "Trainees view own grievances" ON public.trainee_affairs_records
FOR SELECT
USING (
  record_type IN ('grievance','feedback')
  AND trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
);

CREATE TRIGGER update_trainee_affairs_records_updated_at
BEFORE UPDATE ON public.trainee_affairs_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extracurricular calendar
CREATE TABLE public.extracurricular_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('sport','club','trade_fair','cultural','awareness','workshop','seminar','trc_affair','other')),
  description text,
  location text,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  reminder_days_before integer NOT NULL DEFAULT 1,
  reminder_sent boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.extracurricular_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view events" ON public.extracurricular_events
FOR SELECT USING (organization_id = public.get_user_organization(auth.uid()));
CREATE POLICY "Staff manage events" ON public.extracurricular_events
FOR ALL
USING (public.is_trainee_affairs_staff(auth.uid(), organization_id))
WITH CHECK (public.is_trainee_affairs_staff(auth.uid(), organization_id));
CREATE TRIGGER update_extracurricular_events_updated_at
BEFORE UPDATE ON public.extracurricular_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anonymous submissions: deliberately NO user column, so authorship cannot be traced.
CREATE TABLE public.anonymous_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('suggestion','trainer_evaluation')),
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'trainer_evaluation' OR (trainer_id IS NOT NULL AND rating IS NOT NULL))
);
ALTER TABLE public.anonymous_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members submit anonymously" ON public.anonymous_submissions
FOR INSERT WITH CHECK (organization_id = public.get_user_organization(auth.uid()));
CREATE POLICY "Staff view anonymous submissions" ON public.anonymous_submissions
FOR SELECT USING (public.is_trainee_affairs_staff(auth.uid(), organization_id));
CREATE POLICY "Staff update anonymous submissions" ON public.anonymous_submissions
FOR UPDATE USING (public.is_trainee_affairs_staff(auth.uid(), organization_id));
