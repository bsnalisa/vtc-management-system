-- Allow Head of Training to manage trainers
DROP POLICY IF EXISTS "Admins and registration officers can manage trainers" ON public.trainers;
CREATE POLICY "Admins, registration officers, and HoT can manage trainers"
ON public.trainers
FOR ALL
USING (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'registration_officer'::app_role) 
  OR has_role(auth.uid(), 'head_of_training'::app_role)
);

-- Allow HoT to manage trainer_trades
DROP POLICY IF EXISTS "Admins can manage trainer trades" ON public.trainer_trades;
CREATE POLICY "Admins and HoT can manage trainer trades"
ON public.trainer_trades
FOR ALL
USING (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'head_of_training'::app_role)
);
