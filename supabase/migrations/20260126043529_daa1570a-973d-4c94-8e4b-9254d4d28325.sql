-- Fix: Payment Records Viewable by All Authenticated Users
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;

-- Create restricted policy for viewing payments
-- Finance staff (admins, debtor officers) can view all payments in their organization
-- Trainees can only view payments for their own fee records
CREATE POLICY "Users can view appropriate payments" 
ON public.payments 
FOR SELECT 
TO authenticated
USING (
  -- Admins and super admins can see all
  is_admin(auth.uid()) 
  OR is_super_admin(auth.uid())
  -- Debtor officers can see payments in their organization
  OR (
    has_role(auth.uid(), 'debtor_officer') 
    AND fee_record_id IN (
      SELECT fr.id FROM fee_records fr
      WHERE fr.organization_id = get_user_organization(auth.uid())
    )
  )
  -- Trainees can view their own payments (via fee_records -> trainees relationship)
  OR fee_record_id IN (
    SELECT fr.id FROM fee_records fr
    JOIN trainees t ON t.id = fr.trainee_id
    WHERE t.user_id = auth.uid()
  )
);