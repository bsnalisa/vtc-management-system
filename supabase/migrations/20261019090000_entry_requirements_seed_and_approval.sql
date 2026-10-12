-- Entry requirements: the centre's admission rules, how they are changed, and the standard rules to start with.
--
-- * A rule can now apply to every trade and level (the general minimum requirements), not only to one trade and level.
-- * Registration officers propose changes; the Head of Trainee Support (or an Organization Admin) approves them.
--   Approvers change rules directly. Every change is kept in the existing history table.
-- * The standard rules are added for every active centre.

-- ---------------------------------------------------------------------------
-- 1. General rules need no trade or level
-- ---------------------------------------------------------------------------
ALTER TABLE public.entry_requirements ALTER COLUMN trade_id DROP NOT NULL;
ALTER TABLE public.entry_requirements ALTER COLUMN level DROP NOT NULL;
ALTER TABLE public.entry_requirements_history ALTER COLUMN trade_id DROP NOT NULL;
ALTER TABLE public.entry_requirements_history ALTER COLUMN level DROP NOT NULL;
-- Symbols are optional for a rule; the old defaults made every new rule demand an F in English and Mathematics
ALTER TABLE public.entry_requirements ALTER COLUMN english_symbol DROP DEFAULT;
ALTER TABLE public.entry_requirements ALTER COLUMN maths_symbol DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- 2. Who may do what
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_approve_entry_requirements(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['head_of_trainee_support', 'head_trainee_support', 'organization_admin', 'admin']);
$$;

