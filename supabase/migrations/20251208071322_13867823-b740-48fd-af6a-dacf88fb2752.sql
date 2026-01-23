-- Add projects_coordinator to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'projects_coordinator';