-- Add stock_control_officer role to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'stock_control_officer';