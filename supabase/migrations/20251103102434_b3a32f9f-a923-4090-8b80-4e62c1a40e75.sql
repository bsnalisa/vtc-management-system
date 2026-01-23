-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, full_name, email)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any existing users without profiles
INSERT INTO public.profiles (id, user_id, full_name, email)
SELECT 
  gen_random_uuid(),
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  au.email
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.id IS NULL;