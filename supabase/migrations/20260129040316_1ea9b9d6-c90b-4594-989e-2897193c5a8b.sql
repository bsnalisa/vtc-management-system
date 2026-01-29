-- Add trade_id column to qualifications table to link qualifications to trades
ALTER TABLE public.qualifications 
ADD COLUMN trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_qualifications_trade_id ON public.qualifications(trade_id);

-- Update RLS policies to allow org admins to edit approved qualifications (revert to draft/pending)
DROP POLICY IF EXISTS "Org admins can update draft/rejected qualifications" ON public.qualifications;

CREATE POLICY "Org admins can update qualifications for resubmission"
ON public.qualifications
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.can_manage_qualifications(auth.uid())
)
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND public.can_manage_qualifications(auth.uid())
  AND status IN ('draft', 'pending_approval')
);

-- Update trades table RLS to allow Head of Training to manage trades
DROP POLICY IF EXISTS "Trades viewable by authenticated users" ON public.trades;
DROP POLICY IF EXISTS "Org admins manage trades" ON public.trades;
DROP POLICY IF EXISTS "Head of Training can manage trades" ON public.trades;
DROP POLICY IF EXISTS "Head of Training can insert trades" ON public.trades;
DROP POLICY IF EXISTS "Head of Training can update trades" ON public.trades;
DROP POLICY IF EXISTS "Head of Training can delete trades" ON public.trades;

-- Enable RLS on trades if not already enabled
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view trades in their organization
CREATE POLICY "Trades viewable by org members"
ON public.trades
FOR SELECT
TO authenticated
USING (
  organization_id IS NULL 
  OR organization_id = public.get_user_organization(auth.uid())
);

-- Head of Training and org admins can insert trades
CREATE POLICY "Head of Training can insert trades"
ON public.trades
FOR INSERT
TO authenticated
WITH CHECK (
  (organization_id = public.get_user_organization(auth.uid()) OR organization_id IS NULL)
  AND (
    public.has_role(auth.uid(), 'head_of_training')
    OR public.has_role(auth.uid(), 'organization_admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

-- Head of Training and org admins can update trades
CREATE POLICY "Head of Training can update trades"
ON public.trades
FOR UPDATE
TO authenticated
USING (
  (organization_id = public.get_user_organization(auth.uid()) OR organization_id IS NULL)
  AND (
    public.has_role(auth.uid(), 'head_of_training')
    OR public.has_role(auth.uid(), 'organization_admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
)
WITH CHECK (
  (organization_id = public.get_user_organization(auth.uid()) OR organization_id IS NULL)
  AND (
    public.has_role(auth.uid(), 'head_of_training')
    OR public.has_role(auth.uid(), 'organization_admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

-- Head of Training and org admins can delete trades
CREATE POLICY "Head of Training can delete trades"
ON public.trades
FOR DELETE
TO authenticated
USING (
  (organization_id = public.get_user_organization(auth.uid()) OR organization_id IS NULL)
  AND (
    public.has_role(auth.uid(), 'head_of_training')
    OR public.has_role(auth.uid(), 'organization_admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);