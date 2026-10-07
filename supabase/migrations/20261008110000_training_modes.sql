-- Spec 3.10: segregate Conventional, Apprenticeship, RPL and Short Course training.
-- fulltime = Conventional, bdl = Blended/Distance Learning, shortcourse = Short Course (existing).
ALTER TYPE public.training_mode ADD VALUE IF NOT EXISTS 'apprenticeship';
ALTER TYPE public.training_mode ADD VALUE IF NOT EXISTS 'rpl';
