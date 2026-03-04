
-- ═══ Phase 3: Governance & Controls ═══

-- 1. Assessment cycle locking table
CREATE TABLE public.assessment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  academic_year TEXT NOT NULL,
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'archived')),
  locked_at TIMESTAMPTZ,
  locked_by UUID,
  lock_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, academic_year, qualification_id)
);

ALTER TABLE public.assessment_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assessment cycles"
  ON public.assessment_cycles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "AC and HoT can manage assessment cycles"
  ON public.assessment_cycles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('assessment_coordinator', 'head_of_training', 'organization_admin', 'super_admin')
      AND (organization_id = assessment_cycles.organization_id OR role = 'super_admin')
    )
  );

-- 2. Extend assessment_template_audit for all audit events (CA, SA, results)
-- Already exists, but ensure it covers all entity types by adding an index
CREATE INDEX IF NOT EXISTS idx_template_audit_entity ON public.assessment_template_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_template_audit_org ON public.assessment_template_audit(organization_id, created_at DESC);

-- 3. Add results_release_date to assessment_cycles for controlling visibility
ALTER TABLE public.assessment_cycles ADD COLUMN IF NOT EXISTS results_release_date TIMESTAMPTZ;

-- 4. Prevent SA edits on locked cycles (trigger)
CREATE OR REPLACE FUNCTION public.prevent_locked_cycle_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_cycle_status TEXT;
BEGIN
  SELECT status INTO v_cycle_status
  FROM public.assessment_cycles
  WHERE qualification_id = NEW.qualification_id
    AND academic_year = NEW.academic_year
  LIMIT 1;

  IF v_cycle_status = 'locked' OR v_cycle_status = 'archived' THEN
    RAISE EXCEPTION 'Cannot modify results: assessment cycle is %', v_cycle_status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_locked_summative
  BEFORE INSERT OR UPDATE ON public.summative_results
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_cycle_edits();

CREATE TRIGGER trg_prevent_locked_qualification_results
  BEFORE INSERT OR UPDATE ON public.qualification_results
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_cycle_edits();

-- 5. Audit logging function for easy insertion
CREATE OR REPLACE FUNCTION public.log_assessment_audit(
  _org_id UUID,
  _template_id UUID,
  _entity_type TEXT,
  _entity_id UUID,
  _action TEXT,
  _old_data JSONB DEFAULT NULL,
  _new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.assessment_template_audit (
    organization_id, template_id, entity_type, entity_id, action,
    old_data, new_data, performed_by
  ) VALUES (
    _org_id, _template_id, _entity_type, _entity_id, _action,
    _old_data, _new_data, auth.uid()
  )
  RETURNING id INTO _log_id;
  RETURN _log_id;
END;
$$;

-- 6. Auto-audit trigger for summative_results
CREATE OR REPLACE FUNCTION public.audit_summative_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_assessment_audit(
      NEW.organization_id, NULL, 'summative_result', NEW.id, 'sa_mark_recorded',
      NULL, to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_assessment_audit(
      NEW.organization_id, NULL, 'summative_result', NEW.id, 'sa_mark_updated',
      to_jsonb(OLD), to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_summative
  AFTER INSERT OR UPDATE ON public.summative_results
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_summative_results();

-- 7. Auto-audit trigger for qualification_results approval
CREATE OR REPLACE FUNCTION public.audit_qualification_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.approved_by IS NULL AND NEW.approved_by IS NOT NULL THEN
    PERFORM public.log_assessment_audit(
      NEW.organization_id, NULL, 'qualification_result', NEW.id, 'result_approved',
      to_jsonb(OLD), to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_qual_results
  AFTER UPDATE ON public.qualification_results
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_qualification_results();

-- 8. Function to lock an assessment cycle
CREATE OR REPLACE FUNCTION public.lock_assessment_cycle(
  _org_id UUID,
  _qualification_id UUID,
  _academic_year TEXT,
  _reason TEXT DEFAULT 'End of assessment cycle'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _cycle_id UUID;
  _unpublished INT;
BEGIN
  -- Check for unapproved results
  SELECT COUNT(*) INTO _unpublished
  FROM public.qualification_results
  WHERE qualification_id = _qualification_id
    AND academic_year = _academic_year
    AND organization_id = _org_id
    AND approved_by IS NULL;

  IF _unpublished > 0 THEN
    RAISE EXCEPTION 'Cannot lock cycle: % unapproved results remain', _unpublished;
  END IF;

  INSERT INTO public.assessment_cycles (organization_id, qualification_id, academic_year, status, locked_at, locked_by, lock_reason)
  VALUES (_org_id, _qualification_id, _academic_year, 'locked', now(), auth.uid(), _reason)
  ON CONFLICT (organization_id, academic_year, qualification_id)
  DO UPDATE SET status = 'locked', locked_at = now(), locked_by = auth.uid(), lock_reason = _reason, updated_at = now()
  RETURNING id INTO _cycle_id;

  RETURN _cycle_id;
END;
$$;
