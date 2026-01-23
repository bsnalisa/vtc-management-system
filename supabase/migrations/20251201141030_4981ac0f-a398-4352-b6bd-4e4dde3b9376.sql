-- Add surname and firstname columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS surname TEXT,
ADD COLUMN IF NOT EXISTS firstname TEXT;

-- Update existing profiles to split full_name into surname and firstname (if full_name exists)
UPDATE public.profiles
SET 
  firstname = SPLIT_PART(full_name, ' ', 1),
  surname = CASE 
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1 
    THEN SUBSTRING(full_name FROM LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2)
    ELSE ''
  END
WHERE firstname IS NULL AND full_name IS NOT NULL AND full_name != '';

-- Create a trigger to automatically update full_name when surname or firstname changes
CREATE OR REPLACE FUNCTION public.update_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := TRIM(COALESCE(NEW.firstname, '') || ' ' || COALESCE(NEW.surname, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_full_name
  BEFORE INSERT OR UPDATE OF firstname, surname
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_full_name();

-- Update the handle_new_user function to use surname and firstname
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, firstname, surname, full_name, email, phone)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'firstname', NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'surname', NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;