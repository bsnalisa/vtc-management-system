-- Add new roles to app_role enum (must be in separate transaction)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'head_of_trainee_support') THEN
    ALTER TYPE app_role ADD VALUE 'head_of_trainee_support';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'liaison_officer') THEN
    ALTER TYPE app_role ADD VALUE 'liaison_officer';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'resource_center_coordinator') THEN
    ALTER TYPE app_role ADD VALUE 'resource_center_coordinator';
  END IF;
END $$;