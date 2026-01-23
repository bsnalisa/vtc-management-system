-- Update RLS policies for stock_categories to include stock_control_officer
DROP POLICY IF EXISTS "Admins can manage categories" ON public.stock_categories;
CREATE POLICY "Admins and stock officers can manage categories"
  ON public.stock_categories FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'stock_control_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Update RLS policies for stock_items to include stock_control_officer
DROP POLICY IF EXISTS "Admins can manage stock items" ON public.stock_items;
CREATE POLICY "Admins and stock officers can manage stock items"
  ON public.stock_items FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'stock_control_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );

-- Update RLS policies for stock_movements to include stock_control_officer
DROP POLICY IF EXISTS "Authorized users can create movements" ON public.stock_movements;
CREATE POLICY "Authorized users can create movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid()) 
    AND (
      is_admin(auth.uid()) 
      OR has_role(auth.uid(), 'trainer'::app_role)
      OR has_role(auth.uid(), 'stock_control_officer'::app_role)
    )
  );

DROP POLICY IF EXISTS "Admins can manage movements" ON public.stock_movements;
CREATE POLICY "Admins and stock officers can manage movements"
  ON public.stock_movements FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'stock_control_officer'::app_role))
    AND organization_id = get_user_organization(auth.uid())
  );