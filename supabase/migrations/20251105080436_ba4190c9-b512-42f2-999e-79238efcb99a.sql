-- Create maintenance request types enum
CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE maintenance_status AS ENUM ('pending', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled');
CREATE TYPE maintenance_type AS ENUM ('corrective', 'preventive', 'predictive', 'breakdown');

-- Maintenance requests table
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  request_number TEXT NOT NULL UNIQUE,
  asset_id UUID REFERENCES public.assets(id),
  requested_by UUID NOT NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  priority maintenance_priority NOT NULL DEFAULT 'medium',
  maintenance_type maintenance_type NOT NULL,
  status maintenance_status NOT NULL DEFAULT 'pending',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  estimated_cost NUMERIC,
  approved_by UUID,
  approved_date DATE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Maintenance schedules table (for preventive maintenance)
CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  schedule_number TEXT NOT NULL UNIQUE,
  asset_id UUID REFERENCES public.assets(id),
  title TEXT NOT NULL,
  description TEXT,
  maintenance_type maintenance_type NOT NULL DEFAULT 'preventive',
  frequency_type TEXT NOT NULL,
  frequency_interval INTEGER NOT NULL DEFAULT 1,
  last_maintenance_date DATE,
  next_maintenance_date DATE NOT NULL,
  estimated_duration_hours NUMERIC,
  estimated_cost NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Maintenance tasks table
CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  task_number TEXT NOT NULL UNIQUE,
  request_id UUID REFERENCES public.maintenance_requests(id),
  schedule_id UUID REFERENCES public.maintenance_schedules(id),
  asset_id UUID REFERENCES public.assets(id),
  assigned_to UUID,
  assigned_by UUID NOT NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  priority maintenance_priority NOT NULL DEFAULT 'medium',
  status maintenance_status NOT NULL DEFAULT 'pending',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  scheduled_start_date DATE,
  scheduled_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  work_performed TEXT,
  completion_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Maintenance materials table
CREATE TABLE IF NOT EXISTS public.maintenance_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES public.stock_items(id),
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Maintenance costs table
CREATE TABLE IF NOT EXISTS public.maintenance_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  invoice_number TEXT,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for maintenance_requests
CREATE POLICY "Users can view requests in their organization"
  ON public.maintenance_requests
  FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Authorized users can create requests"
  ON public.maintenance_requests
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid()) AND
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'trainer'::app_role) OR has_role(auth.uid(), 'maintenance_coordinator'::app_role))
  );

CREATE POLICY "Coordinators and admins can manage requests"
  ON public.maintenance_requests
  FOR ALL
  USING (
    organization_id = get_user_organization(auth.uid()) AND
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'maintenance_coordinator'::app_role))
  );

-- RLS Policies for maintenance_schedules
CREATE POLICY "Users can view schedules in their organization"
  ON public.maintenance_schedules
  FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Coordinators and admins can manage schedules"
  ON public.maintenance_schedules
  FOR ALL
  USING (
    organization_id = get_user_organization(auth.uid()) AND
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'maintenance_coordinator'::app_role))
  );

-- RLS Policies for maintenance_tasks
CREATE POLICY "Users can view tasks in their organization"
  ON public.maintenance_tasks
  FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Coordinators and admins can manage tasks"
  ON public.maintenance_tasks
  FOR ALL
  USING (
    organization_id = get_user_organization(auth.uid()) AND
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'maintenance_coordinator'::app_role))
  );

-- RLS Policies for maintenance_materials
CREATE POLICY "Users can view materials for tasks in their organization"
  ON public.maintenance_materials
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM public.maintenance_tasks
      WHERE organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Coordinators and admins can manage materials"
  ON public.maintenance_materials
  FOR ALL
  USING (
    task_id IN (
      SELECT id FROM public.maintenance_tasks
      WHERE organization_id = get_user_organization(auth.uid()) AND
      (is_admin(auth.uid()) OR has_role(auth.uid(), 'maintenance_coordinator'::app_role))
    )
  );

-- RLS Policies for maintenance_costs
CREATE POLICY "Users can view costs for tasks in their organization"
  ON public.maintenance_costs
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM public.maintenance_tasks
      WHERE organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Coordinators and admins can manage costs"
  ON public.maintenance_costs
  FOR ALL
  USING (
    task_id IN (
      SELECT id FROM public.maintenance_tasks
      WHERE organization_id = get_user_organization(auth.uid()) AND
      (is_admin(auth.uid()) OR has_role(auth.uid(), 'maintenance_coordinator'::app_role))
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_schedules_updated_at
  BEFORE UPDATE ON public.maintenance_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_tasks_updated_at
  BEFORE UPDATE ON public.maintenance_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_costs_updated_at
  BEFORE UPDATE ON public.maintenance_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_maintenance_requests_org ON public.maintenance_requests(organization_id);
CREATE INDEX idx_maintenance_requests_status ON public.maintenance_requests(status);
CREATE INDEX idx_maintenance_requests_asset ON public.maintenance_requests(asset_id);
CREATE INDEX idx_maintenance_schedules_org ON public.maintenance_schedules(organization_id);
CREATE INDEX idx_maintenance_schedules_asset ON public.maintenance_schedules(asset_id);
CREATE INDEX idx_maintenance_schedules_next_date ON public.maintenance_schedules(next_maintenance_date);
CREATE INDEX idx_maintenance_tasks_org ON public.maintenance_tasks(organization_id);
CREATE INDEX idx_maintenance_tasks_status ON public.maintenance_tasks(status);
CREATE INDEX idx_maintenance_tasks_assigned ON public.maintenance_tasks(assigned_to);