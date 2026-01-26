-- Fix remaining RLS Policies with WITH CHECK (true)
-- The first migration partially succeeded, need to fix remaining issues

-- 2. Fix login_attempts - Use created_at instead of attempt_time
DROP POLICY IF EXISTS "Anyone can insert login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Users can insert login attempts" ON public.login_attempts;
CREATE POLICY "Users can insert login attempts" 
ON public.login_attempts 
FOR INSERT 
TO public  -- Must allow unauthenticated for login tracking
WITH CHECK (
  -- Allow insertion with current timestamp check to prevent backdated entries
  created_at >= now() - interval '1 minute'
  OR created_at IS NULL  -- Allow default timestamp
);

-- 3. Fix notifications - Only authenticated users can create notifications for their organization
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Notifications must be for users in the same organization, or system-generated
  is_admin(auth.uid()) 
  OR is_super_admin(auth.uid())
  OR user_id = auth.uid()  -- Users can create notifications for themselves
  OR (
    -- Users can create notifications for others in their organization
    user_id IN (
      SELECT ur.user_id 
      FROM user_roles ur 
      WHERE ur.organization_id = get_user_organization(auth.uid())
    )
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'organization_admin')
      OR has_role(auth.uid(), 'registration_officer')
      OR has_role(auth.uid(), 'trainer')
    )
  )
);

-- 4. Fix system_audit_logs - Only authenticated users within organization context
DROP POLICY IF EXISTS "System can insert audit logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert system audit logs" ON public.system_audit_logs;
CREATE POLICY "Authenticated users can insert system audit logs" 
ON public.system_audit_logs 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- User ID must match current user
  user_id = auth.uid()
  -- Organization must match user's organization (if set)
  AND (organization_id IS NULL OR organization_id = get_user_organization(auth.uid()))
);

-- 5. Fix user_activity_logs - Only allow users to log their own activity
DROP POLICY IF EXISTS "System can insert activity logs" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.user_activity_logs;
CREATE POLICY "Users can insert their own activity logs" 
ON public.user_activity_logs 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Users can only insert logs for themselves
  user_id = auth.uid()
);