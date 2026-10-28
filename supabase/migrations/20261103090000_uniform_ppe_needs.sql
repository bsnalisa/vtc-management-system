-- Uniform and PPE needs for procurement.
-- Applicants state their shoe, overall, t-shirt, skirt/trousers and chef-wear sizes on the application (trainee_applications). Once the trainee is
-- registered, the Procurement Officer sees the sizes added up by item and size, can look at the individual register, and can turn the outstanding
-- needs into a draft purchase requisition. Each registration is counted in one requisition only, so the next intake starts from what is still open.

CREATE TABLE IF NOT EXISTS public.ppe_requisition_registrations (
  registration_id uuid NOT NULL PRIMARY KEY REFERENCES public.registrations(id) ON DELETE CASCADE,
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  included_at timestamptz NOT NULL DEFAULT now(), included_by uuid
);
CREATE INDEX IF NOT EXISTS idx_ppe_req_regs_requisition ON public.ppe_requisition_registrations (requisition_id);
ALTER TABLE public.ppe_requisition_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Procurement reads PPE requisition links" ON public.ppe_requisition_registrations FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['procurement_officer', 'stock_control_officer', 'centre_manager']));
CREATE POLICY "Centre isolation" ON public.ppe_requisition_registrations AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));

-- the registered trainees of a centre with the sizes they gave; _open_only leaves out those already in a requisition
CREATE OR REPLACE FUNCTION private.ppe_base(_org uuid, _year text, _trade uuid, _open_only boolean)
RETURNS TABLE (registration_id uuid, trainee_number text, full_name text, trade_name text, academic_year text, shoe_size text, overall_size text, tshirt_size text,
               skirt_trousers_size text, chef_trouser_size text, chef_jacket_size text, requisition_number text, has_sizes boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, t.trainee_id, trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), tr.name, r.academic_year,
         nullif(trim(a.shoe_size), ''), nullif(trim(a.overall_size), ''), nullif(trim(a.tshirt_size), ''),
         nullif(trim(a.skirt_trousers_size), ''), nullif(trim(a.chef_trouser_size), ''), nullif(trim(a.chef_jacket_size), ''),
         pr.requisition_number,
         (coalesce(a.shoe_size, '') || coalesce(a.overall_size, '') || coalesce(a.tshirt_size, '') || coalesce(a.skirt_trousers_size, '')
            || coalesce(a.chef_trouser_size, '') || coalesce(a.chef_jacket_size, '')) <> ''
    FROM public.registrations r
    JOIN public.trainee_applications a ON a.id = r.application_id
    LEFT JOIN public.trainees t ON t.id = r.trainee_id
    LEFT JOIN public.trades tr ON tr.id = a.trade_id
    LEFT JOIN public.ppe_requisition_registrations l ON l.registration_id = r.id
    LEFT JOIN public.purchase_requisitions pr ON pr.id = l.requisition_id
   WHERE r.organization_id = _org AND r.registration_status = 'registered'
     AND (t.id IS NULL OR t.status::text NOT IN ('withdrawn', 'transferred'))
     AND (_year IS NULL OR r.academic_year = _year)
     AND (_trade IS NULL OR a.trade_id = _trade)
     AND (NOT _open_only OR l.registration_id IS NULL)
