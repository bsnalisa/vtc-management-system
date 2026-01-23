-- Ensure profiles table RLS properly restricts organization admins
-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Admins can view profiles in their scope" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create improved policies for profiles
-- Super admins can see all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Organization admins can only see profiles of users in their organization
CREATE POLICY "Organization admins can view their org users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_organization_admin(auth.uid(), get_user_organization(auth.uid()))
  AND (
    -- User's profile belongs to someone in the same organization
    user_id IN (
      SELECT ur.user_id 
      FROM user_roles ur 
      WHERE ur.organization_id = get_user_organization(auth.uid())
    )
  )
);

-- System admins can view all profiles in their organization
CREATE POLICY "Admins can view org profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  AND user_id IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.organization_id = get_user_organization(auth.uid())
  )
);

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);