-- Create role_activity_logs table for tracking user activity
CREATE TABLE IF NOT EXISTS public.role_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL,
  module_code VARCHAR NOT NULL,
  action VARCHAR NOT NULL, -- 'view', 'create', 'edit', 'delete'
  page_url VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own activity
CREATE POLICY "Users can view own activity"
  ON public.role_activity_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own activity
CREATE POLICY "Users can insert own activity"
  ON public.role_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all activity
CREATE POLICY "Admins can view all activity"
  ON public.role_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'organization_admin', 'super_admin')
    )
  );

-- Create index for performance
CREATE INDEX idx_role_activity_user ON public.role_activity_logs(user_id, created_at DESC);
CREATE INDEX idx_role_activity_role ON public.role_activity_logs(role, created_at DESC);
CREATE INDEX idx_role_activity_module ON public.role_activity_logs(module_code, created_at DESC);

-- Create view for role activity summary
CREATE OR REPLACE VIEW public.role_activity_summary AS
SELECT 
  role,
  module_code,
  COUNT(*) as activity_count,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as last_activity
FROM public.role_activity_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY role, module_code
ORDER BY activity_count DESC;