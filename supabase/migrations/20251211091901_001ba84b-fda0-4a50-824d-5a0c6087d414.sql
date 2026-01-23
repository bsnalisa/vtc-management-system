-- Add hr_officer to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr_officer';