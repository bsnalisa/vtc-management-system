-- Applicants should only be offered trades the centre can actually register them on:
-- a trade needs an approved, active qualification before an admitted applicant can be enrolled.
-- Returns only trade ids, so it exposes nothing beyond what the public trade list already shows.
CREATE OR REPLACE FUNCTION public.trades_open_for_application(_org_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT q.trade_id
  FROM public.qualifications q
  WHERE q.organization_id = _org_id
    AND q.status = 'approved'
    AND q.active = true
    AND q.trade_id IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.trades_open_for_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trades_open_for_application(uuid) TO anon, authenticated;
