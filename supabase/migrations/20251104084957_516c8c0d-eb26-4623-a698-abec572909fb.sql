-- Create asset categories table
CREATE TABLE public.asset_categories (
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

-- Create asset status enum
CREATE TYPE asset_status AS ENUM ('active', 'under_repair', 'disposed', 'in_storage', 'retired');

-- Create asset condition enum
CREATE TYPE asset_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'needs_repair');

-- Create assets table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.asset_categories(id) ON DELETE RESTRICT,
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  description TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_value NUMERIC(10,2),
  depreciation_rate NUMERIC(5,2) DEFAULT 0,
  useful_life_years INTEGER,
  warranty_expiry DATE,
  condition asset_condition NOT NULL DEFAULT 'good',
  status asset_status NOT NULL DEFAULT 'active',
  location TEXT,
  assigned_department TEXT,
  assigned_user UUID REFERENCES auth.users(id),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, asset_code)
);

-- Create asset maintenance records table
CREATE TABLE public.asset_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('routine', 'repair', 'inspection', 'calibration', 'upgrade')),
  maintenance_date DATE NOT NULL,
  next_maintenance_date DATE,
  cost NUMERIC(10,2),
  performed_by TEXT,
  description TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create asset depreciation records table
CREATE TABLE public.asset_depreciation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  depreciation_year INTEGER NOT NULL,
  opening_value NUMERIC(10,2) NOT NULL,
  depreciation_amount NUMERIC(10,2) NOT NULL,
  closing_value NUMERIC(10,2) NOT NULL,
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(asset_id, depreciation_year)
);

-- Create asset documents table
CREATE TABLE public.asset_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('warranty', 'receipt', 'manual', 'certificate', 'insurance', 'other')),
  document_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create asset audit logs table
CREATE TABLE public.asset_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_assets_org ON public.assets(organization_id);
CREATE INDEX idx_assets_category ON public.assets(category_id);
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_asset_maintenance_asset ON public.asset_maintenance(asset_id);
CREATE INDEX idx_asset_maintenance_date ON public.asset_maintenance(maintenance_date);
CREATE INDEX idx_asset_depreciation_asset ON public.asset_depreciation(asset_id);
CREATE INDEX idx_asset_documents_asset ON public.asset_documents(asset_id);

-- Enable RLS
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_categories
CREATE POLICY "Users can view categories in their organization"
  ON public.asset_categories FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage categories"
  ON public.asset_categories FOR ALL
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- RLS Policies for assets
CREATE POLICY "Users can view assets in their organization"
  ON public.assets FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage assets"
  ON public.assets FOR ALL
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- RLS Policies for asset_maintenance
CREATE POLICY "Users can view maintenance in their organization"
  ON public.asset_maintenance FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage maintenance"
  ON public.asset_maintenance FOR ALL
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- RLS Policies for asset_depreciation
CREATE POLICY "Users can view depreciation in their organization"
  ON public.asset_depreciation FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage depreciation"
  ON public.asset_depreciation FOR ALL
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- RLS Policies for asset_documents
CREATE POLICY "Users can view documents in their organization"
  ON public.asset_documents FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage documents"
  ON public.asset_documents FOR ALL
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- RLS Policies for asset_audit_logs
CREATE POLICY "Admins can view audit logs"
  ON public.asset_audit_logs FOR SELECT
  USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON public.asset_audit_logs FOR INSERT
  WITH CHECK (true);

-- Trigger to log asset changes
CREATE OR REPLACE FUNCTION public.log_asset_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.asset_audit_logs (organization_id, asset_id, action, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.organization_id, NEW.id, 'status_change', 'status', OLD.status::text, NEW.status::text, auth.uid());
    END IF;
    
    IF OLD.condition IS DISTINCT FROM NEW.condition THEN
      INSERT INTO public.asset_audit_logs (organization_id, asset_id, action, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.organization_id, NEW.id, 'condition_change', 'condition', OLD.condition::text, NEW.condition::text, auth.uid());
    END IF;
    
    IF OLD.assigned_user IS DISTINCT FROM NEW.assigned_user THEN
      INSERT INTO public.asset_audit_logs (organization_id, asset_id, action, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.organization_id, NEW.id, 'assignment_change', 'assigned_user', OLD.assigned_user::text, NEW.assigned_user::text, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_asset_changes
  AFTER UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_asset_changes();

-- Trigger to update updated_at
CREATE TRIGGER update_asset_categories_updated_at
  BEFORE UPDATE ON public.asset_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for asset documents
INSERT INTO storage.buckets (id, name, public) VALUES ('asset-documents', 'asset-documents', false);

-- Storage policies for asset documents
CREATE POLICY "Users can view asset documents in their org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'asset-documents' 
    AND auth.uid() IN (
      SELECT user_id FROM user_roles 
      WHERE organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Admins can upload asset documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'asset-documents' 
    AND is_admin(auth.uid())
  );

CREATE POLICY "Admins can delete asset documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'asset-documents' 
    AND is_admin(auth.uid())
  );

-- Insert the module
INSERT INTO public.modules (name, code, description, category, active)
VALUES (
  'Asset Management',
  'ASSET_MANAGEMENT',
  'Manage organizational assets including equipment, machinery, and computers. Track maintenance, depreciation, and asset lifecycle.',
  'Operations & Resources',
  true
);