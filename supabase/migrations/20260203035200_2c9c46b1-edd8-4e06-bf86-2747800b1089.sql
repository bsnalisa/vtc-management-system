-- Drop the existing constraint and recreate with updated values
ALTER TABLE public.trainee_applications 
DROP CONSTRAINT IF EXISTS trainee_applications_registration_status_check;

ALTER TABLE public.trainee_applications 
ADD CONSTRAINT trainee_applications_registration_status_check 
CHECK (registration_status = ANY (ARRAY[
  'applied'::text, 
  'provisionally_admitted'::text, 
  'pending_payment'::text, 
  'payment_verified'::text,
  'fully_registered'::text, 
  'registered'::text,
  'rejected'::text
]));

-- Also update the notify_payment_status_change function to use valid status
CREATE OR REPLACE FUNCTION public.notify_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Insert notification for trainee when payment is cleared
    IF NEW.status = 'cleared' AND (OLD.status IS NULL OR OLD.status != 'cleared') THEN
        -- Try to notify via trainee first
        IF NEW.trainee_id IS NOT NULL THEN
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
        
        -- Try to notify via application if no trainee
        IF NEW.application_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                organization_id
            )
            SELECT 
                ta.user_id,
                'Payment Cleared! 🎉',
                'Your registration payment has been verified. You can now proceed with registration.',
                'success',
                NEW.organization_id
            FROM public.trainee_applications ta
            WHERE ta.id = NEW.application_id
            AND ta.user_id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM public.notifications n 
                WHERE n.user_id = ta.user_id 
                AND n.title = 'Payment Cleared! 🎉'
                AND n.created_at > NOW() - INTERVAL '1 minute'
            );
            
            -- Update application status to fully_registered (valid status)
            UPDATE public.trainee_applications
            SET 
                payment_clearance_status = 'cleared',
                payment_cleared_at = now(),
                payment_cleared_by = auth.uid(),
                registration_status = CASE 
                    WHEN registration_status = 'pending_payment' THEN 'fully_registered'
                    ELSE registration_status
                END
            WHERE id = NEW.application_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;