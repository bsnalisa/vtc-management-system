-- Create stock categories table
CREATE TABLE public.stock_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Create stock items table
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.stock_categories(id) ON DELETE RESTRICT,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'units',
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(10,2) NOT NULL DEFAULT 0,
  location TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, item_code)
);

-- Create stock movements table
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('inflow', 'outflow', 'adjustment')),
  quantity NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  reference_number TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_to UUID REFERENCES public.trainers(id),
  issued_by UUID REFERENCES auth.users(id),
  department TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_stock_items_org ON public.stock_items(organization_id);
CREATE INDEX idx_stock_items_category ON public.stock_items(category_id);
CREATE INDEX idx_stock_movements_org ON public.stock_movements(organization_id);
CREATE INDEX idx_stock_movements_item ON public.stock_movements(stock_item_id);
CREATE INDEX idx_stock_movements_date ON public.stock_movements(movement_date);

-- Enable RLS
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_categories
CREATE POLICY "Users can view categories in their organization"
  ON public.stock_categories FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage categories"
  ON public.stock_categories FOR ALL
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- RLS Policies for stock_items
CREATE POLICY "Users can view stock items in their organization"
  ON public.stock_items FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage stock items"
  ON public.stock_items FOR ALL
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- RLS Policies for stock_movements
CREATE POLICY "Users can view movements in their organization"
  ON public.stock_movements FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Authorized users can create movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid()) 
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role))
  );

CREATE POLICY "Admins can manage movements"
  ON public.stock_movements FOR ALL
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- Trigger to update stock quantity on movement
CREATE OR REPLACE FUNCTION public.update_stock_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stock_items
    SET 
      current_quantity = CASE 
        WHEN NEW.movement_type = 'inflow' THEN current_quantity + NEW.quantity
        WHEN NEW.movement_type = 'outflow' THEN current_quantity - NEW.quantity
        WHEN NEW.movement_type = 'adjustment' THEN NEW.quantity
      END,
      updated_at = now()
    WHERE id = NEW.stock_item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_quantity
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_quantity();

-- Trigger to update updated_at
CREATE TRIGGER update_stock_categories_updated_at
  BEFORE UPDATE ON public.stock_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_items_updated_at
  BEFORE UPDATE ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the module
INSERT INTO public.modules (name, code, description, category, active)
VALUES (
  'Stock / Inventory Control',
  'STOCK_CONTROL',
  'Track consumables, materials, and tools. Manage stock levels, movements, and generate inventory reports.',
  'Operations & Resources',
  true
);