-- Create a trigger function to auto-calculate balance on financial_queue
CREATE OR REPLACE FUNCTION public.update_financial_queue_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-calculate balance as amount - amount_paid
  NEW.balance := GREATEST(0, NEW.amount - COALESCE(NEW.amount_paid, 0));
  
  -- Auto-update status based on balance
  IF NEW.balance <= 0 THEN
    NEW.status := 'cleared';
  ELSIF COALESCE(NEW.amount_paid, 0) > 0 THEN
    NEW.status := 'partial';
  ELSE
    NEW.status := 'pending';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS update_financial_queue_balance_trigger ON public.financial_queue;
CREATE TRIGGER update_financial_queue_balance_trigger
  BEFORE INSERT OR UPDATE ON public.financial_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_financial_queue_balance();