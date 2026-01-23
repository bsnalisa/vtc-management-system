-- Fix security definer view by recreating without SECURITY DEFINER
DROP VIEW IF EXISTS public.role_activity_summary;

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

-- Grant access to authenticated users
GRANT SELECT ON public.role_activity_summary TO authenticated;