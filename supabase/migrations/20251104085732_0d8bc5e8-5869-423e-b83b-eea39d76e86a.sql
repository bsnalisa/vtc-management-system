-- Update RLS policies for asset_categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.asset_categories;
CREATE POLICY "Admins and coordinators can manage categories"
  ON public.asset_categories FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'asset_maintenance_coordinator'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Update RLS policies for assets
DROP POLICY IF EXISTS "Admins can manage assets" ON public.assets;
CREATE POLICY "Admins and coordinators can manage assets"
  ON public.assets FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'asset_maintenance_coordinator'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Update RLS policies for asset_maintenance
DROP POLICY IF EXISTS "Admins can manage maintenance" ON public.asset_maintenance;
CREATE POLICY "Admins and coordinators can manage maintenance"
  ON public.asset_maintenance FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'asset_maintenance_coordinator'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Update RLS policies for asset_depreciation
DROP POLICY IF EXISTS "Admins can manage depreciation" ON public.asset_depreciation;
CREATE POLICY "Admins and coordinators can manage depreciation"
  ON public.asset_depreciation FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'asset_maintenance_coordinator'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Update RLS policies for asset_documents
DROP POLICY IF EXISTS "Admins can manage documents" ON public.asset_documents;
CREATE POLICY "Admins and coordinators can manage documents"
  ON public.asset_documents FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'asset_maintenance_coordinator'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Update storage policies for asset documents
DROP POLICY IF EXISTS "Admins can upload asset documents" ON storage.objects;
CREATE POLICY "Admins and coordinators can upload asset documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'asset-documents' 
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'asset_maintenance_coordinator'::app_role))
  );

DROP POLICY IF EXISTS "Admins can delete asset documents" ON storage.objects;
CREATE POLICY "Admins and coordinators can delete asset documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'asset-documents' 
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'asset_maintenance_coordinator'::app_role))
  );