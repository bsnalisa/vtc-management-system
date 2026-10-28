-- Phase 2 of the requisition programme: procurement, goods receipt and closure for approved requisitions.
--  * The Procurement Officer records supplier/quotation, the order (reference, date, expected delivery), delays, notes and documents; an order
--    reference never means the goods are received.
--  * A receiving officer (stock control officer or asset and maintenance coordinator; the Procurement Officer only where the centre has neither,
--    so ordering and receiving stay with different people) records each delivery against the individual item rows: accepted, damaged, incorrect
--    and missing quantities. Partial deliveries are supported, outstanding quantities are calculated, and receiving more than is outstanding is refused.
--  * Damaged, incorrect and missing goods open discrepancies that must be resolved before the requisition can be closed. A requisition is
--    Fully Received only when every item is accounted for, and Closed only after the discrepancy check, with who and when recorded.
-- Receipts and the procurement log are append-only; status moves only through these functions (guard from phase 1).

ALTER TABLE public.purchase_requisition_items ADD COLUMN IF NOT EXISTS cancelled_quantity integer NOT NULL DEFAULT 0 CHECK (cancelled_quantity >= 0);
ALTER TABLE public.purchase_requisitions ADD COLUMN IF NOT EXISTS closed_at timestamptz, ADD COLUMN IF NOT EXISTS closed_by uuid;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.requisition_procurement (
  requisition_id uuid NOT NULL PRIMARY KEY REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  supplier_name text, quotation_reference text, order_reference text,
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  order_date date, expected_delivery date, notes text,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.requisition_procurement_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('started', 'quotation', 'order_placed', 'delay', 'note', 'receipt', 'discrepancy_raised', 'discrepancy_resolved', 'closed', 'cancelled', 'document')),
  comment text, details jsonb NOT NULL DEFAULT '{}'::jsonb,
  by_user uuid, by_name text, by_role text, at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_req_proc_events ON public.requisition_procurement_events (requisition_id, at);

CREATE TABLE public.requisition_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  receipt_no text NOT NULL,
  delivery_date date NOT NULL,
  comments text,
  received_by uuid NOT NULL, received_by_name text, received_by_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, receipt_no)
);
CREATE INDEX idx_req_receipts_req ON public.requisition_receipts (requisition_id, created_at);

CREATE TABLE public.requisition_receipt_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id uuid NOT NULL REFERENCES public.requisition_receipts(id) ON DELETE CASCADE,
  requisition_item_id uuid NOT NULL REFERENCES public.purchase_requisition_items(id),
  accepted integer NOT NULL DEFAULT 0 CHECK (accepted >= 0),
  damaged integer NOT NULL DEFAULT 0 CHECK (damaged >= 0),
  incorrect integer NOT NULL DEFAULT 0 CHECK (incorrect >= 0),
  missing integer NOT NULL DEFAULT 0 CHECK (missing >= 0),
  note text
);
CREATE INDEX idx_req_receipt_items_item ON public.requisition_receipt_items (requisition_item_id);

CREATE TABLE public.requisition_discrepancies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  requisition_item_id uuid NOT NULL REFERENCES public.purchase_requisition_items(id),
  receipt_id uuid REFERENCES public.requisition_receipts(id),
  kind text NOT NULL CHECK (kind IN ('damaged', 'incorrect', 'missing', 'other')),
  quantity integer NOT NULL CHECK (quantity > 0),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution text CHECK (resolution IN ('replaced', 'credited', 'cancelled', 'other')),
  resolution_note text,
  raised_by uuid, raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid, resolved_at timestamptz
);
CREATE INDEX idx_req_disc_req ON public.requisition_discrepancies (requisition_id, status);

CREATE TABLE public.requisition_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('quotation', 'order', 'delivery', 'other')),
  file_path text NOT NULL, file_name text NOT NULL,
  uploaded_by uuid, uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_req_docs_req ON public.requisition_documents (requisition_id);

CREATE TRIGGER trg_req_proc_events_append_only BEFORE UPDATE OR DELETE ON public.requisition_procurement_events FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();
CREATE TRIGGER trg_req_receipts_append_only BEFORE UPDATE OR DELETE ON public.requisition_receipts FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();
CREATE TRIGGER trg_req_receipt_items_append_only BEFORE UPDATE OR DELETE ON public.requisition_receipt_items FOR EACH ROW EXECUTE FUNCTION public.requisition_append_only();

