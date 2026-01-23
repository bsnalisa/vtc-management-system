-- Add procurement_officer role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'procurement_officer';

-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  tax_number TEXT,
  address TEXT,
  payment_terms TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_requisitions table
CREATE TABLE IF NOT EXISTS public.purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  requisition_number TEXT NOT NULL,
  requested_by UUID NOT NULL,
  requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department TEXT,
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by UUID,
  approved_date DATE,
  rejected_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_requisition_items table
CREATE TABLE IF NOT EXISTS public.purchase_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES public.stock_items(id),
  item_description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  estimated_unit_cost NUMERIC NOT NULL,
  total_estimated_cost NUMERIC GENERATED ALWAYS AS (quantity * estimated_unit_cost) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  po_number TEXT NOT NULL,
  requisition_id UUID REFERENCES public.purchase_requisitions(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES public.stock_items(id),
  item_description TEXT NOT NULL,
  quantity_ordered NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create receiving_reports table
CREATE TABLE IF NOT EXISTS public.receiving_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id),
  receipt_number TEXT NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID NOT NULL,
  inspection_status TEXT NOT NULL DEFAULT 'pending',
  inspector_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create receiving_report_items table
CREATE TABLE IF NOT EXISTS public.receiving_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_report_id UUID NOT NULL REFERENCES public.receiving_reports(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id),
  quantity_received NUMERIC NOT NULL,
  quantity_accepted NUMERIC NOT NULL,
  quantity_rejected NUMERIC NOT NULL DEFAULT 0,
  condition_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create department_budgets table
CREATE TABLE IF NOT EXISTS public.department_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  department TEXT NOT NULL,
  budget_year TEXT NOT NULL,
  total_budget NUMERIC NOT NULL,
  spent_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC GENERATED ALWAYS AS (total_budget - spent_amount) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, department, budget_year)
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Users can view suppliers in their organization"
  ON public.suppliers FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Procurement officers and admins can manage suppliers"
  ON public.suppliers FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'procurement_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for purchase_requisitions
CREATE POLICY "Users can view requisitions in their organization"
  ON public.purchase_requisitions FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can create requisitions"
  ON public.purchase_requisitions FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Procurement officers and admins can manage requisitions"
  ON public.purchase_requisitions FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'procurement_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for purchase_requisition_items
CREATE POLICY "Users can view requisition items"
  ON public.purchase_requisition_items FOR SELECT
  USING (
    requisition_id IN (
      SELECT id FROM public.purchase_requisitions
      WHERE organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Users can manage requisition items"
  ON public.purchase_requisition_items FOR ALL
  USING (
    requisition_id IN (
      SELECT id FROM public.purchase_requisitions
      WHERE organization_id = get_user_organization(auth.uid())
    )
  );

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view purchase orders in their organization"
  ON public.purchase_orders FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Procurement officers and admins can manage purchase orders"
  ON public.purchase_orders FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'procurement_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for purchase_order_items
CREATE POLICY "Users can view PO items"
  ON public.purchase_order_items FOR SELECT
  USING (
    purchase_order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Procurement officers can manage PO items"
  ON public.purchase_order_items FOR ALL
  USING (
    purchase_order_id IN (
      SELECT id FROM public.purchase_orders
      WHERE organization_id = get_user_organization(auth.uid())
      AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'procurement_officer'::app_role))
    )
  );

-- RLS Policies for receiving_reports
CREATE POLICY "Users can view receiving reports in their organization"
  ON public.receiving_reports FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Procurement officers can manage receiving reports"
  ON public.receiving_reports FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'procurement_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for receiving_report_items
CREATE POLICY "Users can view receiving report items"
  ON public.receiving_report_items FOR SELECT
  USING (
    receiving_report_id IN (
      SELECT id FROM public.receiving_reports
      WHERE organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Procurement officers can manage receiving report items"
  ON public.receiving_report_items FOR ALL
  USING (
    receiving_report_id IN (
      SELECT id FROM public.receiving_reports
      WHERE organization_id = get_user_organization(auth.uid())
      AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'procurement_officer'::app_role))
    )
  );

-- RLS Policies for department_budgets
CREATE POLICY "Users can view budgets in their organization"
  ON public.department_budgets FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and procurement officers can manage budgets"
  ON public.department_budgets FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'procurement_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Trigger to update stock when items are received
CREATE OR REPLACE FUNCTION public.update_stock_from_receiving()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_item_id UUID;
  v_unit_cost NUMERIC;
  v_org_id UUID;
  v_receipt_number TEXT;
BEGIN
  -- Get PO item details
  SELECT 
    poi.stock_item_id,
    poi.unit_cost,
    po.organization_id
  INTO v_stock_item_id, v_unit_cost, v_org_id
  FROM public.purchase_order_items poi
  JOIN public.purchase_orders po ON poi.purchase_order_id = po.id
  WHERE poi.id = NEW.po_item_id;

  -- Get receipt number
  SELECT receipt_number INTO v_receipt_number
  FROM public.receiving_reports
  WHERE id = NEW.receiving_report_id;

  -- Only update if stock_item_id is set and quantity is accepted
  IF v_stock_item_id IS NOT NULL AND NEW.quantity_accepted > 0 THEN
    -- Create stock movement for received items
    INSERT INTO public.stock_movements (
      organization_id,
      stock_item_id,
      movement_type,
      quantity,
      unit_cost,
      total_cost,
      movement_date,
      reference_number,
      notes,
      created_by
    ) VALUES (
      v_org_id,
      v_stock_item_id,
      'inflow',
      NEW.quantity_accepted,
      v_unit_cost,
      NEW.quantity_accepted * v_unit_cost,
      CURRENT_DATE,
      v_receipt_number,
      'From PO receiving: ' || COALESCE(NEW.condition_notes, ''),
      auth.uid()
    );

    -- Update PO item received quantity
    UPDATE public.purchase_order_items
    SET quantity_received = quantity_received + NEW.quantity_accepted
    WHERE id = NEW.po_item_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_from_receiving
  AFTER INSERT ON public.receiving_report_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_from_receiving();

-- Add updated_at triggers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_requisitions_updated_at BEFORE UPDATE ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receiving_reports_updated_at BEFORE UPDATE ON public.receiving_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_department_budgets_updated_at BEFORE UPDATE ON public.department_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();