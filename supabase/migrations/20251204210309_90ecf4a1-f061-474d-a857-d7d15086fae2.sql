-- 1. Create Super Admin Audit Logs table for security tracking
CREATE TABLE IF NOT EXISTS public.super_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_organization_id UUID,
  affected_table TEXT,
  affected_record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.super_admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view all audit logs"
ON public.super_admin_audit_logs
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Only system can insert audit logs (via security definer function)
CREATE POLICY "System can insert audit logs"
ON public.super_admin_audit_logs
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- 2. Create function to log super admin actions
CREATE OR REPLACE FUNCTION public.log_super_admin_action(
  _action TEXT,
  _target_org_id UUID DEFAULT NULL,
  _affected_table TEXT DEFAULT NULL,
  _affected_record_id UUID DEFAULT NULL,
  _old_data JSONB DEFAULT NULL,
  _new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.super_admin_audit_logs (
    super_admin_id,
    action,
    target_organization_id,
    affected_table,
    affected_record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    _action,
    _target_org_id,
    _affected_table,
    _affected_record_id,
    _old_data,
    _new_data
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;

-- 3. Create user_sessions table for session management
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON public.user_sessions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own sessions"
ON public.user_sessions
FOR ALL
USING (user_id = auth.uid());

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_logs_admin_id ON public.super_admin_audit_logs(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_logs_created_at ON public.super_admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_logs_action ON public.super_admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- 5. Create login_attempts table for security
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Super admins can view all login attempts
CREATE POLICY "Super admins can view login attempts"
ON public.login_attempts
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Anyone can insert login attempts (for tracking)
CREATE POLICY "Anyone can insert login attempts"
ON public.login_attempts
FOR INSERT
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON public.login_attempts(created_at DESC);

-- 6. Add asset_categories count function
CREATE OR REPLACE FUNCTION public.get_asset_categories_count(_org_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.asset_categories
  WHERE active = true
    AND (_org_id IS NULL OR organization_id = _org_id);
$$;

-- 7. Add function to get comprehensive system stats for super admin
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RETURN '{}'::JSONB;
  END IF;
  
  SELECT jsonb_build_object(
    'total_organizations', (SELECT COUNT(*) FROM organizations),
    'active_organizations', (SELECT COUNT(*) FROM organizations WHERE active = true),
    'total_users', (SELECT COUNT(*) FROM user_roles),
    'total_trainees', (SELECT COUNT(*) FROM trainees),
    'total_trainers', (SELECT COUNT(*) FROM trainers),
    'total_rooms', (SELECT COUNT(*) FROM hostel_rooms),
    'total_capacity', (SELECT COALESCE(SUM(capacity), 0) FROM hostel_rooms),
    'current_occupancy', (SELECT COALESCE(SUM(current_occupancy), 0) FROM hostel_rooms),
    'total_assets', (SELECT COUNT(*) FROM assets WHERE active = true),
    'total_stock_categories', (SELECT COUNT(*) FROM stock_categories WHERE active = true),
    'total_stock_items', (SELECT COUNT(*) FROM stock_items WHERE active = true),
    'active_packages', (SELECT COUNT(*) FROM organization_packages WHERE status = 'active'),
    'trial_packages', (SELECT COUNT(*) FROM organization_packages WHERE status = 'active' AND is_trial = true),
    'total_revenue', (SELECT COALESCE(SUM(amount), 0) FROM billing_records WHERE status = 'paid'),
    'pending_payments', (SELECT COALESCE(SUM(amount), 0) FROM billing_records WHERE status = 'pending')
  ) INTO result;
  
  RETURN result;
END;
$$;