-- Add missing role to app_role enum that exists in custom_roles but not in the enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'trainee';

-- Clean up duplicate/inconsistent librarian role entries
-- First, update any user_roles that might be using 'LIBRARIAN' to 'librarian'
UPDATE user_roles SET role = 'librarian' WHERE role::text = 'LIBRARIAN';

-- Delete the duplicate LIBRARIAN role from custom_roles
DELETE FROM custom_roles WHERE role_code = 'LIBRARIAN' AND role_code != 'librarian';