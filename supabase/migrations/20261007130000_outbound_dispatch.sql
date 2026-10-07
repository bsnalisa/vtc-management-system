-- Delivery support for outbound_messages (email/SMS) and inbound SMS graduation replies.

ALTER TABLE public.outbound_messages DROP CONSTRAINT IF EXISTS outbound_messages_status_check;
ALTER TABLE public.outbound_messages
  ADD CONSTRAINT outbound_messages_status_check CHECK (status IN ('queued','sending','sent','failed'));
ALTER TABLE public.outbound_messages
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Atomically takes a batch so two dispatcher runs never send the same message twice.
-- Rows stuck in 'sending' for more than 10 minutes (crashed run) are picked up again.
CREATE OR REPLACE FUNCTION public.claim_outbound_messages(_limit integer DEFAULT 50)
RETURNS SETOF public.outbound_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.outbound_messages m
  SET status = 'sending', claimed_at = now(), attempts = m.attempts + 1
  WHERE m.id IN (
    SELECT id FROM public.outbound_messages
    WHERE (status = 'queued' OR (status = 'sending' AND claimed_at < now() - interval '10 minutes'))
      AND attempts < 3
    ORDER BY created_at
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING m.*;
$$;
REVOKE ALL ON FUNCTION public.claim_outbound_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbound_messages(integer) TO service_role;

-- Inbound SMS "1" / "2" from a graduate's phone. Matches on the last 9 digits so +264... and 0... both work.
-- Returns the ceremony title that was answered, or NULL when nothing matched.
CREATE OR REPLACE FUNCTION public.respond_graduation_invitation_by_phone(_phone text, _code smallint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits text := right(regexp_replace(COALESCE(_phone, ''), '\D', '', 'g'), 9);
  inv_id uuid;
  ceremony_title text;
BEGIN
  IF _code NOT IN (1, 2) OR length(digits) < 7 THEN RETURN NULL; END IF;

  SELECT i.id, c.title INTO inv_id, ceremony_title
  FROM public.graduation_invitations i
  JOIN public.graduation_ceremonies c ON c.id = i.ceremony_id
  JOIN public.alumni a ON a.id = i.alumni_id
  WHERE i.response_code IS NULL
    AND c.ceremony_date > now() - interval '1 day'
    AND (right(regexp_replace(COALESCE(a.phone, ''), '\D', '', 'g'), 9) = digits
         OR right(regexp_replace(COALESCE(a.alternative_phone, ''), '\D', '', 'g'), 9) = digits)
  ORDER BY c.ceremony_date
  LIMIT 1;

  IF inv_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.graduation_invitations
    SET response_code = _code, responded_at = now(), response_channel = 'sms'
    WHERE id = inv_id;
  RETURN ceremony_title;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_graduation_invitation_by_phone(text, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_graduation_invitation_by_phone(text, smallint) TO service_role;
