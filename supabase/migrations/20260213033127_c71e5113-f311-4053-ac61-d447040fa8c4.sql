-- Fix 1: Add debtor_officer to registrations SELECT policy so they can resolve trainee names
DROP POLICY IF EXISTS "Staff manage registrations" ON public.registrations;

CREATE POLICY "Staff manage registrations" ON public.registrations
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT ur.organization_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY[
        'registration_officer'::app_role,
        'admin'::app_role,
        'organization_admin'::app_role,
        'super_admin'::app_role,
        'head_of_training'::app_role,
        'debtor_officer'::app_role
      ])
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT ur.organization_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY[
        'registration_officer'::app_role,
        'admin'::app_role,
        'organization_admin'::app_role,
        'super_admin'::app_role,
        'head_of_training'::app_role,
        'debtor_officer'::app_role
      ])
    )
  );

-- Fix 2: Repair the trainee_financial_accounts record - link trainee_id
UPDATE public.trainee_financial_accounts
SET trainee_id = '626b7136-5f61-4471-b133-47d3bdd84df7'
WHERE application_id = '594be20c-1bf8-44f4-8c3a-8f57acdcb3e8'
AND trainee_id IS NULL;