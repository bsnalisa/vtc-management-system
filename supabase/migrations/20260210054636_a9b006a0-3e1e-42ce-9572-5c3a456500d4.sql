-- Drop the old trigger that auto-generates trainee_number during screening
-- Identity creation (trainee_number, system_email, auth account) must ONLY happen 
-- in the clear-application-fee edge function after payment is cleared.
DROP TRIGGER IF EXISTS set_trainee_number_on_qualification_trigger ON public.trainee_applications;

-- Also drop the redundant email trigger since clear-application-fee handles this
DROP TRIGGER IF EXISTS generate_system_email_on_trainee_number ON public.trainee_applications;
