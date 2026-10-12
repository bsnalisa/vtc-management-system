-- Entry requirements belong to registration. Registration officers propose changes and the Head of Trainee Support
-- (whom they report to) decides. The Organization Admin gives technical support and approves nothing here.
CREATE OR REPLACE FUNCTION public.can_approve_entry_requirements(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_org_role(_user_id, _org, ARRAY['head_of_trainee_support', 'head_trainee_support']) OR public.is_super_admin(_user_id);
$$;
