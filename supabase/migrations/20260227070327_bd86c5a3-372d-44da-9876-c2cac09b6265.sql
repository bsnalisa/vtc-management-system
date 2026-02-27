
-- Add unique constraints for upsert operations
ALTER TABLE public.summative_results
  DROP CONSTRAINT IF EXISTS summative_results_unique_trainee_component;
ALTER TABLE public.summative_results
  ADD CONSTRAINT summative_results_unique_trainee_component
  UNIQUE (template_component_id, trainee_id, academic_year);

ALTER TABLE public.ca_final_results
  DROP CONSTRAINT IF EXISTS ca_final_results_unique_trainee_component;
ALTER TABLE public.ca_final_results
  ADD CONSTRAINT ca_final_results_unique_trainee_component
  UNIQUE (template_component_id, trainee_id, academic_year);

ALTER TABLE public.qualification_results
  DROP CONSTRAINT IF EXISTS qualification_results_unique_trainee_component;
ALTER TABLE public.qualification_results
  ADD CONSTRAINT qualification_results_unique_trainee_component
  UNIQUE (template_component_id, trainee_id, academic_year);

-- Function to calculate CA averages from gradebook marks linked to template components
CREATE OR REPLACE FUNCTION public.calculate_ca_for_template_component(
  _template_component_id uuid,
  _trainee_id uuid,
  _qualification_id uuid,
  _academic_year text,
  _org_id uuid
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric;
BEGIN
  SELECT AVG((m.marks_obtained / NULLIF(gc.max_marks, 0)) * 100)
  INTO v_avg
  FROM public.gradebook_marks m
  JOIN public.gradebook_components gc ON m.component_id = gc.id
  JOIN public.gradebooks g ON gc.gradebook_id = g.id
  WHERE gc.template_component_id = _template_component_id
    AND m.trainee_id = _trainee_id
    AND g.qualification_id = _qualification_id
    AND g.academic_year = _academic_year
    AND m.marks_obtained IS NOT NULL;

  RETURN ROUND(COALESCE(v_avg, 0), 2);
END;
$$;

-- Function to calculate and upsert qualification result for a template component
CREATE OR REPLACE FUNCTION public.calculate_qualification_result(
  _template_component_id uuid,
  _trainee_id uuid,
  _qualification_id uuid,
  _academic_year text,
  _org_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ca numeric;
  v_sa numeric;
  v_sa_max numeric;
  v_sa_pct numeric;
  v_pass_mark numeric;
  v_comp_type text;
  v_result text;
  v_sa_locked boolean;
BEGIN
  -- Get template component type and pass mark
  SELECT atc.component_type, 
    CASE atc.component_type 
      WHEN 'theory' THEN at.theory_pass_mark 
      ELSE at.practical_pass_mark 
    END
  INTO v_comp_type, v_pass_mark
  FROM public.assessment_template_components atc
  JOIN public.assessment_templates at ON atc.template_id = at.id
  WHERE atc.id = _template_component_id;

  IF v_comp_type IS NULL THEN RETURN; END IF;

  -- Calculate CA average from linked gradebook marks
  v_ca := public.calculate_ca_for_template_component(
    _template_component_id, _trainee_id, _qualification_id, _academic_year, _org_id
  );

  -- Get SA mark
  SELECT marks_obtained, max_marks, percentage, is_locked
  INTO v_sa, v_sa_max, v_sa_pct, v_sa_locked
  FROM public.summative_results
  WHERE template_component_id = _template_component_id
    AND trainee_id = _trainee_id
    AND academic_year = _academic_year;

  -- Determine result status
  IF v_sa_pct IS NULL THEN
    v_result := 'pending_sa';
  ELSIF v_ca >= v_pass_mark AND v_sa_pct >= v_pass_mark THEN
    v_result := 'pass';
  ELSE
    v_result := 'fail';
  END IF;

  -- Upsert ca_final_results
  INSERT INTO public.ca_final_results (
    organization_id, template_component_id, trainee_id, qualification_id,
    academic_year, ca_average, assessment_count, calculated_at
  ) VALUES (
    _org_id, _template_component_id, _trainee_id, _qualification_id,
    _academic_year, v_ca, 
    (SELECT COUNT(*) FROM public.gradebook_marks m
     JOIN public.gradebook_components gc ON m.component_id = gc.id
     JOIN public.gradebooks g ON gc.gradebook_id = g.id
     WHERE gc.template_component_id = _template_component_id
       AND m.trainee_id = _trainee_id
       AND g.qualification_id = _qualification_id
       AND g.academic_year = _academic_year
       AND m.marks_obtained IS NOT NULL)::integer,
    now()
  )
  ON CONFLICT (template_component_id, trainee_id, academic_year)
  DO UPDATE SET ca_average = EXCLUDED.ca_average, assessment_count = EXCLUDED.assessment_count, calculated_at = now();

  -- Upsert qualification_results
  INSERT INTO public.qualification_results (
    organization_id, qualification_id, template_component_id, trainee_id,
    academic_year, ca_mark, sa_mark, pass_mark, result_status, is_locked
  ) VALUES (
    _org_id, _qualification_id, _template_component_id, _trainee_id,
    _academic_year, v_ca, v_sa_pct, v_pass_mark, v_result, COALESCE(v_sa_locked, false)
  )
  ON CONFLICT (template_component_id, trainee_id, academic_year)
  DO UPDATE SET 
    ca_mark = EXCLUDED.ca_mark, 
    sa_mark = EXCLUDED.sa_mark,
    result_status = EXCLUDED.result_status,
    is_locked = EXCLUDED.is_locked,
    updated_at = now();
END;
$$;
