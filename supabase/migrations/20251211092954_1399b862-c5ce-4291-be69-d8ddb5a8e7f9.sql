-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bdl_coordinator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rpl_coordinator';