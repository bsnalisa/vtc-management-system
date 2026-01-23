-- Create packages table for subscription tiers
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price NUMERIC(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annually')),
  module_access JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits JSONB NOT NULL DEFAULT '{
    "max_trainees": null,
    "max_trainers": null,
    "max_classes": null,
    "max_storage_mb": null
  }'::jsonb,
  description TEXT,
  features TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_trial BOOLEAN NOT NULL DEFAULT false,
  trial_days INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_packages table to track subscriptions
CREATE TABLE public.organization_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
  is_trial BOOLEAN NOT NULL DEFAULT false,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, package_id, status) -- Prevent duplicate active packages
);

-- Create billing_records table for payment tracking
CREATE TABLE public.billing_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  organization_package_id UUID REFERENCES public.organization_packages(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  invoice_no TEXT UNIQUE,
  payment_method TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_org_packages_org_status ON public.organization_packages(organization_id, status);
CREATE INDEX idx_billing_records_org ON public.billing_records(organization_id);
CREATE INDEX idx_billing_records_status ON public.billing_records(status);

-- Enable RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for packages
CREATE POLICY "Everyone can view active packages"
ON public.packages
FOR SELECT
USING (active = true);

CREATE POLICY "Super admins can manage packages"
ON public.packages
FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS Policies for organization_packages
CREATE POLICY "Organizations can view their packages"
ON public.organization_packages
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Super admins can manage organization packages"
ON public.organization_packages
FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS Policies for billing_records
CREATE POLICY "Organizations can view their billing records"
ON public.billing_records
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Admins can manage billing records"
ON public.billing_records
FOR ALL
USING (
  is_super_admin(auth.uid()) 
  OR (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()))
);

-- Add triggers for updated_at
CREATE TRIGGER update_packages_updated_at
BEFORE UPDATE ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_packages_updated_at
BEFORE UPDATE ON public.organization_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_records_updated_at
BEFORE UPDATE ON public.billing_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get organization's current active package
CREATE OR REPLACE FUNCTION public.get_organization_active_package(_org_id UUID)
RETURNS TABLE (
  package_id UUID,
  package_name TEXT,
  module_access JSONB,
  limits JSONB,
  is_trial BOOLEAN,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.module_access,
    p.limits,
    op.is_trial,
    op.end_date,
    op.status
  FROM public.organization_packages op
  JOIN public.packages p ON op.package_id = p.id
  WHERE op.organization_id = _org_id 
    AND op.status = 'active'
    AND (op.end_date IS NULL OR op.end_date > now())
  ORDER BY op.created_at DESC
  LIMIT 1;
$$;

-- Function to check if organization has module access
CREATE OR REPLACE FUNCTION public.organization_has_module(_org_id UUID, _module_code TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_packages op
    JOIN public.packages p ON op.package_id = p.id
    WHERE op.organization_id = _org_id
      AND op.status = 'active'
      AND (op.end_date IS NULL OR op.end_date > now())
      AND p.module_access ? _module_code
  );
$$;

-- Function to check if organization is within limits
CREATE OR REPLACE FUNCTION public.check_organization_limit(
  _org_id UUID,
  _limit_type TEXT,
  _current_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limit_value INTEGER;
BEGIN
  SELECT 
    CASE 
      WHEN p.limits->_limit_type IS NULL THEN NULL
      ELSE (p.limits->>_limit_type)::INTEGER
    END
  INTO limit_value
  FROM public.organization_packages op
  JOIN public.packages p ON op.package_id = p.id
  WHERE op.organization_id = _org_id
    AND op.status = 'active'
    AND (op.end_date IS NULL OR op.end_date > now())
  ORDER BY op.created_at DESC
  LIMIT 1;
  
  -- NULL means unlimited
  IF limit_value IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN _current_count < limit_value;
END;
$$;

-- Function to automatically expire trial packages
CREATE OR REPLACE FUNCTION public.expire_trial_packages()
RETURNS TABLE (
  organization_id UUID,
  package_name TEXT,
  expired_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.organization_packages op
  SET 
    status = 'expired',
    updated_at = now()
  FROM public.packages p
  WHERE op.package_id = p.id
    AND op.is_trial = true
    AND op.status = 'active'
    AND op.end_date IS NOT NULL
    AND op.end_date < now()
  RETURNING op.organization_id, p.name, op.end_date;
$$;

-- Insert default packages
INSERT INTO public.packages (name, price, billing_cycle, module_access, limits, description, features, active) VALUES
(
  'Basic',
  0.00,
  'monthly',
  '["trainee_management", "trainer_management", "basic_reporting"]'::jsonb,
  '{
    "max_trainees": 50,
    "max_trainers": 5,
    "max_classes": 10,
    "max_storage_mb": 100
  }'::jsonb,
  'Essential features for small training centers',
  ARRAY['Up to 50 trainees', 'Up to 5 trainers', 'Basic reporting', '100MB storage'],
  true
),
(
  'Extended',
  49.99,
  'monthly',
  '["trainee_management", "trainer_management", "class_management", "attendance_tracking", "fee_management", "advanced_reporting"]'::jsonb,
  '{
    "max_trainees": 200,
    "max_trainers": 20,
    "max_classes": 50,
    "max_storage_mb": 500
  }'::jsonb,
  'Advanced features for growing organizations',
  ARRAY['Up to 200 trainees', 'Up to 20 trainers', 'Class management', 'Attendance tracking', 'Fee management', '500MB storage'],
  true
),
(
  'Professional',
  99.99,
  'monthly',
  '["trainee_management", "trainer_management", "class_management", "attendance_tracking", "fee_management", "assessment_management", "timetable_management", "document_generation", "advanced_reporting", "api_access"]'::jsonb,
  '{
    "max_trainees": null,
    "max_trainers": null,
    "max_classes": null,
    "max_storage_mb": 5000
  }'::jsonb,
  'Complete solution for large training institutions',
  ARRAY['Unlimited trainees', 'Unlimited trainers', 'All modules', 'API access', '5GB storage', 'Priority support'],
  true
),
(
  '14-Day Trial',
  0.00,
  'monthly',
  '["trainee_management", "trainer_management", "class_management", "attendance_tracking", "fee_management", "assessment_management"]'::jsonb,
  '{
    "max_trainees": 20,
    "max_trainers": 3,
    "max_classes": 5,
    "max_storage_mb": 50
  }'::jsonb,
  'Try all basic features free for 14 days',
  ARRAY['14-day trial', 'Up to 20 trainees', 'Core features access'],
  true
)
ON CONFLICT (name) DO NOTHING;