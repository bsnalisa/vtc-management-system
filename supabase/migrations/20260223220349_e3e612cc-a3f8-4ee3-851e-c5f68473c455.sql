-- Auto-enroll trainees into matching classes
-- Trigger function: when a trainee is inserted/updated, find matching classes and enroll
CREATE OR REPLACE FUNCTION public.auto_enroll_trainee_in_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process active trainees
  IF NEW.status = 'active' THEN
    INSERT INTO public.class_enrollments (class_id, trainee_id, status)
    SELECT c.id, NEW.id, 'active'
    FROM public.classes c
    WHERE c.trade_id = NEW.trade_id
      AND c.level = NEW.level
      AND c.training_mode = NEW.training_mode::training_mode
      AND c.academic_year = NEW.academic_year
      AND c.active = true
      AND c.organization_id = NEW.organization_id
    ON CONFLICT (class_id, trainee_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on trainee insert/update
CREATE TRIGGER trg_auto_enroll_trainee
AFTER INSERT OR UPDATE OF trade_id, level, training_mode, academic_year, status
ON public.trainees
FOR EACH ROW
EXECUTE FUNCTION public.auto_enroll_trainee_in_class();

-- Reverse trigger: when a class is created/updated, enroll matching trainees
CREATE OR REPLACE FUNCTION public.auto_enroll_class_trainees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.active = true THEN
    INSERT INTO public.class_enrollments (class_id, trainee_id, status)
    SELECT NEW.id, t.id, 'active'
    FROM public.trainees t
    WHERE t.trade_id = NEW.trade_id
      AND t.level = NEW.level
      AND t.training_mode::text = NEW.training_mode::text
      AND t.academic_year = NEW.academic_year
      AND t.status = 'active'
      AND t.organization_id = NEW.organization_id
    ON CONFLICT (class_id, trainee_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_enroll_class
AFTER INSERT OR UPDATE OF trade_id, level, training_mode, academic_year, active, trainer_id
ON public.classes
FOR EACH ROW
EXECUTE FUNCTION public.auto_enroll_class_trainees();

-- Add unique constraint if not exists to support ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_enrollments_class_id_trainee_id_key'
  ) THEN
    ALTER TABLE public.class_enrollments ADD CONSTRAINT class_enrollments_class_id_trainee_id_key UNIQUE (class_id, trainee_id);
  END IF;
END $$;

-- Backfill: enroll all existing active trainees into matching active classes
INSERT INTO public.class_enrollments (class_id, trainee_id, status)
SELECT c.id, t.id, 'active'
FROM public.trainees t
JOIN public.classes c ON c.trade_id = t.trade_id
  AND c.level = t.level
  AND c.training_mode::text = t.training_mode::text
  AND c.academic_year = t.academic_year
  AND c.active = true
  AND c.organization_id = t.organization_id
WHERE t.status = 'active'
ON CONFLICT (class_id, trainee_id) DO NOTHING;