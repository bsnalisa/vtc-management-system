-- Enable realtime for hostel_fees (payment_clearances already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'hostel_fees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hostel_fees;
  END IF;
END $$;

-- Create notification function for payment status changes
CREATE OR REPLACE FUNCTION public.notify_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notification for trainee when payment is cleared
  IF NEW.status = 'cleared' AND (OLD.status IS NULL OR OLD.status != 'cleared') THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      organization_id
    )
    SELECT 
      t.user_id,
      'Payment Cleared! 🎉',
      'Your registration payment has been verified. You can now proceed with registration.',
      'success',
      NEW.organization_id
    FROM public.trainees t
    WHERE t.id = NEW.trainee_id
    AND t.user_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for payment clearance notifications
DROP TRIGGER IF EXISTS on_payment_clearance_status_change ON public.payment_clearances;
CREATE TRIGGER on_payment_clearance_status_change
  AFTER UPDATE OF status ON public.payment_clearances
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_status_change();

-- Add indexes for better query performance on payment clearances
CREATE INDEX IF NOT EXISTS idx_payment_clearances_status 
  ON public.payment_clearances(status);
CREATE INDEX IF NOT EXISTS idx_payment_clearances_org_status 
  ON public.payment_clearances(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_clearances_trainee 
  ON public.payment_clearances(trainee_id);

-- Add fee_type column to payment_clearances if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_clearances' 
    AND column_name = 'fee_type'
  ) THEN
    ALTER TABLE public.payment_clearances ADD COLUMN fee_type text DEFAULT 'registration';
  END IF;
END $$;