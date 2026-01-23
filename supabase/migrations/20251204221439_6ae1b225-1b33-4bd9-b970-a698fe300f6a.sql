-- Fix security definer views - recreate as security invoker
-- First, drop and recreate attendance_analytics view without security definer

DROP VIEW IF EXISTS public.attendance_analytics;

CREATE OR REPLACE VIEW public.attendance_analytics 
WITH (security_invoker = true)
AS
SELECT 
    ar.register_id,
    r.organization_id,
    r.trade_id,
    r.level,
    r.academic_year,
    COUNT(*) as total_records,
    SUM(CASE WHEN ar.present THEN 1 ELSE 0 END) as present_count,
    ROUND((SUM(CASE WHEN ar.present THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) as attendance_percentage
FROM public.attendance_records ar
JOIN public.attendance_registers r ON ar.register_id = r.id
GROUP BY ar.register_id, r.organization_id, r.trade_id, r.level, r.academic_year;

-- Add comment for documentation
COMMENT ON VIEW public.attendance_analytics IS 'Aggregated attendance statistics by register';

-- Fix function search_path by recreating update_updated_at_column with explicit search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;