CREATE OR REPLACE FUNCTION public.can_propose_entry_requirements(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.can_approve_entry_requirements(_user_id, _org) OR public.has_org_role(_user_id, _org, ARRAY['registration_officer']);
$$;

-- Direct changes: approvers only (registration officers go through a change request)
DROP POLICY IF EXISTS "Admins and ROs can manage entry requirements" ON public.entry_requirements;
DROP POLICY IF EXISTS "Approvers manage entry requirements" ON public.entry_requirements;
CREATE POLICY "Approvers manage entry requirements" ON public.entry_requirements FOR ALL TO authenticated
  USING (public.can_approve_entry_requirements(auth.uid(), organization_id))
  WITH CHECK (public.can_approve_entry_requirements(auth.uid(), organization_id));

-- Change requests are written only through the functions below
DROP POLICY IF EXISTS "HoTS can approve change requests" ON public.requirement_change_requests;
DROP POLICY IF EXISTS "ROs can create change requests" ON public.requirement_change_requests;
DROP POLICY IF EXISTS "Users can view change requests in their org" ON public.requirement_change_requests;
DROP POLICY IF EXISTS "Staff read their centre's change requests" ON public.requirement_change_requests;
CREATE POLICY "Staff read their centre's change requests" ON public.requirement_change_requests FOR SELECT TO authenticated
  USING (public.can_propose_entry_requirements(auth.uid(), organization_id));
REVOKE INSERT, UPDATE, DELETE ON public.requirement_change_requests FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Applying a change, submitting one, and deciding on one
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_entry_requirement_change(_org uuid, _type text, _requirement uuid, _changes jsonb, _by uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cols text[] := ARRAY['trade_id', 'level', 'requirement_name', 'min_grade', 'min_points', 'required_subjects', 'english_symbol', 'maths_symbol',
                       'science_symbol', 'prevocational_symbol', 'requires_previous_level', 'previous_level_required', 'mature_age_entry',
                       'mature_min_age', 'mature_min_experience_years', 'additional_requirements'];
  rec public.entry_requirements;
  k text;
  _id uuid;
BEGIN
  rec := jsonb_populate_record(NULL::public.entry_requirements, _changes);
  IF _type = 'create' THEN
    IF COALESCE(trim(rec.requirement_name), '') = '' THEN RAISE EXCEPTION 'A requirement needs a name'; END IF;
    INSERT INTO public.entry_requirements (
      organization_id, trade_id, level, requirement_name, min_grade, min_points, required_subjects, english_symbol, maths_symbol,
      science_symbol, prevocational_symbol, requires_previous_level, previous_level_required, mature_age_entry, mature_min_age,
      mature_min_experience_years, additional_requirements, active, approved_by, approved_at, created_by)
    VALUES (
      _org, rec.trade_id, rec.level, trim(rec.requirement_name), rec.min_grade, rec.min_points, COALESCE(rec.required_subjects, '[]'::jsonb),
      NULLIF(rec.english_symbol, ''), NULLIF(rec.maths_symbol, ''), NULLIF(rec.science_symbol, ''), NULLIF(rec.prevocational_symbol, ''),
      COALESCE(rec.requires_previous_level, false), rec.previous_level_required, COALESCE(rec.mature_age_entry, false),
      COALESCE(rec.mature_min_age, 23), COALESCE(rec.mature_min_experience_years, 3), rec.additional_requirements, true, _by, now(), _by)
    RETURNING id INTO _id;
    RETURN _id;
  END IF;

  IF _requirement IS NULL OR NOT EXISTS (SELECT 1 FROM public.entry_requirements WHERE id = _requirement AND organization_id = _org) THEN
    RAISE EXCEPTION 'That requirement does not exist at this centre';
  END IF;
  IF _type = 'deactivate' THEN
    UPDATE public.entry_requirements SET active = false, updated_at = now() WHERE id = _requirement;
  ELSIF _type = 'update' THEN
    FOR k IN SELECT jsonb_object_keys(_changes) LOOP
      IF k = ANY (cols) THEN
        EXECUTE format('UPDATE public.entry_requirements SET %I = ($1).%I, approved_by = $3, approved_at = now(), updated_at = now() WHERE id = $2', k, k)
          USING rec, _requirement, _by;
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Unknown change type %', _type;
  END IF;
  RETURN _requirement;
END $$;
REVOKE ALL ON FUNCTION public._apply_entry_requirement_change(uuid, text, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- Approvers change the rule now; a registration officer's change waits for approval
CREATE OR REPLACE FUNCTION public.save_entry_requirement(_type text, _requirement uuid, _changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_organization(auth.uid());
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.can_propose_entry_requirements(auth.uid(), v_org) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF _type NOT IN ('create', 'update', 'deactivate') THEN RAISE EXCEPTION 'Unknown change type %', _type; END IF;
  IF public.can_approve_entry_requirements(auth.uid(), v_org) THEN
    RETURN jsonb_build_object('status', 'applied', 'id', public._apply_entry_requirement_change(v_org, _type, _requirement, COALESCE(_changes, '{}'::jsonb), auth.uid()));
  END IF;
  INSERT INTO public.requirement_change_requests (organization_id, entry_requirement_id, request_type, proposed_changes, requested_by)
  VALUES (v_org, _requirement, _type, COALESCE(_changes, '{}'::jsonb), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('status', 'pending', 'id', v_id);
END $$;
GRANT EXECUTE ON FUNCTION public.save_entry_requirement(text, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_requirement_change(_request uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.requirement_change_requests;
BEGIN
  SELECT * INTO r FROM public.requirement_change_requests WHERE id = _request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF auth.uid() IS NULL OR NOT public.can_approve_entry_requirements(auth.uid(), r.organization_id) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
  IF NOT _approve AND COALESCE(trim(_notes), '') = '' THEN RAISE EXCEPTION 'Give a reason for declining'; END IF;
  IF _approve THEN
    PERFORM public._apply_entry_requirement_change(r.organization_id, r.request_type, r.entry_requirement_id, r.proposed_changes, auth.uid());
  END IF;
  UPDATE public.requirement_change_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, reviewed_by = auth.uid(), reviewed_at = now(), review_notes = _notes
   WHERE id = _request;
END $$;
GRANT EXECUTE ON FUNCTION public.review_requirement_change(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. The standard rules, for every active centre. Symbols: A is best, then B, C, D, E, F, G, U.
--    Several rows for the same trade and level are alternatives: meeting any one of them is enough.
--    Rows with no trade are the general minimum requirements, used for any trade that has no rule of its own.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  o record; r record; v_trade uuid;
  v_by uuid := COALESCE((SELECT user_id FROM public.user_roles WHERE role::text = 'super_admin' LIMIT 1), '00000000-0000-0000-0000-000000000000');
BEGIN
  FOR o IN SELECT id FROM public.organizations WHERE active LOOP
    FOR r IN SELECT * FROM (VALUES
      -- code, level, name, min_grade, min_points, english, maths, science, previous_level_required, subjects, note
      (NULL,  NULL, 'General minimum: old curriculum (Grade 10 / JSC)', 10, 23, 'E', 'E', 'E', NULL, '[]', 'Minimum of 23 points with at least an E in English, Mathematics and Physical Science.'),
      (NULL,  NULL, 'General minimum: new curriculum (Grade 11/12 / NSSCO)', 11, 20, NULL, NULL, NULL, NULL, '[]', 'Minimum of 20 points. The subject symbols needed depend on the level and trade.'),
      ('OAD', 1, 'Office Administration Level 1', 11, 20, 'E', 'E', NULL, NULL, '[]', 'Grade 11/12 with 20 points, including an E in English and Mathematics.'),
      ('ELE', 1, 'Electrical General Level 1', 11, 20, 'E', 'E', 'E', NULL, '[]', 'Grade 11/12 with 20 points, including an E in English, Mathematics and Physical Science.'),
      ('ELE', 2, 'Electrical General Level 2', 11, 20, 'E', 'D', 'D', NULL, '[]', 'Higher levels need a D in Mathematics and Physical Science.'),
      ('ELE', 3, 'Electrical General Level 3', 11, 20, 'E', 'D', 'D', NULL, '[]', 'Higher levels need a D in Mathematics and Physical Science.'),
      ('ELE', 4, 'Electrical General Level 4', 11, 20, 'E', 'D', 'D', NULL, '[]', 'Higher levels need a D in Mathematics and Physical Science.'),
      ('ICT', 2, 'ICT Foundation Level 2: Grade 12', 12, 20, 'E', 'E', NULL, NULL, '[]', 'Grade 12 with 20 points (E in Mathematics and English).'),
      ('ICT', 2, 'ICT Foundation Level 2: Grade 11', 11, 20, 'F', 'F', 'F', NULL, '[]', 'Grade 11 with 20 points (F in English, Mathematics and Science).'),
      ('WRT', 2, 'Wholesale and Retail Operations Level 2: with Mathematics', 11, 20, 'E', 'E', NULL, NULL, '[]', 'Grade 11/12 with 20 points, including an E in English and Mathematics.'),
      ('WRT', 2, 'Wholesale and Retail Operations Level 2: with Accounting', 11, 20, 'E', NULL, NULL, NULL, '[{"subject":"Accounting","symbol":"E"}]', 'Grade 11/12 with 20 points, including an E in English and Accounting.'),
      ('HOS', 2, 'Hospitality & Tourism Level 2: Grade 10', 10, 23, 'E', NULL, NULL, NULL, '[]', 'Grade 10 with 23 points (E in English).'),
      ('HOS', 2, 'Hospitality & Tourism Level 2: Grade 11', 11, 20, 'F', 'F', 'F', NULL, '[]', 'Grade 11 with 20 points (F in English, Mathematics and Science).'),
      ('HOS', 3, 'Hospitality & Tourism Level 3', NULL, NULL, NULL, NULL, NULL, 2, '[]', 'The Level 2 trade certificate or relevant results.'),
      ('HOS', 4, 'Hospitality & Tourism Level 4', NULL, NULL, NULL, NULL, NULL, 3, '[]', 'The Level 3 trade certificate or relevant results.')
    ) AS v(code, lvl, name, min_grade, min_points, eng, maths, sci, prev, subjects, note) LOOP
      IF r.code IS NULL THEN
        v_trade := NULL;
      ELSE
        SELECT t.id INTO v_trade FROM public.trades t
         WHERE t.code = r.code AND (t.organization_id = o.id OR t.organization_id IS NULL)
         ORDER BY (t.organization_id IS NULL) LIMIT 1;
        IF v_trade IS NULL THEN CONTINUE; END IF;
      END IF;
      IF EXISTS (SELECT 1 FROM public.entry_requirements e WHERE e.organization_id = o.id AND e.requirement_name = r.name) THEN CONTINUE; END IF;
      INSERT INTO public.entry_requirements (
        organization_id, trade_id, level, requirement_name, min_grade, min_points, required_subjects, english_symbol, maths_symbol, science_symbol,
        requires_previous_level, previous_level_required, mature_age_entry, additional_requirements, active, approved_by, approved_at, created_by)
      VALUES (o.id, v_trade, r.lvl, r.name, r.min_grade, r.min_points, r.subjects::jsonb, r.eng, r.maths, r.sci,
              r.prev IS NOT NULL, r.prev, false, r.note, true, v_by, now(), v_by);
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Applicants have no centre of their own, so they could not read the rules or the points table and every
--    applicant saw "No entry requirements found" and 0 points. Both are public reference information.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Applicants read active entry requirements" ON public.entry_requirements;
CREATE POLICY "Applicants read active entry requirements" ON public.entry_requirements FOR SELECT TO anon, authenticated
  USING (active AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = entry_requirements.organization_id AND o.active));
DROP POLICY IF EXISTS "Applicants read active symbol points" ON public.symbol_points;
CREATE POLICY "Applicants read active symbol points" ON public.symbol_points FOR SELECT TO anon, authenticated
  USING (active AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = symbol_points.organization_id AND o.active));