-- ---------------------------------------------------------------------------
-- Who can see them (reads only; every write goes through the functions below)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_can_view(_user uuid, _req uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.purchase_requisitions r
     WHERE r.id = _req
       AND (r.requested_by = _user
         OR public.has_org_role(_user, r.organization_id, ARRAY['centre_manager'])
         OR (r.status NOT IN ('draft', 'submitted', 'pending_line_supervisor', 'returned_for_correction', 'not_recommended', 'pending_accountant', 'funding_not_available',
                              'pending_head_finance', 'pending_centre_manager', 'not_approved', 'cancelled')
             AND public.has_org_role(_user, r.organization_id, ARRAY['procurement_officer']))
         OR (r.status = 'cancelled' AND EXISTS (SELECT 1 FROM public.requisition_decisions d WHERE d.requisition_id = r.id AND d.decision = 'approve')
             AND public.has_org_role(_user, r.organization_id, ARRAY['procurement_officer']))
         OR (r.status IN ('order_placed', 'delivery_outstanding', 'partially_received', 'fully_received', 'closed')
             AND public.has_org_role(_user, r.organization_id, ARRAY['stock_control_officer', 'asset_maintenance_coordinator']))
         OR EXISTS (SELECT 1 FROM public.requisition_decisions d WHERE d.requisition_id = r.id AND d.decided_by = _user)
         OR (r.workflow_instance_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.instance_id = r.workflow_instance_id AND public.workflow_can_act(_user, t.id)))));
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['requisition_procurement', 'requisition_procurement_events', 'requisition_receipts', 'requisition_discrepancies', 'requisition_documents'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Visible with the requisition" ON public.%I FOR SELECT TO authenticated USING (public.requisition_can_view(auth.uid(), requisition_id))', t);
    EXECUTE format('CREATE POLICY "Centre isolation" ON public.%I AS RESTRICTIVE FOR ALL USING (NOT (SELECT public.is_centre_scoped_user()) OR (SELECT r.organization_id FROM public.purchase_requisitions r WHERE r.id = %I.requisition_id) = ANY ((SELECT public.my_centre_ids())::uuid[])) WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR (SELECT r.organization_id FROM public.purchase_requisitions r WHERE r.id = %I.requisition_id) = ANY ((SELECT public.my_centre_ids())::uuid[]))', t, t, t);
  END LOOP;
  EXECUTE 'ALTER TABLE public.requisition_receipt_items ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY "Visible with the receipt" ON public.requisition_receipt_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.requisition_receipts rc WHERE rc.id = receipt_id AND public.requisition_can_view(auth.uid(), rc.requisition_id)))';
  EXECUTE 'CREATE POLICY "Centre isolation" ON public.requisition_receipt_items AS RESTRICTIVE FOR ALL USING (NOT (SELECT public.is_centre_scoped_user()) OR (SELECT rc.organization_id FROM public.requisition_receipts rc WHERE rc.id = receipt_id) = ANY ((SELECT public.my_centre_ids())::uuid[])) WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR (SELECT rc.organization_id FROM public.requisition_receipts rc WHERE rc.id = receipt_id) = ANY ((SELECT public.my_centre_ids())::uuid[]))';
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.requisition_procurement, public.requisition_procurement_events, public.requisition_receipts, public.requisition_receipt_items, public.requisition_discrepancies, public.requisition_documents FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- may this caller record deliveries? Ordering and receiving stay with different people wherever the centre has a receiving officer
CREATE OR REPLACE FUNCTION private.requisition_can_receive(_user uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_user, _org, ARRAY['stock_control_officer', 'asset_maintenance_coordinator'])
      OR (public.has_org_role(_user, _org, ARRAY['procurement_officer'])
          AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.organization_id = _org AND ur.role::text IN ('stock_control_officer', 'asset_maintenance_coordinator')))
