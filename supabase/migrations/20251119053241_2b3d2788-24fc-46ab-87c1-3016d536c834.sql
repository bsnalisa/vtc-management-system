-- Add missing VMS roles to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vms_developer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vms_support';