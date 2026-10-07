-- RPL applications (spec 4.8), exemptions (4.13) and external assessment applications (portal 9.5)
-- share one request workflow.

CREATE OR REPLACE FUNCTION public.is_assessment_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.organization_id = _org
      AND ur.role::text IN ('admin','organization_admin','assessment_coordinator','rpl_coordinator','head_of_training','registration_officer')
  );
$$;

CREATE TABLE public.assessment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('rpl','exemption','external_assessment')),
  reference_number text NOT NULL DEFAULT '',
  trainee_id uuid REFERENCES public.trainees(id) ON DELETE SET NULL,
  applicant_name text NOT NULL,
  national_id text,
  phone text,
  email text,
  qualification_id uuid REFERENCES public.qualifications(id) ON DELETE SET NULL,
  unit_standard_id uuid REFERENCES public.unit_standards(id) ON DELETE SET NULL,
  nqf_level integer,
  motivation text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ "name": "...", "path": "..." }]
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','more_info_needed','under_review','assessment_scheduled','approved','rejected')),
  assessor_name text,
  scheduled_at timestamptz,
  venue text,
  outcome text CHECK (outcome IN ('competent','not_yet_competent')),
  decision_notes text,
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assessment_requests_org_type ON public.assessment_requests (organization_id, request_type, status);
CREATE INDEX idx_assessment_requests_creator ON public.assessment_requests (created_by);
ALTER TABLE public.assessment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assessment staff manage requests" ON public.assessment_requests
FOR ALL USING (public.is_assessment_staff(auth.uid(), organization_id))
WITH CHECK (public.is_assessment_staff(auth.uid(), organization_id));
CREATE POLICY "Applicants view own requests" ON public.assessment_requests
FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "Applicants submit requests" ON public.assessment_requests
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND status = 'submitted'
  AND outcome IS NULL AND decided_by IS NULL
  AND organization_id = public.get_user_organization(auth.uid())
  AND (trainee_id IS NULL OR trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()))
);
-- Applicants may add evidence only while the request is waiting on them
CREATE POLICY "Applicants add evidence when info requested" ON public.assessment_requests
FOR UPDATE USING (created_by = auth.uid() AND status = 'more_info_needed')
WITH CHECK (created_by = auth.uid() AND status IN ('more_info_needed','submitted'));

-- Reference numbers: RPL-26-48213 / EXM-26-... / EXA-26-... (unique per organisation)
CREATE OR REPLACE FUNCTION public.set_assessment_request_reference()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prefix text; candidate text; tries integer := 0;
BEGIN
  IF NEW.reference_number IS NOT NULL AND NEW.reference_number <> '' THEN RETURN NEW; END IF;
  prefix := CASE NEW.request_type WHEN 'rpl' THEN 'RPL' WHEN 'exemption' THEN 'EXM' ELSE 'EXA' END;
  LOOP
    candidate := prefix || '-' || to_char(now(), 'YY') || '-' || lpad(floor(random() * 100000)::int::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.assessment_requests WHERE organization_id = NEW.organization_id AND reference_number = candidate);
    tries := tries + 1;
    IF tries > 100 THEN RAISE EXCEPTION 'Could not allocate a reference number'; END IF;
  END LOOP;
  NEW.reference_number := candidate;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_assessment_request_reference BEFORE INSERT ON public.assessment_requests
FOR EACH ROW EXECUTE FUNCTION public.set_assessment_request_reference();

-- Stamp the decision and tell the applicant when the status changes
CREATE OR REPLACE FUNCTION public.assessment_request_status_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE label text;
BEGIN
  NEW.updated_at := now();
  -- Applicants may only add evidence / resubmit; everything else is staff-controlled
  IF auth.uid() IS NOT NULL AND NOT public.is_assessment_staff(auth.uid(), NEW.organization_id) THEN
    NEW.request_type := OLD.request_type; NEW.trainee_id := OLD.trainee_id; NEW.created_by := OLD.created_by;
    NEW.organization_id := OLD.organization_id; NEW.reference_number := OLD.reference_number;
    NEW.assessor_name := OLD.assessor_name; NEW.scheduled_at := OLD.scheduled_at; NEW.venue := OLD.venue;
    NEW.outcome := OLD.outcome; NEW.decision_notes := OLD.decision_notes;
    NEW.decided_by := OLD.decided_by; NEW.decided_at := OLD.decided_at;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved','rejected') THEN
      NEW.decided_by := COALESCE(auth.uid(), NEW.decided_by);
      NEW.decided_at := now();
    END IF;
    label := CASE NEW.request_type WHEN 'rpl' THEN 'RPL application' WHEN 'exemption' THEN 'Exemption request' ELSE 'External assessment application' END;
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
    VALUES (NEW.created_by, NEW.organization_id, 'assessment',
            label || ' ' || NEW.reference_number || ': ' || replace(NEW.status, '_', ' '),
            COALESCE(NEW.decision_notes, 'Your request status has been updated.'),
            '/trainee/requests');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_assessment_request_status BEFORE UPDATE ON public.assessment_requests
FOR EACH ROW EXECUTE FUNCTION public.assessment_request_status_changed();
