-- notifications.type was restricted to five values, which also broke existing senders (e.g. scheduled reports).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- The original constraint listed five types, but the application sends many more (report, trial_expired, library,
-- workflow, ...). Keep a sanity check on the format only. NOT VALID so rows already in a live database cannot block this.
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type ~ '^[a-z][a-z_]*$') NOT VALID;
