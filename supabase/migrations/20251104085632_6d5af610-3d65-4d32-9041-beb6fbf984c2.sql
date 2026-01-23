-- Add asset_maintenance_coordinator role to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'asset_maintenance_coordinator';