$$;
REVOKE ALL ON FUNCTION private.requisition_can_receive(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.requisition_log(_req uuid, _event text, _comment text, _details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; p jsonb;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _req;
  p := private.requisition_person(r.organization_id, auth.uid());
  INSERT INTO public.requisition_procurement_events (requisition_id, event, comment, details, by_user, by_name, by_role)
    VALUES (_req, _event, nullif(trim(coalesce(_comment, '')), ''), coalesce(_details, '{}'::jsonb), auth.uid(), p ->> 'name', p ->> 'role');
END $$;
REVOKE ALL ON FUNCTION private.requisition_log(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.requisition_notify(_req uuid, _user uuid, _title text, _message text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _req;
  IF _user IS NULL OR _user = auth.uid() THEN RETURN; END IF;
  PERFORM public.workflow_notify(r.organization_id, _user, 'completed', _title, _message, '/requisitions/' || _req::text, r.requisition_number || E'\n' || _message);
END $$;
REVOKE ALL ON FUNCTION private.requisition_notify(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.requisition_lock(_id uuid, _roles text[], _statuses text[], _what text) RETURNS public.purchase_requisitions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  IF NOT public.has_org_role(auth.uid(), r.organization_id, _roles) THEN RAISE EXCEPTION 'Not authorised to %', _what USING ERRCODE = '42501'; END IF;
  IF r.status <> ALL (_statuses) THEN RAISE EXCEPTION 'This requisition cannot % while it is "%"', _what, replace(r.status, '_', ' '); END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.requisition_lock(uuid, text[], text[], text) FROM PUBLIC, anon, authenticated;

-- quantities per item: ordered (after cancellations), accepted so far, outstanding
CREATE OR REPLACE FUNCTION private.requisition_item_progress(_req uuid)
RETURNS TABLE (item_id uuid, line_no integer, description text, requested integer, cancelled integer, ordered integer, accepted bigint, outstanding bigint, damaged bigint, incorrect bigint, missing bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.line_no, i.item_description, i.quantity, i.cancelled_quantity, i.quantity - i.cancelled_quantity,
         coalesce(sum(ri.accepted), 0), greatest(i.quantity - i.cancelled_quantity - coalesce(sum(ri.accepted), 0), 0),
         coalesce(sum(ri.damaged), 0), coalesce(sum(ri.incorrect), 0), coalesce(sum(ri.missing), 0)
    FROM public.purchase_requisition_items i
    LEFT JOIN public.requisition_receipt_items ri ON ri.requisition_item_id = i.id
   WHERE i.requisition_id = _req GROUP BY i.id ORDER BY i.line_no
$$;
REVOKE ALL ON FUNCTION private.requisition_item_progress(uuid) FROM PUBLIC, anon, authenticated;

-- after a receipt or a resolution: partially or fully received
CREATE OR REPLACE FUNCTION private.requisition_recompute(_req uuid, _reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; _out bigint; _acc bigint; _to text;
BEGIN
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _req;
  SELECT coalesce(sum(outstanding), 0), coalesce(sum(accepted), 0) INTO _out, _acc FROM private.requisition_item_progress(_req);
  _to := CASE WHEN _out = 0 THEN 'fully_received' WHEN _acc > 0 THEN 'partially_received' ELSE r.status END;
  IF _to <> r.status AND r.status NOT IN ('closed', 'cancelled') THEN PERFORM private.requisition_set_status(_req, _to, _reason); RETURN _to; END IF;
  RETURN r.status;
END $$;
REVOKE ALL ON FUNCTION private.requisition_recompute(uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Procurement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_procurement_save(_id uuid, _supplier_id uuid, _supplier_name text, _quotation_reference text, _notes text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  r := private.requisition_lock(_id, ARRAY['procurement_officer'], ARRAY['approved_awaiting_procurement', 'procurement_in_progress', 'order_placed', 'delivery_outstanding'], 'update procurement');
  IF _supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = _supplier_id AND s.organization_id = r.organization_id) THEN RAISE EXCEPTION 'That supplier is not registered at this centre'; END IF;
  IF length(coalesce(_supplier_name, '')) > 200 OR length(coalesce(_quotation_reference, '')) > 100 OR length(coalesce(_notes, '')) > 4000 THEN RAISE EXCEPTION 'One of the entries is too long'; END IF;
  INSERT INTO public.requisition_procurement (requisition_id, organization_id, supplier_id, supplier_name, quotation_reference, notes, updated_by)
    VALUES (_id, r.organization_id, _supplier_id, nullif(trim(_supplier_name), ''), nullif(trim(_quotation_reference), ''), nullif(trim(_notes), ''), auth.uid())
    ON CONFLICT (requisition_id) DO UPDATE SET supplier_id = EXCLUDED.supplier_id, supplier_name = EXCLUDED.supplier_name, quotation_reference = EXCLUDED.quotation_reference,
      notes = EXCLUDED.notes, updated_by = auth.uid(), updated_at = now();
  IF r.status = 'approved_awaiting_procurement' THEN
    PERFORM private.requisition_set_status(_id, 'procurement_in_progress', 'Procurement started');
    PERFORM private.requisition_log(_id, 'started', NULL, '{}');
    PERFORM private.requisition_notify(_id, r.requested_by, 'Procurement started: ' || r.requisition_number, 'The Procurement Officer has started procuring your approved requisition.');
  END IF;
  PERFORM private.requisition_log(_id, 'quotation', _notes, jsonb_build_object('supplier', _supplier_name, 'quotation_reference', _quotation_reference));
END $$;

CREATE OR REPLACE FUNCTION public.requisition_place_order(_id uuid, _supplier_name text, _order_reference text, _order_date date, _expected_delivery date, _purchase_order uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  r := private.requisition_lock(_id, ARRAY['procurement_officer'], ARRAY['approved_awaiting_procurement', 'procurement_in_progress'], 'place an order');
  IF coalesce(trim(_order_reference), '') = '' THEN RAISE EXCEPTION 'Enter the order or purchase order reference'; END IF;
  IF coalesce(trim(_supplier_name), '') = '' AND NOT EXISTS (SELECT 1 FROM public.requisition_procurement p WHERE p.requisition_id = _id AND coalesce(trim(p.supplier_name), '') <> '') THEN RAISE EXCEPTION 'Record the supplier before placing the order'; END IF;
  IF _order_date IS NULL OR _expected_delivery IS NULL THEN RAISE EXCEPTION 'Enter the order date and the expected delivery date'; END IF;
  IF _order_date > current_date THEN RAISE EXCEPTION 'The order date cannot be in the future'; END IF;
  IF _expected_delivery < _order_date THEN RAISE EXCEPTION 'The expected delivery cannot be before the order date'; END IF;
  IF _purchase_order IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = _purchase_order AND po.organization_id = r.organization_id) THEN RAISE EXCEPTION 'That purchase order is not at this centre'; END IF;
  INSERT INTO public.requisition_procurement (requisition_id, organization_id, supplier_name, order_reference, purchase_order_id, order_date, expected_delivery, updated_by)
    VALUES (_id, r.organization_id, nullif(trim(_supplier_name), ''), trim(_order_reference), _purchase_order, _order_date, _expected_delivery, auth.uid())
    ON CONFLICT (requisition_id) DO UPDATE SET supplier_name = coalesce(nullif(trim(_supplier_name), ''), requisition_procurement.supplier_name), order_reference = trim(_order_reference),
      purchase_order_id = _purchase_order, order_date = _order_date, expected_delivery = _expected_delivery, updated_by = auth.uid(), updated_at = now();
  PERFORM private.requisition_set_status(_id, 'order_placed', 'Order ' || trim(_order_reference) || ' placed; delivery expected ' || to_char(_expected_delivery, 'DD/MM/YYYY'));
  PERFORM private.requisition_log(_id, 'order_placed', NULL, jsonb_build_object('order_reference', trim(_order_reference), 'order_date', _order_date, 'expected_delivery', _expected_delivery));
  PERFORM private.requisition_notify(_id, r.requested_by, 'Order placed: ' || r.requisition_number, 'Your requisition has been ordered. Delivery is expected on ' || to_char(_expected_delivery, 'DD/MM/YYYY') || '.');
  PERFORM private.requisition_notify(_id, u.user_id, 'Delivery expected: ' || r.requisition_number, 'Goods are expected on ' || to_char(_expected_delivery, 'DD/MM/YYYY') || '.')
    FROM (SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = r.organization_id AND role::text IN ('stock_control_officer', 'asset_maintenance_coordinator')) u;
END $$;

CREATE OR REPLACE FUNCTION public.requisition_record_delay(_id uuid, _new_expected date, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  r := private.requisition_lock(_id, ARRAY['procurement_officer'], ARRAY['order_placed', 'delivery_outstanding', 'partially_received'], 'record a delay');
  IF coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Give the reason for the delay'; END IF;
  IF _new_expected IS NULL OR _new_expected < current_date THEN RAISE EXCEPTION 'Enter a new expected delivery date that is not in the past'; END IF;
  UPDATE public.requisition_procurement SET expected_delivery = _new_expected, updated_by = auth.uid(), updated_at = now() WHERE requisition_id = _id;
  IF r.status = 'order_placed' THEN PERFORM private.requisition_set_status(_id, 'delivery_outstanding', 'Delivery delayed: ' || trim(_reason)); END IF;
  PERFORM private.requisition_log(_id, 'delay', _reason, jsonb_build_object('new_expected_delivery', _new_expected));
  PERFORM private.requisition_notify(_id, r.requested_by, 'Delivery delayed: ' || r.requisition_number, trim(_reason) || ' New expected date: ' || to_char(_new_expected, 'DD/MM/YYYY') || '.');
END $$;

CREATE OR REPLACE FUNCTION public.requisition_add_note(_id uuid, _comment text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id;
  IF NOT FOUND OR NOT (public.has_org_role(auth.uid(), r.organization_id, ARRAY['procurement_officer']) OR private.requisition_can_receive(auth.uid(), r.organization_id)) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF r.status NOT IN ('approved_awaiting_procurement', 'procurement_in_progress', 'order_placed', 'delivery_outstanding', 'partially_received', 'fully_received') THEN RAISE EXCEPTION 'Notes can be added once the requisition is approved and until it is closed'; END IF;
  IF coalesce(trim(_comment), '') = '' OR length(_comment) > 4000 THEN RAISE EXCEPTION 'Write the note (up to 4000 characters)'; END IF;
  PERFORM private.requisition_log(_id, 'note', _comment, '{}');
END $$;

CREATE OR REPLACE FUNCTION public.requisition_add_document(_id uuid, _kind text, _path text, _name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id;
  IF NOT FOUND OR NOT (public.has_org_role(auth.uid(), r.organization_id, ARRAY['procurement_officer']) OR private.requisition_can_receive(auth.uid(), r.organization_id)) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  IF r.status IN ('draft', 'closed', 'cancelled') OR r.status IN ('submitted', 'pending_line_supervisor', 'pending_accountant', 'pending_head_finance', 'pending_centre_manager', 'returned_for_correction', 'not_recommended', 'funding_not_available', 'not_approved') THEN
    RAISE EXCEPTION 'Documents can be added while the requisition is in procurement or delivery';
  END IF;
  IF _kind NOT IN ('quotation', 'order', 'delivery', 'other') THEN RAISE EXCEPTION 'Unknown document type'; END IF;
  IF _path NOT LIKE r.organization_id::text || '/requisitions/' || _id::text || '/%' OR position('..' IN _path) > 0 THEN RAISE EXCEPTION 'Upload the document from the requisition page'; END IF;
  INSERT INTO public.requisition_documents (requisition_id, kind, file_path, file_name, uploaded_by) VALUES (_id, _kind, _path, left(coalesce(_name, 'document'), 200), auth.uid());
  PERFORM private.requisition_log(_id, 'document', NULL, jsonb_build_object('kind', _kind, 'file', left(coalesce(_name, 'document'), 200)));
END $$;

-- ---------------------------------------------------------------------------
-- Receiving
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_record_receipt(_id uuid, _delivery_date date, _comments text, _lines jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; _rc uuid; _no text; l jsonb; it record; _acc integer; _dmg integer; _inc integer; _mis integer; _n integer := 0; _p jsonb; _to text; _po record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  IF NOT private.requisition_can_receive(auth.uid(), r.organization_id) THEN RAISE EXCEPTION 'Not authorised to record a delivery' USING ERRCODE = '42501'; END IF;
  IF r.status NOT IN ('order_placed', 'delivery_outstanding', 'partially_received') THEN RAISE EXCEPTION 'Goods can only be received after the order has been placed (status: %)', replace(r.status, '_', ' '); END IF;
  IF _delivery_date IS NULL OR _delivery_date > current_date THEN RAISE EXCEPTION 'The delivery date cannot be in the future'; END IF;
  IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'Enter what was delivered'; END IF;
  _p := private.requisition_person(r.organization_id, auth.uid());
  _no := 'GRN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.requisition_receipt_seq')::text, 6, '0');
  INSERT INTO public.requisition_receipts (requisition_id, organization_id, receipt_no, delivery_date, comments, received_by, received_by_name, received_by_role)
    VALUES (_id, r.organization_id, _no, _delivery_date, nullif(trim(coalesce(_comments, '')), ''), auth.uid(), _p ->> 'name', _p ->> 'role') RETURNING id INTO _rc;

  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    SELECT * INTO it FROM private.requisition_item_progress(_id) WHERE item_id = (l ->> 'item_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item in the delivery does not belong to this requisition'; END IF;
    _acc := coalesce(nullif(l ->> 'accepted', ''), '0')::integer; _dmg := coalesce(nullif(l ->> 'damaged', ''), '0')::integer;
    _inc := coalesce(nullif(l ->> 'incorrect', ''), '0')::integer; _mis := coalesce(nullif(l ->> 'missing', ''), '0')::integer;
    IF least(_acc, _dmg, _inc, _mis) < 0 THEN RAISE EXCEPTION 'Quantities cannot be negative'; END IF;
    CONTINUE WHEN _acc + _dmg + _inc + _mis = 0;
    IF _acc > it.outstanding THEN
      RAISE EXCEPTION 'Item %: % received is more than the % still outstanding', it.line_no, _acc, it.outstanding;
    END IF;
    IF _mis > it.outstanding - _acc THEN RAISE EXCEPTION 'Item %: more is reported missing than is still outstanding', it.line_no; END IF;
    _n := _n + 1;
    INSERT INTO public.requisition_receipt_items (receipt_id, requisition_item_id, accepted, damaged, incorrect, missing, note)
      VALUES (_rc, it.item_id, _acc, _dmg, _inc, _mis, nullif(trim(coalesce(l ->> 'note', '')), ''));
    IF _dmg > 0 THEN INSERT INTO public.requisition_discrepancies (requisition_id, requisition_item_id, receipt_id, kind, quantity, description, raised_by) VALUES (_id, it.item_id, _rc, 'damaged', _dmg, nullif(trim(coalesce(l ->> 'note', '')), ''), auth.uid()); END IF;
    IF _inc > 0 THEN INSERT INTO public.requisition_discrepancies (requisition_id, requisition_item_id, receipt_id, kind, quantity, description, raised_by) VALUES (_id, it.item_id, _rc, 'incorrect', _inc, nullif(trim(coalesce(l ->> 'note', '')), ''), auth.uid()); END IF;
    IF _mis > 0 THEN INSERT INTO public.requisition_discrepancies (requisition_id, requisition_item_id, receipt_id, kind, quantity, description, raised_by) VALUES (_id, it.item_id, _rc, 'missing', _mis, nullif(trim(coalesce(l ->> 'note', '')), ''), auth.uid()); END IF;
  END LOOP;
  IF _n = 0 THEN RAISE EXCEPTION 'Enter at least one quantity delivered, damaged, incorrect or missing'; END IF;

  _to := private.requisition_recompute(_id, 'Delivery ' || _no || ' recorded');
  IF _to = r.status AND r.status = 'order_placed' THEN PERFORM private.requisition_set_status(_id, 'delivery_outstanding', 'Delivery ' || _no || ' recorded; nothing accepted yet'); _to := 'delivery_outstanding'; END IF;
  PERFORM private.requisition_log(_id, 'receipt', _comments, jsonb_build_object('receipt_no', _no, 'delivery_date', _delivery_date, 'lines', _n));
  IF EXISTS (SELECT 1 FROM public.requisition_discrepancies WHERE receipt_id = _rc) THEN PERFORM private.requisition_log(_id, 'discrepancy_raised', _comments, jsonb_build_object('receipt_no', _no)); END IF;
  PERFORM private.requisition_notify(_id, r.requested_by, CASE WHEN _to = 'fully_received' THEN 'Fully received: ' ELSE 'Partial delivery received: ' END || r.requisition_number,
    CASE WHEN _to = 'fully_received' THEN 'Everything you asked for has been received.' ELSE 'A delivery was recorded; some items are still outstanding.' END);
  IF _to = 'fully_received' OR EXISTS (SELECT 1 FROM public.requisition_discrepancies WHERE receipt_id = _rc) THEN
    FOR _po IN SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = r.organization_id AND role::text = 'procurement_officer' LOOP
      PERFORM private.requisition_notify(_id, _po.user_id, CASE WHEN _to = 'fully_received' THEN 'Ready for closure: ' ELSE 'Delivery discrepancy: ' END || r.requisition_number,
        CASE WHEN _to = 'fully_received' THEN 'All items are received. Resolve any open discrepancies, then close the requisition.' ELSE 'Damaged, incorrect or missing goods were reported and need resolving.' END);
    END LOOP;
  END IF;
  RETURN jsonb_build_object('receipt_no', _no, 'status', _to);
END $$;
CREATE SEQUENCE IF NOT EXISTS public.requisition_receipt_seq;

CREATE OR REPLACE FUNCTION public.requisition_resolve_discrepancy(_disc uuid, _resolution text, _note text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.requisition_discrepancies%ROWTYPE; r public.purchase_requisitions%ROWTYPE; it record; _to text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM public.requisition_discrepancies WHERE id = _disc;
  IF NOT FOUND THEN RAISE EXCEPTION 'Discrepancy not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = d.requisition_id FOR UPDATE;
  IF NOT (public.has_org_role(auth.uid(), r.organization_id, ARRAY['procurement_officer']) OR private.requisition_can_receive(auth.uid(), r.organization_id)) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM public.requisition_discrepancies WHERE id = _disc FOR UPDATE;
  IF d.status <> 'open' THEN RAISE EXCEPTION 'This discrepancy has already been resolved'; END IF;
  IF r.status IN ('closed', 'cancelled') THEN RAISE EXCEPTION 'This requisition is closed'; END IF;
  IF _resolution NOT IN ('replaced', 'credited', 'cancelled', 'other') THEN RAISE EXCEPTION 'Choose how it was resolved'; END IF;
  IF coalesce(trim(_note), '') = '' THEN RAISE EXCEPTION 'Describe how it was resolved'; END IF;
  IF _resolution = 'cancelled' AND d.kind <> 'other' THEN
    SELECT * INTO it FROM private.requisition_item_progress(d.requisition_id) WHERE item_id = d.requisition_item_id;
    IF it.ordered - d.quantity < it.accepted THEN RAISE EXCEPTION 'Cancelling % unit(s) would leave less ordered than already accepted', d.quantity; END IF;
    IF d.kind = 'missing' OR d.kind IN ('damaged', 'incorrect') THEN
      UPDATE public.purchase_requisition_items SET cancelled_quantity = cancelled_quantity + d.quantity WHERE id = d.requisition_item_id;
    END IF;
    IF (SELECT coalesce(sum(ordered), 0) FROM private.requisition_item_progress(d.requisition_id)) = 0 THEN RAISE EXCEPTION 'Nothing would be left on the order; cancel the order instead'; END IF;
  END IF;
  UPDATE public.requisition_discrepancies SET status = 'resolved', resolution = _resolution, resolution_note = trim(_note), resolved_by = auth.uid(), resolved_at = now() WHERE id = _disc;
  PERFORM private.requisition_log(d.requisition_id, 'discrepancy_resolved', _note, jsonb_build_object('kind', d.kind, 'quantity', d.quantity, 'resolution', _resolution));
  _to := private.requisition_recompute(d.requisition_id, 'Discrepancy resolved: ' || _resolution);
  RETURN _to;
END $$;

-- ---------------------------------------------------------------------------
-- Closure and cancellation of the order
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_close(_id uuid, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  r := private.requisition_lock(_id, ARRAY['procurement_officer', 'centre_manager'], ARRAY['fully_received'], 'close');
  IF EXISTS (SELECT 1 FROM private.requisition_item_progress(_id) WHERE outstanding > 0) THEN RAISE EXCEPTION 'Items are still outstanding'; END IF;
  IF EXISTS (SELECT 1 FROM public.requisition_discrepancies WHERE requisition_id = _id AND status = 'open') THEN RAISE EXCEPTION 'Resolve the open delivery discrepancies before closing'; END IF;
  PERFORM set_config('app.requisition_fn', 'on', true);
  UPDATE public.purchase_requisitions SET closed_at = now(), closed_by = auth.uid() WHERE id = _id;
  PERFORM set_config('app.requisition_fn', 'off', true);
  PERFORM private.requisition_set_status(_id, 'closed', coalesce(nullif(trim(_note), ''), 'Closed'));
  PERFORM private.requisition_log(_id, 'closed', _note, '{}');
  PERFORM private.requisition_notify(_id, r.requested_by, 'Closed: ' || r.requisition_number, 'Your requisition is complete and has been closed.');
END $$;

CREATE OR REPLACE FUNCTION public.requisition_cancel_order(_id uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE;
BEGIN
  r := private.requisition_lock(_id, ARRAY['procurement_officer', 'centre_manager'], ARRAY['approved_awaiting_procurement', 'procurement_in_progress', 'order_placed', 'delivery_outstanding'], 'cancel');
  IF coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'Give a reason for cancelling'; END IF;
  IF EXISTS (SELECT 1 FROM public.requisition_receipts WHERE requisition_id = _id) THEN RAISE EXCEPTION 'Goods have already been received against this requisition; resolve it instead'; END IF;
  PERFORM private.requisition_set_status(_id, 'cancelled', 'Cancelled in procurement: ' || trim(_reason));
  PERFORM private.requisition_log(_id, 'cancelled', _reason, '{}');
  PERFORM private.requisition_notify(_id, r.requested_by, 'Cancelled: ' || r.requisition_number, trim(_reason));
END $$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_fulfilment(_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_requisitions%ROWTYPE; p public.requisition_procurement%ROWTYPE; _proc boolean; _recv boolean;
BEGIN
  IF NOT public.requisition_can_view(auth.uid(), _id) THEN RAISE EXCEPTION 'Requisition not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.purchase_requisitions WHERE id = _id;
  SELECT * INTO p FROM public.requisition_procurement WHERE requisition_id = _id;
  _proc := public.has_org_role(auth.uid(), r.organization_id, ARRAY['procurement_officer']);
  _recv := private.requisition_can_receive(auth.uid(), r.organization_id);
  RETURN jsonb_build_object(
    'procurement', CASE WHEN p.requisition_id IS NULL THEN NULL ELSE jsonb_build_object('supplier_id', p.supplier_id, 'supplier_name', p.supplier_name, 'quotation_reference', p.quotation_reference,
        'order_reference', p.order_reference, 'order_date', p.order_date, 'expected_delivery', p.expected_delivery, 'notes', p.notes) END,
    'overdue', p.expected_delivery IS NOT NULL AND p.expected_delivery < current_date AND r.status IN ('order_placed', 'delivery_outstanding', 'partially_received'),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('item_id', item_id, 'no', line_no, 'description', description, 'requested', requested, 'cancelled', cancelled, 'ordered', ordered,
        'accepted', accepted, 'outstanding', outstanding, 'damaged', damaged, 'incorrect', incorrect, 'missing', missing) ORDER BY line_no) FROM private.requisition_item_progress(_id)), '[]'::jsonb),
    'receipts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', rc.id, 'receipt_no', rc.receipt_no, 'delivery_date', rc.delivery_date, 'comments', rc.comments, 'by', rc.received_by_name, 'role', rc.received_by_role, 'at', rc.created_at,
        'lines', (SELECT coalesce(jsonb_agg(jsonb_build_object('item_id', ri.requisition_item_id, 'no', i.line_no, 'description', i.item_description, 'accepted', ri.accepted, 'damaged', ri.damaged, 'incorrect', ri.incorrect, 'missing', ri.missing, 'note', ri.note) ORDER BY i.line_no), '[]'::jsonb)
                    FROM public.requisition_receipt_items ri JOIN public.purchase_requisition_items i ON i.id = ri.requisition_item_id WHERE ri.receipt_id = rc.id)) ORDER BY rc.created_at)
        FROM public.requisition_receipts rc WHERE rc.requisition_id = _id), '[]'::jsonb),
    'discrepancies', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'item_no', i.line_no, 'description', i.item_description, 'kind', d.kind, 'quantity', d.quantity, 'note', d.description, 'status', d.status,
        'resolution', d.resolution, 'resolution_note', d.resolution_note, 'raised_at', d.raised_at, 'resolved_at', d.resolved_at) ORDER BY d.raised_at)
        FROM public.requisition_discrepancies d JOIN public.purchase_requisition_items i ON i.id = d.requisition_item_id WHERE d.requisition_id = _id), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('event', e.event, 'comment', e.comment, 'details', e.details, 'by', e.by_name, 'role', e.by_role, 'at', e.at) ORDER BY e.at, e.id)
        FROM public.requisition_procurement_events e WHERE e.requisition_id = _id), '[]'::jsonb),
    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'file_path', x.file_path, 'file_name', x.file_name, 'at', x.uploaded_at) ORDER BY x.uploaded_at) FROM public.requisition_documents x WHERE x.requisition_id = _id), '[]'::jsonb),
    'closed_at', r.closed_at,
    'can_procure', _proc AND r.status IN ('approved_awaiting_procurement', 'procurement_in_progress', 'order_placed', 'delivery_outstanding'),
    'can_place_order', _proc AND r.status IN ('approved_awaiting_procurement', 'procurement_in_progress'),
    'can_delay', _proc AND r.status IN ('order_placed', 'delivery_outstanding', 'partially_received'),
    'can_receive', _recv AND r.status IN ('order_placed', 'delivery_outstanding', 'partially_received'),
    'can_resolve', (_proc OR _recv) AND r.status NOT IN ('closed', 'cancelled') AND EXISTS (SELECT 1 FROM public.requisition_discrepancies WHERE requisition_id = _id AND status = 'open'),
    'can_close', (_proc OR public.has_org_role(auth.uid(), r.organization_id, ARRAY['centre_manager'])) AND r.status = 'fully_received'
                 AND NOT EXISTS (SELECT 1 FROM public.requisition_discrepancies WHERE requisition_id = _id AND status = 'open'),
    'can_cancel_order', (_proc OR public.has_org_role(auth.uid(), r.organization_id, ARRAY['centre_manager'])) AND r.status IN ('approved_awaiting_procurement', 'procurement_in_progress', 'order_placed', 'delivery_outstanding')
                 AND NOT EXISTS (SELECT 1 FROM public.requisition_receipts WHERE requisition_id = _id),
    'can_add_documents', (_proc OR _recv) AND r.status IN ('approved_awaiting_procurement', 'procurement_in_progress', 'order_placed', 'delivery_outstanding', 'partially_received', 'fully_received'));
