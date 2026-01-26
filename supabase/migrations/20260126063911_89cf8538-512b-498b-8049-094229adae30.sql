-- Fix the remaining asset_audit_logs policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.asset_audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert asset audit logs" ON public.asset_audit_logs;

CREATE POLICY "Authenticated users can insert asset audit logs" 
ON public.asset_audit_logs 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Only users within the same organization can insert audit logs
  organization_id = get_user_organization(auth.uid())
);