ALTER TABLE public.trainee_applications DROP CONSTRAINT trainee_applications_registration_status_check;

ALTER TABLE public.trainee_applications ADD CONSTRAINT trainee_applications_registration_status_check 
CHECK (registration_status = ANY (ARRAY['applied'::text, 'pending_payment'::text, 'provisionally_admitted'::text, 'registration_fee_pending'::text, 'payment_verified'::text, 'payment_cleared'::text, 'fully_registered'::text, 'registered'::text]));