-- Fix hostel_allocations RLS policy to restrict visibility
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view allocations in their organization" ON public.hostel_allocations;

-- Create a more restrictive SELECT policy
-- Allows: admins, hostel_coordinators to see all allocations in their org
-- Allows: trainees to see only their own allocations
CREATE POLICY "Hostel allocations visibility restricted by role"
ON public.hostel_allocations
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    -- Admins and hostel coordinators can see all allocations
    is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'organization_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hostel_coordinator'::app_role)
    OR has_role(auth.uid(), 'head_of_trainee_support'::app_role)
    -- Trainees can only see their own allocation
    OR trainee_id IN (
      SELECT id FROM public.trainees WHERE user_id = auth.uid()
    )
  )
);