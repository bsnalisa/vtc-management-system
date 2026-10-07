-- Spec 3.10: segregate Conventional, Apprenticeship, RPL and Short Course training.
-- fulltime = Conventional, bdl = Blended/Distance Learning, shortcourse = Short Course (existing).
ALTER TYPE public.training_mode ADD VALUE IF NOT EXISTS 'apprenticeship';
ALTER TYPE public.training_mode ADD VALUE IF NOT EXISTS 'rpl';

-- Applications record the preferred mode as text with its own list; keep it in step with the enum
-- (otherwise choosing Apprenticeship or RPL on the application form fails on submit).
ALTER TABLE public.trainee_applications DROP CONSTRAINT IF EXISTS trainee_applications_preferred_training_mode_check;
ALTER TABLE public.trainee_applications ADD CONSTRAINT trainee_applications_preferred_training_mode_check
  CHECK (preferred_training_mode IN ('fulltime', 'bdl', 'shortcourse', 'apprenticeship', 'rpl'));
