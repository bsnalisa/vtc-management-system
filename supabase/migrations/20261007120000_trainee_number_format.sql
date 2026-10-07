-- Spec 1.6: trainee numbers are "<VTC code>-<intake year YY>-<5 random digits>", e.g. 062-24-48213.
-- The VTC code is organizations.trainee_id_prefix (set it to the VTC's code, e.g. 062).
-- Existing numbers are left untouched; only newly issued numbers use the new format.

CREATE OR REPLACE FUNCTION public.generate_trainee_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_prefix text;
  yy text := to_char(CURRENT_DATE, 'YY');
  candidate text;
  attempts integer := 0;
BEGIN
  SELECT COALESCE(NULLIF(trainee_id_prefix, ''), 'VTC') INTO org_prefix
  FROM public.organizations WHERE id = org_id;
  org_prefix := COALESCE(org_prefix, 'VTC');

  LOOP
    candidate := org_prefix || '-' || yy || '-' || lpad(floor(random() * 100000)::int::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.trainees WHERE trainee_id = candidate)
          AND NOT EXISTS (SELECT 1 FROM public.trainee_applications WHERE trainee_number = candidate);
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not allocate a unique trainee number for this intake year';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Both existing entry points now delegate to the single generator.
CREATE OR REPLACE FUNCTION public.generate_trainee_id(org_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.generate_trainee_number(org_id); $$;

CREATE OR REPLACE FUNCTION public.generate_continuous_trainee_number(org_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.generate_trainee_number(org_id); $$;
