-- Removing a named supervisor from a date: a row that starts on or after that date is deleted (it cannot end before it begins),
-- and a row that started earlier ends the day before. Before this fix a row that started the same day stayed in force.
CREATE OR REPLACE FUNCTION private.reporting_apply_supervisor(_org uuid, _user uuid, _sup uuid, _from date, _to date, _note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _prev record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('reporting:' || _org::text || ':' || _user::text));
  IF _sup IS NULL THEN
    DELETE FROM public.user_supervisors WHERE organization_id = _org AND user_id = _user AND effective_from >= _from;
    UPDATE public.user_supervisors SET effective_to = _from - 1
     WHERE organization_id = _org AND user_id = _user AND effective_from < _from AND (effective_to IS NULL OR effective_to >= _from);
    PERFORM private.reporting_log(_org, 'supervisor_removed', _user, NULL, jsonb_build_object('from', _from));
    RETURN NULL;
  END IF;
  FOR _prev IN SELECT * FROM public.user_supervisors WHERE organization_id = _org AND user_id = _user AND effective_from <= _from AND (effective_to IS NULL OR effective_to >= _from) LOOP
    IF _prev.effective_from = _from THEN DELETE FROM public.user_supervisors WHERE id = _prev.id;
    ELSE UPDATE public.user_supervisors SET effective_to = _from - 1 WHERE id = _prev.id; END IF;
  END LOOP;
  INSERT INTO public.user_supervisors (organization_id, user_id, supervisor_user_id, effective_from, effective_to, note, created_by)
    VALUES (_org, _user, _sup, _from, _to, nullif(trim(coalesce(_note, '')), ''), auth.uid()) RETURNING id INTO _id;
  PERFORM private.reporting_log(_org, 'supervisor_set', _user, NULL, jsonb_build_object('supervisor', _sup, 'from', _from, 'to', _to, 'note', _note));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION private.reporting_apply_supervisor(uuid, uuid, uuid, date, date, text) FROM PUBLIC, anon, authenticated;

-- A Staff Member alone sees only their own role rows (colleagues' roles stay hidden from a login that has no role of its own)
DROP POLICY IF EXISTS "Staff Member alone sees only its own roles" ON public.user_roles;
CREATE POLICY "Staff Member alone sees only its own roles" ON public.user_roles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT (SELECT private.is_base_staff_only(auth.uid())));
