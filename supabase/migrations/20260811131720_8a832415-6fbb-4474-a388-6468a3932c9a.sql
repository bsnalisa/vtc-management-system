-- 1. Public directory of training centres
CREATE POLICY "Anyone can view active organizations"
ON public.organizations
FOR SELECT
TO anon, authenticated
USING (active = true);

GRANT SELECT ON public.organizations TO anon;

-- 2. Public can view active trades (needed for the online application form)
CREATE POLICY "Anyone can view active trades"
ON public.trades
FOR SELECT
TO anon, authenticated
USING (active = true);

GRANT SELECT ON public.trades TO anon;

-- 3. Online application source tracking
ALTER TABLE public.trainee_applications
ADD COLUMN IF NOT EXISTS application_source text NOT NULL DEFAULT 'staff';

-- 4. Applicants can submit and track their own applications
CREATE POLICY "Applicants can submit their own application"
ON public.trainee_applications
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND organization_id IS NOT NULL
  AND application_source = 'online'
);

CREATE POLICY "Applicants can view their own applications"
ON public.trainee_applications
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- 5. Security fix: scope class enrollment visibility to the class organization
DROP POLICY IF EXISTS "Authenticated users can view class enrollments" ON public.class_enrollments;

CREATE POLICY "Users can view class enrollments in their organization"
ON public.class_enrollments
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_enrollments.class_id
      AND c.organization_id = get_user_organization(auth.uid())
  )
);