-- Step 1: Add placement_officer to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'placement_officer';