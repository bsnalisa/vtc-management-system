-- 1. Add entry_requirements_history table for versioning
CREATE TABLE IF NOT EXISTS public.entry_requirements_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_requirement_id UUID NOT NULL REFERENCES public.entry_requirements(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  trade_id UUID NOT NULL,
  level INTEGER NOT NULL,
  requirement_name TEXT NOT NULL,
  min_grade INTEGER,
  min_points INTEGER,
  english_symbol TEXT,
  maths_symbol TEXT,
  science_symbol TEXT,
  prevocational_symbol TEXT,
  requires_previous_level BOOLEAN DEFAULT false,
  previous_level_required INTEGER,
  mature_age_entry BOOLEAN DEFAULT false,
  mature_min_age INTEGER,
  mature_min_experience_years INTEGER,
  additional_requirements TEXT,
  required_subjects JSONB,
  version_number INTEGER NOT NULL DEFAULT 1,
  changed_by UUID NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add 'archived' to trainee_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'archived' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'trainee_status')
  ) THEN
    ALTER TYPE trainee_status ADD VALUE 'archived';
  END IF;
END$$;

-- 3. Add archived_at and archived_by columns to trainees table
ALTER TABLE public.trainees 
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID,
  ADD COLUMN IF NOT EXISTS archive_notes TEXT;

-- 4. Add version column to entry_requirements
ALTER TABLE public.entry_requirements
  ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

-- 5. Create function to track entry requirement changes
CREATE OR REPLACE FUNCTION public.log_entry_requirement_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the old values to history when updated
  INSERT INTO public.entry_requirements_history (
    entry_requirement_id,
    organization_id,
    trade_id,
    level,
    requirement_name,
    min_grade,
    min_points,
    english_symbol,
    maths_symbol,
    science_symbol,
    prevocational_symbol,
    requires_previous_level,
    previous_level_required,
    mature_age_entry,
    mature_min_age,
    mature_min_experience_years,
    additional_requirements,
    required_subjects,
    version_number,
    changed_by,
    change_reason
  ) VALUES (
    OLD.id,
    OLD.organization_id,
    OLD.trade_id,
    OLD.level,
    OLD.requirement_name,
    OLD.min_grade,
    OLD.min_points,
    OLD.english_symbol,
    OLD.maths_symbol,
    OLD.science_symbol,
    OLD.prevocational_symbol,
    OLD.requires_previous_level,
    OLD.previous_level_required,
    OLD.mature_age_entry,
    OLD.mature_min_age,
    OLD.mature_min_experience_years,
    OLD.additional_requirements,
    OLD.required_subjects,
    COALESCE(OLD.version_number, 1),
    auth.uid(),
    'Updated via system'
  );
  
  -- Increment version number
  NEW.version_number := COALESCE(OLD.version_number, 1) + 1;
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- 6. Create trigger for entry requirements versioning
DROP TRIGGER IF EXISTS trigger_entry_requirements_versioning ON public.entry_requirements;
CREATE TRIGGER trigger_entry_requirements_versioning
  BEFORE UPDATE ON public.entry_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.log_entry_requirement_changes();

-- 7. Enable RLS on entry_requirements_history
ALTER TABLE public.entry_requirements_history ENABLE ROW LEVEL SECURITY;

-- 8. RLS policy for entry_requirements_history
CREATE POLICY "Users can view entry requirement history for their org"
ON public.entry_requirements_history
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()));

-- 9. Fix trainee ID generation - ensure it uses org prefix properly
CREATE OR REPLACE FUNCTION public.generate_trainee_id(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  year_suffix TEXT;
  counter INTEGER;
  org_prefix TEXT;
BEGIN
  -- Get the organization's trainee ID prefix
  SELECT COALESCE(trainee_id_prefix, 'VTC') INTO org_prefix
  FROM public.organizations
  WHERE id = org_id;
  
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the max counter from both trainees and trainee_applications
  SELECT COALESCE(
    GREATEST(
      (SELECT MAX(
        CASE 
          WHEN trainee_id ~ ('^' || org_prefix || year_suffix || '[0-9]+$')
          THEN CAST(SUBSTRING(trainee_id FROM LENGTH(org_prefix || year_suffix) + 1) AS INTEGER)
          ELSE 0 
        END
      )
       FROM public.trainees
       WHERE organization_id = org_id),
      (SELECT MAX(
        CASE 
          WHEN trainee_number ~ ('^' || org_prefix || year_suffix || '[0-9]+$')
          THEN CAST(SUBSTRING(trainee_number FROM LENGTH(org_prefix || year_suffix) + 1) AS INTEGER)
          ELSE 0 
        END
      )
       FROM public.trainee_applications
       WHERE organization_id = org_id)
    ), 0
  ) + 1
  INTO counter;
  
  -- Format: PREFIX + YEAR + 5-digit sequence (e.g., NVTC202600001)
  new_id := org_prefix || year_suffix || LPAD(counter::TEXT, 5, '0');
  
  RETURN new_id;
END;
$$;

-- 10. Update set_trainee_id trigger function
CREATE OR REPLACE FUNCTION public.set_trainee_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if trainee_id is empty or null
  IF NEW.trainee_id IS NULL OR NEW.trainee_id = '' THEN
    NEW.trainee_id := public.generate_trainee_id(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;