END $$;

-- lists: procurement tracking (overdue, outstanding) and the receiving officer's queue
DO $$
DECLARE _def text; _old text;
BEGIN
  _def := pg_get_functiondef('public.requisition_list(text, text, text, integer, integer)'::regprocedure);
  _old := 'IF _scope NOT IN (''mine'', ''to_decide'', ''procurement'', ''centre'') THEN';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'requisition_list: scope check not found'; END IF;
  _def := replace(_def, _old, 'IF _scope NOT IN (''mine'', ''to_decide'', ''procurement'', ''receiving'', ''centre'') THEN');
  _old := 'WHEN ''procurement'' THEN';
  IF position(_old IN _def) = 0 THEN RAISE EXCEPTION 'requisition_list: procurement case not found'; END IF;
  _def := replace(_def, _old, 'WHEN ''receiving'' THEN private.requisition_can_receive(auth.uid(), r.organization_id) AND r.status IN (''order_placed'', ''delivery_outstanding'', ''partially_received'', ''fully_received'')' || E'\n               ' || _old);
  EXECUTE _def;
END $$;

REVOKE ALL ON FUNCTION public.requisition_procurement_save(uuid, uuid, text, text, text), public.requisition_place_order(uuid, text, text, date, date, uuid), public.requisition_record_delay(uuid, date, text),
  public.requisition_add_note(uuid, text), public.requisition_add_document(uuid, text, text, text), public.requisition_record_receipt(uuid, date, text, jsonb),
  public.requisition_resolve_discrepancy(uuid, text, text), public.requisition_close(uuid, text), public.requisition_cancel_order(uuid, text), public.requisition_fulfilment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_procurement_save(uuid, uuid, text, text, text), public.requisition_place_order(uuid, text, text, date, date, uuid), public.requisition_record_delay(uuid, date, text),
  public.requisition_add_note(uuid, text), public.requisition_add_document(uuid, text, text, text), public.requisition_record_receipt(uuid, date, text, jsonb),
  public.requisition_resolve_discrepancy(uuid, text, text), public.requisition_close(uuid, text), public.requisition_cancel_order(uuid, text), public.requisition_fulfilment(uuid) TO authenticated, service_role;

