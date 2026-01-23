-- Add head_of_training role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_of_training';

-- Add head_of_training role to custom_roles if not exists
INSERT INTO public.custom_roles (role_code, role_name, description, is_system_role, active)
VALUES (
  'head_of_training',
  'Head of Training',
  'Manages all academic and training operations including modules, curriculum, classes, trainers, and academic performance',
  true,
  true
)
ON CONFLICT (role_code) DO NOTHING;