-- Add maintenance_coordinator to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'maintenance_coordinator';