-- the Procurement Officer's dashboard figures, from the live requisitions of the caller's centre
CREATE OR REPLACE FUNCTION public.requisition_procurement_summary(_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_org_role(auth.uid(), _org, ARRAY['procurement_officer', 'centre_manager']) OR private.requisition_can_receive(auth.uid(), _org)) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'awaiting_procurement', (SELECT count(*) FROM public.purchase_requisitions WHERE organization_id = _org AND status = 'approved_awaiting_procurement'),
    'in_progress', (SELECT count(*) FROM public.purchase_requisitions WHERE organization_id = _org AND status = 'procurement_in_progress'),
    'orders_placed', (SELECT count(*) FROM public.purchase_requisitions WHERE organization_id = _org AND status IN ('order_placed', 'delivery_outstanding', 'partially_received')),
    'expected_next_7_days', (SELECT count(*) FROM public.purchase_requisitions r JOIN public.requisition_procurement p ON p.requisition_id = r.id
                              WHERE r.organization_id = _org AND r.status IN ('order_placed', 'delivery_outstanding', 'partially_received') AND p.expected_delivery BETWEEN current_date AND current_date + 7),
    'overdue', (SELECT count(*) FROM public.purchase_requisitions r JOIN public.requisition_procurement p ON p.requisition_id = r.id
                 WHERE r.organization_id = _org AND r.status IN ('order_placed', 'delivery_outstanding', 'partially_received') AND p.expected_delivery < current_date),
    'partially_received', (SELECT count(*) FROM public.purchase_requisitions WHERE organization_id = _org AND status = 'partially_received'),
    'outstanding_units', (SELECT coalesce(sum(greatest(i.quantity - i.cancelled_quantity - coalesce((SELECT sum(ri.accepted) FROM public.requisition_receipt_items ri WHERE ri.requisition_item_id = i.id), 0), 0)), 0)
                           FROM public.purchase_requisition_items i JOIN public.purchase_requisitions r ON r.id = i.requisition_id
                           WHERE r.organization_id = _org AND r.status IN ('order_placed', 'delivery_outstanding', 'partially_received')),
    'open_discrepancies', (SELECT count(*) FROM public.requisition_discrepancies d JOIN public.purchase_requisitions r ON r.id = d.requisition_id WHERE r.organization_id = _org AND d.status = 'open' AND r.status NOT IN ('closed', 'cancelled')),
    'ready_for_closure', (SELECT count(*) FROM public.purchase_requisitions r WHERE r.organization_id = _org AND r.status = 'fully_received'
                           AND NOT EXISTS (SELECT 1 FROM public.requisition_discrepancies d WHERE d.requisition_id = r.id AND d.status = 'open')));
END $$;
REVOKE ALL ON FUNCTION public.requisition_procurement_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requisition_procurement_summary(uuid) TO authenticated, service_role;
