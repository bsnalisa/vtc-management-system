-- Add trainee_id_prefix column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS trainee_id_prefix TEXT DEFAULT 'VTC';

-- Update existing function to use organization prefix
CREATE OR REPLACE FUNCTION public.generate_trainee_id(org_id UUID)
RETURNS TEXT
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
  
  -- Get the next counter for this organization and year
  SELECT COALESCE(MAX(
    CASE 
      WHEN trainee_id ~ ('^' || org_prefix || year_suffix || '[0-9]+$')
      THEN CAST(SUBSTRING(trainee_id FROM LENGTH(org_prefix) + 5) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1
  INTO counter
  FROM public.trainees
  WHERE organization_id = org_id;
  
  -- Format: PREFIX + YEAR + 5-digit sequence (e.g., NVTC202500001)
  new_id := org_prefix || year_suffix || LPAD(counter::TEXT, 5, '0');
  
  RETURN new_id;
END;
$$;

-- Update the trigger function to use organization_id
CREATE OR REPLACE FUNCTION public.set_trainee_id()
RETURNS TRIGGER
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

-- Update continuous trainee number generator for applications
CREATE OR REPLACE FUNCTION public.generate_continuous_trainee_number(org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  year_suffix TEXT;
  counter INTEGER;
  org_prefix TEXT;
BEGIN
  -- Get the organization's trainee ID prefix
  SELECT COALESCE(trainee_id_prefix, 'VTC') INTO org_prefix
  FROM public.organizations
  WHERE id = org_id;

  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Check both trainee_applications and trainees tables for continuous numbering
  SELECT COALESCE(
    GREATEST(
      (SELECT MAX(
        CASE 
          WHEN trainee_number ~ ('^' || org_prefix || year_suffix || '[0-9]+$')
          THEN CAST(SUBSTRING(trainee_number FROM LENGTH(org_prefix) + 5) AS INTEGER)
          ELSE 0 
        END
      )
       FROM public.trainee_applications
       WHERE organization_id = org_id),
      (SELECT MAX(
        CASE 
          WHEN trainee_id ~ ('^' || org_prefix || year_suffix || '[0-9]+$')
          THEN CAST(SUBSTRING(trainee_id FROM LENGTH(org_prefix) + 5) AS INTEGER)
          ELSE 0 
        END
      )
       FROM public.trainees
       WHERE organization_id = org_id)
    ), 0
  ) + 1
  INTO counter;
  
  new_number := org_prefix || year_suffix || LPAD(counter::TEXT, 5, '0');
  
  RETURN new_number;
END;
$$;