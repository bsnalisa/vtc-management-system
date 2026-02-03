-- Fix the security definer view by dropping and recreating as SECURITY INVOKER
DROP VIEW IF EXISTS public.trainee_login_info;

CREATE VIEW public.trainee_login_info 
WITH (security_invoker = true) AS
SELECT 
  t.id,
  t.trainee_id,
  t.first_name,
  t.last_name,
  t.system_email,
  t.user_id,
  t.organization_id,
  t.password_reset_required,
  o.name as organization_name,
  o.email_domain
FROM public.trainees t
JOIN public.organizations o ON t.organization_id = o.id
WHERE t.system_email IS NOT NULL;