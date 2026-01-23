-- First add the new roles to the enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'head_trainee_support';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'head_of_training';