$$;
REVOKE ALL ON FUNCTION private.ppe_base(uuid, text, uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ppe_items(_org uuid, _year text, _trade uuid, _open_only boolean)
RETURNS TABLE (item text, size text, quantity bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH b AS (SELECT * FROM private.ppe_base(_org, _year, _trade, _open_only)),
  u AS (
    SELECT 'Safety shoes'::text AS item, shoe_size AS size FROM b
    UNION ALL SELECT 'Overall', overall_size FROM b
    UNION ALL SELECT 'T-shirt', tshirt_size FROM b
    UNION ALL SELECT 'Skirt / trousers', skirt_trousers_size FROM b
    UNION ALL SELECT 'Chef trousers', chef_trouser_size FROM b
    UNION ALL SELECT 'Chef jacket', chef_jacket_size FROM b)
  SELECT u.item, u.size, count(*) FROM u WHERE u.size IS NOT NULL GROUP BY u.item, u.size
$$;
REVOKE ALL ON FUNCTION private.ppe_items(uuid, text, uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.uniform_ppe_needs(_org uuid, _year text DEFAULT NULL, _trade uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['procurement_officer', 'stock_control_officer', 'centre_manager']) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'registered', (SELECT count(*) FROM private.ppe_base(_org, _year, _trade, false)),
    'open_trainees', (SELECT count(*) FROM private.ppe_base(_org, _year, _trade, true) WHERE has_sizes),
    'already_requisitioned', (SELECT count(*) FROM private.ppe_base(_org, _year, _trade, false) WHERE requisition_number IS NOT NULL),
    'no_sizes', (SELECT count(*) FROM private.ppe_base(_org, _year, _trade, true) WHERE NOT has_sizes),
    'open_items', coalesce((SELECT jsonb_agg(jsonb_build_object('item', item, 'size', size, 'quantity', quantity) ORDER BY item, CASE WHEN size ~ '^[0-9]+$' THEN lpad(size, 3, '0') ELSE size END)
                              FROM private.ppe_items(_org, _year, _trade, true)), '[]'::jsonb),
    'years', coalesce((SELECT jsonb_agg(DISTINCT academic_year ORDER BY academic_year) FROM private.ppe_base(_org, NULL, NULL, false)), '[]'::jsonb),
    'trades', coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('id', tr.id, 'name', tr.name)) FROM public.trades tr WHERE tr.organization_id = _org), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.uniform_ppe_register(_org uuid, _year text DEFAULT NULL, _trade uuid DEFAULT NULL, _only_open boolean DEFAULT false)
RETURNS TABLE (registration_id uuid, trainee_number text, full_name text, trade_name text, academic_year text, shoe_size text, overall_size text, tshirt_size text,
               skirt_trousers_size text, chef_trouser_size text, chef_jacket_size text, requisition_number text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['procurement_officer', 'stock_control_officer', 'centre_manager']) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT b.registration_id, b.trainee_number, b.full_name, b.trade_name, b.academic_year, b.shoe_size, b.overall_size, b.tshirt_size,
           b.skirt_trousers_size, b.chef_trouser_size, b.chef_jacket_size, b.requisition_number
      FROM private.ppe_base(_org, _year, _trade, _only_open) b ORDER BY b.full_name LIMIT 1000;
END $$;

-- turns the outstanding needs into a draft purchase requisition for the Procurement Officer to price and submit
CREATE OR REPLACE FUNCTION public.create_uniform_requisition(_org uuid, _year text DEFAULT NULL, _trade uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req uuid; _num text; _regs integer; _lines integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_org_role(auth.uid(), _org, ARRAY['procurement_officer']) THEN
    RAISE EXCEPTION 'Only the Procurement Officer can prepare this requisition' USING ERRCODE = '42501';
  END IF;
  CREATE TEMP TABLE _ppe_regs ON COMMIT DROP AS SELECT registration_id FROM private.ppe_base(_org, _year, _trade, true) WHERE has_sizes;
  SELECT count(*) INTO _regs FROM _ppe_regs;
  IF _regs = 0 THEN RAISE EXCEPTION 'No registered trainees with outstanding uniform or PPE sizes' USING ERRCODE = 'P0002'; END IF;
  _num := 'REQ-UNI-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  INSERT INTO public.purchase_requisitions (organization_id, requisition_number, requested_by, department, justification, status)
    VALUES (_org, _num, auth.uid(), 'Training',
            format('Uniforms and PPE for %s newly registered trainee(s)%s, from the sizes given on their applications. Unit costs are to be completed from supplier quotations.', _regs,
                   CASE WHEN _year IS NOT NULL THEN ' (' || _year || ')' ELSE '' END), 'draft')
    RETURNING id INTO _req;
  INSERT INTO public.purchase_requisition_items (requisition_id, item_description, quantity, estimated_unit_cost)
    SELECT _req, i.item || ', size ' || i.size, i.quantity, 0
      FROM (SELECT item, size, count(*) AS quantity FROM (
              SELECT 'Safety shoes' AS item, b.shoe_size AS size FROM private.ppe_base(_org, _year, _trade, true) b WHERE b.registration_id IN (SELECT registration_id FROM _ppe_regs)
              UNION ALL SELECT 'Overall', b.overall_size FROM private.ppe_base(_org, _year, _trade, true) b WHERE b.registration_id IN (SELECT registration_id FROM _ppe_regs)
              UNION ALL SELECT 'T-shirt', b.tshirt_size FROM private.ppe_base(_org, _year, _trade, true) b WHERE b.registration_id IN (SELECT registration_id FROM _ppe_regs)
              UNION ALL SELECT 'Skirt / trousers', b.skirt_trousers_size FROM private.ppe_base(_org, _year, _trade, true) b WHERE b.registration_id IN (SELECT registration_id FROM _ppe_regs)
              UNION ALL SELECT 'Chef trousers', b.chef_trouser_size FROM private.ppe_base(_org, _year, _trade, true) b WHERE b.registration_id IN (SELECT registration_id FROM _ppe_regs)
              UNION ALL SELECT 'Chef jacket', b.chef_jacket_size FROM private.ppe_base(_org, _year, _trade, true) b WHERE b.registration_id IN (SELECT registration_id FROM _ppe_regs)) u
            WHERE size IS NOT NULL GROUP BY item, size) i;
  GET DIAGNOSTICS _lines = ROW_COUNT;
  INSERT INTO public.ppe_requisition_registrations (registration_id, requisition_id, organization_id, included_by)
    SELECT registration_id, _req, _org, auth.uid() FROM _ppe_regs;
  DROP TABLE _ppe_regs;
  RETURN jsonb_build_object('requisition_id', _req, 'requisition_number', _num, 'trainees', _regs, 'lines', _lines);
END $$;

REVOKE ALL ON FUNCTION public.uniform_ppe_needs(uuid, text, uuid), public.uniform_ppe_register(uuid, text, uuid, boolean), public.create_uniform_requisition(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uniform_ppe_needs(uuid, text, uuid), public.uniform_ppe_register(uuid, text, uuid, boolean), public.create_uniform_requisition(uuid, text, uuid) TO authenticated, service_role;
