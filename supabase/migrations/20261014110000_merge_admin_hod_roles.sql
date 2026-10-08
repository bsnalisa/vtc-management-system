-- Merge the Admin role into Organization Admin and Head of Department (hod) into Head of Training.
-- Existing holders move to the merged role, and the old roles are retired so they cannot be assigned again.
-- Rows that already carry the merged role are left alone. Accounts are kept because financial and audit records reference them.

-- an organisation-less admin account becomes an Organization Admin of the Nakayale centre
UPDATE public.user_roles SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE role::text = 'admin' AND organization_id IS NULL
  AND EXISTS (SELECT 1 FROM public.organizations WHERE id = '550e8400-e29b-41d4-a716-446655440000');

DELETE FROM public.user_roles o USING public.user_roles k
WHERE o.role::text = 'admin' AND k.role::text = 'organization_admin' AND k.user_id = o.user_id AND k.organization_id IS NOT DISTINCT FROM o.organization_id;
DELETE FROM public.user_roles o USING public.user_roles k
WHERE o.role::text = 'hod' AND k.role::text = 'head_of_training' AND k.user_id = o.user_id AND k.organization_id IS NOT DISTINCT FROM o.organization_id;

UPDATE public.user_roles SET role = 'organization_admin'::public.app_role WHERE role::text = 'admin' AND organization_id IS NOT NULL;
UPDATE public.user_roles SET role = 'head_of_training'::public.app_role WHERE role::text = 'hod';

UPDATE public.custom_roles
SET active = false,
    description = COALESCE(description, '') || ' (retired: merged into ' || CASE role_code WHEN 'admin' THEN 'Organization Admin' ELSE 'Head of Training' END || ')'
WHERE role_code IN ('admin', 'hod') AND organization_id IS NULL AND active;
