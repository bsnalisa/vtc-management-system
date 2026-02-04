-- Fix the overly permissive INSERT policy on provisioning_logs
DROP POLICY IF EXISTS "System can insert provisioning logs" ON public.provisioning_logs;

-- Create a more restrictive policy - allow authenticated users with admin roles to insert
CREATE POLICY "Admins can insert provisioning logs"
ON public.provisioning_logs
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'organization_admin', 'registration_officer', 'admin')
  )
);