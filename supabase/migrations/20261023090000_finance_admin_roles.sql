-- New roles for the finance and administration line and the Centre Manager's office.
-- (Enum values are added in their own migration so later ones can use them.)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_of_finance_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'creditors_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loan_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pa_to_centre_manager';
