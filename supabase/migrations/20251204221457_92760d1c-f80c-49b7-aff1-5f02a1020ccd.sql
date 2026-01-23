-- Fix role_activity_summary view security
DROP VIEW IF EXISTS public.role_activity_summary;

CREATE OR REPLACE VIEW public.role_activity_summary 
WITH (security_invoker = true)
AS
SELECT 
    role,
    module_code,
    count(*) AS activity_count,
    count(DISTINCT user_id) AS unique_users,
    max(created_at) AS last_activity
FROM public.role_activity_logs
WHERE (created_at >= (now() - '30 days'::interval))
GROUP BY role, module_code
ORDER BY (count(*)) DESC;

COMMENT ON VIEW public.role_activity_summary IS 'Summary of role activity in the last 30 days';