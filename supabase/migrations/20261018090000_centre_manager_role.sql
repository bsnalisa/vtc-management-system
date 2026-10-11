-- Centre Manager: the overall head of a centre. Read-only oversight plus approvals; no system administration.
-- (The new enum value is added on its own so the next migration can use it.)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'centre_manager';
