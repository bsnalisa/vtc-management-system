-- The Organization Admin is the centre's IT Systems Administrator: end-user support, account assistance, centre configuration,
-- troubleshooting, and escalation of advanced problems to the Super Admin. It is not a finance or academic role.
--
--  1. Support tickets get a conversation thread (public replies and internal troubleshooting notes), assignment, resolution and
--     escalation to the Super Admin. Tickets and their messages change only through the functions below, which check the caller.
--  2. `it_dashboard` and `it_system_status` give the IT dashboard real figures for the administrator's own centre.
--  3. The administrator is read-only on finance and grades with no way to start an override, and the five finance tables the
--     review found writable (financial_queue, trainee_financial_accounts, billing_records, finance_settings, department_budgets)
--     join the existing "needs an override" gate.
--  4. An administrator cannot delete trainee, application or registration records, and their changes to the sensitive tables
--     they can still write are recorded in the append-only `admin_audit_log`.

-- ---------------------------------------------------------------------------
-- 1. Support tickets
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS escalation_status text NOT NULL DEFAULT 'none' CHECK (escalation_status IN ('none', 'escalated', 'returned', 'resolved')),
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_by uuid,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS last_requester_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_staff_reply_at timestamptz;
UPDATE public.support_tickets SET reference = 'TKT-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.support_ticket_seq')::text, 6, '0'),
  last_requester_reply_at = created_at WHERE reference IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_support_ticket_reference ON public.support_tickets (reference);
CREATE INDEX IF NOT EXISTS idx_support_tickets_queue ON public.support_tickets (organization_id, status, escalation_status);

-- a new ticket always starts open and unassigned, with a reference, whatever the client sent
CREATE OR REPLACE FUNCTION public.support_ticket_before_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.status := 'open'; NEW.assigned_to := NULL; NEW.resolution_notes := NULL; NEW.resolved_at := NULL;
  NEW.escalation_status := 'none'; NEW.escalated_at := NULL; NEW.escalated_by := NULL; NEW.escalation_reason := NULL;
  NEW.last_staff_reply_at := NULL; NEW.last_requester_reply_at := now();
  NEW.reference := 'TKT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.support_ticket_seq')::text, 6, '0');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_support_ticket_before_insert ON public.support_tickets;
CREATE TRIGGER trg_support_ticket_before_insert BEFORE INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.support_ticket_before_insert();

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  author_id uuid,
  author_name text,
  author_role text,
  kind text NOT NULL CHECK (kind IN ('reply', 'note', 'status', 'assignment', 'escalation', 'escalation_response', 'resolution')),
  internal boolean NOT NULL DEFAULT false,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON public.support_ticket_messages (ticket_id, created_at);
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.support_ticket_messages FROM anon, authenticated;
REVOKE ALL ON public.support_ticket_messages FROM anon;
CREATE OR REPLACE FUNCTION public.support_messages_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Support ticket messages cannot be changed or deleted'; END $$;
DROP TRIGGER IF EXISTS trg_support_messages_append_only ON public.support_ticket_messages;
CREATE TRIGGER trg_support_messages_append_only BEFORE UPDATE OR DELETE ON public.support_ticket_messages FOR EACH ROW EXECUTE FUNCTION public.support_messages_append_only();

-- who is acting on a ticket of this centre: 'super' (Super Admin), 'admin' (the centre's Organization Admin) or NULL
CREATE OR REPLACE FUNCTION public.ticket_actor_kind(_org uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL
              WHEN public.is_super_admin(auth.uid()) THEN 'super'
              WHEN public.has_org_role(auth.uid(), _org, ARRAY['organization_admin', 'admin']) THEN 'admin' END
$$;
REVOKE ALL ON FUNCTION public.ticket_actor_kind(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_actor_kind(uuid) TO authenticated, service_role;

-- read access
DROP POLICY IF EXISTS "Organization admins can update organization tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Super admins read all tickets" ON public.support_tickets;
CREATE POLICY "Super admins read all tickets" ON public.support_tickets FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Ticket messages: staff and requester" ON public.support_ticket_messages;
CREATE POLICY "Ticket messages: staff and requester" ON public.support_ticket_messages FOR SELECT TO authenticated USING (
  public.ticket_actor_kind(organization_id) IS NOT NULL
  OR (NOT internal AND (
        EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
        OR public.has_org_role(auth.uid(), organization_id, ARRAY['centre_manager']))));
DROP POLICY IF EXISTS "Centre isolation" ON public.support_ticket_messages;
CREATE POLICY "Centre isolation" ON public.support_ticket_messages AS RESTRICTIVE FOR ALL
  USING (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]))
  WITH CHECK (NOT (SELECT public.is_centre_scoped_user()) OR organization_id = ANY ((SELECT public.my_centre_ids())::uuid[]));

CREATE OR REPLACE FUNCTION public.support_notify(_org uuid, _user uuid, _event text, _title text, _message text, _link text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT public.workflow_notify(_org, _user, _event, _title, _message, _link, _message) $$;
REVOKE ALL ON FUNCTION public.support_notify(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.support_post(_t public.support_tickets, _kind text, _body text, _internal boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _name text; _role text;
BEGIN
  SELECT p.full_name INTO _name FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  _role := CASE WHEN public.is_super_admin(auth.uid()) THEN 'super_admin'
                WHEN _t.user_id = auth.uid() THEN 'requester' ELSE 'organization_admin' END;
  INSERT INTO public.support_ticket_messages (ticket_id, organization_id, author_id, author_name, author_role, kind, internal, body)
  VALUES (_t.id, _t.organization_id, auth.uid(), _name, _role, _kind, _internal, trim(_body)) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.support_post(public.support_tickets, text, text, boolean) FROM PUBLIC, anon, authenticated;

-- a reply or an internal troubleshooting note
CREATE OR REPLACE FUNCTION public.support_ticket_add_message(_ticket uuid, _body text, _internal boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets%ROWTYPE; _kind text; _msg uuid; u uuid; _link text := '/support-tickets';
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  _kind := public.ticket_actor_kind(t.organization_id);
  IF _kind IS NULL AND t.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF length(trim(coalesce(_body, ''))) = 0 THEN RAISE EXCEPTION 'Write a message first'; END IF;
  IF t.status = 'closed' THEN RAISE EXCEPTION 'This ticket is closed. Open a new ticket if you still need help.'; END IF;

  IF _kind IS NULL THEN
    -- the requester: public replies only; a reply reopens a resolved ticket
    _msg := public.support_post(t, 'reply', _body, false);
    UPDATE public.support_tickets SET last_requester_reply_at = now(), updated_at = now(),
      status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END, resolved_at = CASE WHEN status = 'resolved' THEN NULL ELSE resolved_at END WHERE id = t.id;
    FOR u IN SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = t.organization_id AND role::text IN ('organization_admin', 'admin')
              AND (t.assigned_to IS NULL OR user_id = t.assigned_to) LOOP
      PERFORM public.support_notify(t.organization_id, u, 'support_ticket_reply', 'Reply on ' || t.reference, t.subject || ': the requester replied.', _link);
    END LOOP;
  ELSE
    _msg := public.support_post(t, CASE WHEN _internal THEN 'note' ELSE 'reply' END, _body, _internal);
    IF NOT _internal THEN
      UPDATE public.support_tickets SET last_staff_reply_at = now(), updated_at = now(), status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END WHERE id = t.id;
      PERFORM public.support_notify(t.organization_id, t.user_id, 'support_ticket_reply', 'Reply on ' || t.reference, 'Support replied to your ticket: ' || t.subject, _link);
    ELSE
      UPDATE public.support_tickets SET updated_at = now() WHERE id = t.id;
    END IF;
  END IF;
  RETURN _msg;
END $$;
REVOKE ALL ON FUNCTION public.support_ticket_add_message(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_ticket_add_message(uuid, text, boolean) TO authenticated;

-- assignment: to an Organization Admin of the same centre, or back to nobody
CREATE OR REPLACE FUNCTION public.support_ticket_assign(_ticket uuid, _assignee uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets%ROWTYPE; _name text;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket FOR UPDATE;
  IF NOT FOUND OR public.ticket_actor_kind(t.organization_id) IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF t.status IN ('resolved', 'closed') THEN RAISE EXCEPTION 'Reopen the ticket before assigning it'; END IF;
  IF _assignee IS NOT NULL AND NOT public.has_org_role(_assignee, t.organization_id, ARRAY['organization_admin', 'admin']) THEN
    RAISE EXCEPTION 'A ticket can only be assigned to an Organization Admin of this centre';
  END IF;
  UPDATE public.support_tickets SET assigned_to = _assignee, updated_at = now(), status = CASE WHEN status = 'open' AND _assignee IS NOT NULL THEN 'in_progress' ELSE status END WHERE id = t.id;
  SELECT full_name INTO _name FROM public.profiles WHERE user_id = _assignee LIMIT 1;
  PERFORM public.support_post(t, 'assignment', CASE WHEN _assignee IS NULL THEN 'Unassigned' ELSE 'Assigned to ' || coalesce(_name, 'an administrator') END, true);
  IF _assignee IS NOT NULL AND _assignee <> auth.uid() THEN
    PERFORM public.support_notify(t.organization_id, _assignee, 'support_ticket_assigned', 'Ticket ' || t.reference || ' assigned to you', t.subject, '/support-tickets');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.support_ticket_assign(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_ticket_assign(uuid, uuid) TO authenticated;

-- status: staff move a ticket through in_progress / resolved / closed / reopened; the requester can close their own
CREATE OR REPLACE FUNCTION public.support_ticket_set_status(_ticket uuid, _status text, _note text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets%ROWTYPE; _kind text; _n text := trim(coalesce(_note, ''));
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  _kind := public.ticket_actor_kind(t.organization_id);
  IF _kind IS NULL AND t.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF _status NOT IN ('open', 'in_progress', 'resolved', 'closed') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  IF _kind IS NULL AND _status <> 'closed' THEN RAISE EXCEPTION 'You can close your own ticket, or reply to ask for more help'; END IF;
  IF _kind = 'admin' AND t.escalation_status = 'escalated' THEN RAISE EXCEPTION 'This ticket is with the Super Admin. Add notes here; the Super Admin resolves or returns it.'; END IF;
  IF _status = 'resolved' AND length(_n) < 10 THEN RAISE EXCEPTION 'Record how the problem was resolved (at least 10 characters)'; END IF;
  IF _status = 'open' AND length(_n) < 5 THEN RAISE EXCEPTION 'Say why the ticket is being reopened'; END IF;
  IF _status = t.status THEN RETURN; END IF;

  UPDATE public.support_tickets SET status = _status, updated_at = now(),
    resolved_at = CASE WHEN _status IN ('resolved', 'closed') THEN now() ELSE NULL END,
    resolution_notes = CASE WHEN _status = 'resolved' THEN _n WHEN _status = 'open' THEN NULL ELSE resolution_notes END,
    escalation_status = CASE WHEN _status = 'open' AND escalation_status = 'resolved' THEN 'none' ELSE escalation_status END
   WHERE id = t.id;
  IF _status = 'resolved' THEN
    PERFORM public.support_post(t, 'resolution', _n, false);
    PERFORM public.support_notify(t.organization_id, t.user_id, 'support_ticket_resolved', 'Ticket ' || t.reference || ' resolved', t.subject || ': ' || _n, '/support-tickets');
  ELSE
    PERFORM public.support_post(t, 'status', 'Status changed to ' || replace(_status, '_', ' ') || CASE WHEN _n <> '' THEN ': ' || _n ELSE '' END, false);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.support_ticket_set_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_ticket_set_status(uuid, text, text) TO authenticated;

-- escalation to the Super Admin (the centre's Organization Admin only)
CREATE OR REPLACE FUNCTION public.support_ticket_escalate(_ticket uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets%ROWTYPE; u uuid;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket FOR UPDATE;
  IF NOT FOUND OR public.ticket_actor_kind(t.organization_id) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Only the centre''s Organization Admin can escalate a ticket'; END IF;
  IF t.status IN ('resolved', 'closed') THEN RAISE EXCEPTION 'Reopen the ticket before escalating it'; END IF;
  IF t.escalation_status = 'escalated' THEN RAISE EXCEPTION 'This ticket has already been escalated'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 20 THEN RAISE EXCEPTION 'Describe what you tried and why it needs the Super Admin (at least 20 characters)'; END IF;
  UPDATE public.support_tickets SET escalation_status = 'escalated', escalated_at = now(), escalated_by = auth.uid(), escalation_reason = trim(_reason),
    status = 'in_progress', updated_at = now() WHERE id = t.id;
  PERFORM public.support_post(t, 'escalation', 'Escalated to the Super Admin: ' || trim(_reason), true);
  PERFORM public.support_post(t, 'status', 'This ticket was escalated to the Super Admin for advanced technical support.', false);
  PERFORM public.log_admin_action(t.organization_id, 'ticket.escalated', 'support_tickets', t.id::text, 'Escalated ' || t.reference || ' to the Super Admin', jsonb_build_object('reason', trim(_reason)));
  FOR u IN SELECT DISTINCT user_id FROM public.user_roles WHERE role::text = 'super_admin' LOOP
    PERFORM public.support_notify(t.organization_id, u, 'support_ticket_escalated', 'Escalated ticket ' || t.reference, t.subject || ': ' || trim(_reason), '/escalated-tickets');
  END LOOP;
  PERFORM public.support_notify(t.organization_id, t.user_id, 'support_ticket_escalated', 'Ticket ' || t.reference || ' escalated', 'Your ticket needs advanced technical help and was passed to the Super Admin.', '/support-tickets');
END $$;
REVOKE ALL ON FUNCTION public.support_ticket_escalate(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_ticket_escalate(uuid, text) TO authenticated;

-- the Super Admin's response to an escalated ticket: guidance back to the centre, resolve it, or an internal note
CREATE OR REPLACE FUNCTION public.support_ticket_super_action(_ticket uuid, _action text, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets%ROWTYPE; u uuid; _n text := trim(coalesce(_note, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only the Super Admin can respond to an escalation' USING ERRCODE = '42501'; END IF;
  SELECT * INTO t FROM public.support_tickets WHERE id = _ticket FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF _action NOT IN ('return', 'resolve', 'note') THEN RAISE EXCEPTION 'Unknown action'; END IF;
  IF length(_n) < 10 THEN RAISE EXCEPTION 'Write the response (at least 10 characters)'; END IF;
  IF _action <> 'note' AND t.escalation_status <> 'escalated' THEN RAISE EXCEPTION 'This ticket is not escalated'; END IF;
  IF _action = 'note' THEN
    PERFORM public.support_post(t, 'note', _n, true);
    UPDATE public.support_tickets SET updated_at = now() WHERE id = t.id;
  ELSIF _action = 'return' THEN
    UPDATE public.support_tickets SET escalation_status = 'returned', updated_at = now(), status = 'in_progress' WHERE id = t.id;
    PERFORM public.support_post(t, 'escalation_response', _n, true);
    FOR u IN SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = t.organization_id AND role::text IN ('organization_admin', 'admin') AND (t.assigned_to IS NULL OR user_id = t.assigned_to) LOOP
      PERFORM public.support_notify(t.organization_id, u, 'support_ticket_returned', 'Ticket ' || t.reference || ' returned with guidance', _n, '/support-tickets');
    END LOOP;
  ELSE
    UPDATE public.support_tickets SET escalation_status = 'resolved', status = 'resolved', resolved_at = now(), resolution_notes = _n, updated_at = now() WHERE id = t.id;
    PERFORM public.support_post(t, 'escalation_response', 'Resolved by the Super Admin: ' || _n, true);
    PERFORM public.support_post(t, 'resolution', _n, false);
    PERFORM public.support_notify(t.organization_id, t.user_id, 'support_ticket_resolved', 'Ticket ' || t.reference || ' resolved', t.subject || ': ' || _n, '/support-tickets');
    FOR u IN SELECT DISTINCT user_id FROM public.user_roles WHERE organization_id = t.organization_id AND role::text IN ('organization_admin', 'admin') LOOP
      PERFORM public.support_notify(t.organization_id, u, 'support_ticket_resolved', 'Escalated ticket ' || t.reference || ' resolved', _n, '/support-tickets');
    END LOOP;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.support_ticket_super_action(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_ticket_super_action(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. The IT dashboard and system status (the administrator's own centre only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.it_admin_centres() RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT organization_id), ARRAY[]::uuid[]) FROM public.user_roles
   WHERE user_id = auth.uid() AND role::text IN ('organization_admin', 'admin') AND organization_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.it_admin_centres() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.it_admin_centres() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.it_dashboard() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _orgs uuid[] := public.it_admin_centres(); r jsonb;
BEGIN
  IF auth.uid() IS NULL OR cardinality(_orgs) = 0 THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'tickets', jsonb_build_object(
      'open', count(*) FILTER (WHERE status = 'open'),
      'in_progress', count(*) FILTER (WHERE status = 'in_progress'),
      'awaiting_response', count(*) FILTER (WHERE status IN ('open', 'in_progress') AND escalation_status <> 'escalated' AND last_requester_reply_at > coalesce(last_staff_reply_at, '-infinity')),
      'assigned_to_me', count(*) FILTER (WHERE status IN ('open', 'in_progress') AND assigned_to = auth.uid()),
      'escalated', count(*) FILTER (WHERE escalation_status = 'escalated'),
      'returned', count(*) FILTER (WHERE escalation_status = 'returned' AND status IN ('open', 'in_progress')),
      'resolved_14d', count(*) FILTER (WHERE status IN ('resolved', 'closed') AND resolved_at > now() - interval '14 days'),
      'unassigned', count(*) FILTER (WHERE status IN ('open', 'in_progress') AND assigned_to IS NULL AND escalation_status <> 'escalated')))
    INTO r FROM public.support_tickets WHERE organization_id = ANY (_orgs);

  RETURN r || jsonb_build_object(
    'queue', coalesce((SELECT jsonb_agg(x ORDER BY (x->>'rank')::int, x->>'created_at') FROM (
        SELECT jsonb_build_object('id', t.id, 'reference', t.reference, 'subject', t.subject, 'priority', t.priority, 'status', t.status, 'escalation_status', t.escalation_status,
                 'created_at', t.created_at, 'requester', (SELECT full_name FROM public.profiles WHERE user_id = t.user_id LIMIT 1),
                 'assignee', (SELECT full_name FROM public.profiles WHERE user_id = t.assigned_to LIMIT 1), 'mine', t.assigned_to = auth.uid(),
                 'awaiting_response', t.last_requester_reply_at > coalesce(t.last_staff_reply_at, '-infinity'),
                 'rank', CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END) AS x
          FROM public.support_tickets t WHERE t.organization_id = ANY (_orgs) AND t.status IN ('open', 'in_progress')
          ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at LIMIT 8) q), '[]'::jsonb),
    'recently_resolved', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'reference', reference, 'subject', subject, 'resolved_at', resolved_at, 'escalated', escalation_status = 'resolved') ORDER BY resolved_at DESC)
        FROM (SELECT * FROM public.support_tickets WHERE organization_id = ANY (_orgs) AND status IN ('resolved', 'closed') ORDER BY resolved_at DESC NULLS LAST LIMIT 5) s), '[]'::jsonb),
    'accounts', public.it_account_overview(_orgs),
    'system', public.it_system_counts(_orgs),
    'activity', coalesce((SELECT jsonb_agg(jsonb_build_object('at', created_at, 'actor', actor_name, 'action', action, 'summary', summary) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.admin_audit_log WHERE organization_id = ANY (_orgs) ORDER BY created_at DESC LIMIT 8) a), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.it_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.it_dashboard() TO authenticated;

-- people who may need help getting in (internal helper)
CREATE OR REPLACE FUNCTION public.it_account_overview(_orgs uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH people AS (
    SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until, p.full_name,
           string_agg(DISTINCT ur.role::text, ', ') AS roles
      FROM auth.users u JOIN public.user_roles ur ON ur.user_id = u.id AND ur.organization_id = ANY (_orgs)
      LEFT JOIN public.profiles p ON p.user_id = u.id
     GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until, p.full_name),
  failed AS (
    SELECT lower(email) AS email, count(*) AS n FROM public.login_attempts
     WHERE NOT success AND created_at > now() - interval '24 hours' GROUP BY 1 HAVING count(*) >= 3),
  flagged AS (
    SELECT pe.*, f.n AS failed_logins,
           CASE WHEN pe.banned_until > now() THEN 'deactivated'
                WHEN f.n IS NOT NULL THEN 'failed_logins'
                WHEN pe.last_sign_in_at IS NULL AND pe.created_at < now() - interval '2 days' THEN 'never_signed_in' END AS reason
      FROM people pe LEFT JOIN failed f ON f.email = lower(pe.email))
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM people),
    'never_signed_in', (SELECT count(*) FROM flagged WHERE reason = 'never_signed_in'),
    'deactivated', (SELECT count(*) FROM flagged WHERE reason = 'deactivated'),
    'failed_logins', (SELECT count(*) FROM flagged WHERE reason = 'failed_logins'),
    'needs_help', coalesce((SELECT jsonb_agg(jsonb_build_object('name', full_name, 'email', email, 'roles', roles, 'reason', reason,
          'detail', CASE reason WHEN 'failed_logins' THEN failed_logins || ' failed sign-ins in 24 hours' WHEN 'deactivated' THEN 'Account deactivated' ELSE 'Has never signed in' END)
          ORDER BY CASE reason WHEN 'failed_logins' THEN 0 WHEN 'deactivated' THEN 1 ELSE 2 END, created_at DESC)
        FROM (SELECT * FROM flagged WHERE reason IS NOT NULL ORDER BY CASE reason WHEN 'failed_logins' THEN 0 WHEN 'deactivated' THEN 1 ELSE 2 END, created_at DESC LIMIT 8) x), '[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.it_account_overview(uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.it_system_counts(_orgs uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'messages_waiting', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = ANY (_orgs) AND status = 'queued' AND created_at < now() - interval '1 hour'),
    'messages_failed_7d', (SELECT count(*) FROM public.outbound_messages WHERE organization_id = ANY (_orgs) AND status = 'failed' AND created_at > now() - interval '7 days'),
    'account_setup_failures_14d', (SELECT count(*) FROM public.provisioning_logs WHERE organization_id = ANY (_orgs) AND result = 'failed' AND created_at > now() - interval '14 days'),
    'modules_enabled', (SELECT count(*) FROM public.organization_modules WHERE organization_id = ANY (_orgs) AND enabled))
$$;
REVOKE ALL ON FUNCTION public.it_system_counts(uuid[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.it_system_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _orgs uuid[] := public.it_admin_centres();
BEGIN
  IF auth.uid() IS NULL OR cardinality(_orgs) = 0 THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'counts', public.it_system_counts(_orgs),
    'waiting_messages', coalesce((SELECT jsonb_agg(jsonb_build_object('channel', channel, 'recipient', recipient, 'subject', subject, 'created_at', created_at, 'attempts', attempts) ORDER BY created_at)
        FROM (SELECT * FROM public.outbound_messages WHERE organization_id = ANY (_orgs) AND status = 'queued' AND created_at < now() - interval '1 hour' ORDER BY created_at LIMIT 15) m), '[]'::jsonb),
    'failed_messages', coalesce((SELECT jsonb_agg(jsonb_build_object('channel', channel, 'recipient', recipient, 'subject', subject, 'error', error, 'created_at', created_at, 'attempts', attempts) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.outbound_messages WHERE organization_id = ANY (_orgs) AND status = 'failed' ORDER BY created_at DESC LIMIT 15) m), '[]'::jsonb),
    'account_setup_failures', coalesce((SELECT jsonb_agg(jsonb_build_object('email', email, 'trigger', trigger_type, 'error', error_message, 'created_at', created_at) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.provisioning_logs WHERE organization_id = ANY (_orgs) AND result = 'failed' ORDER BY created_at DESC LIMIT 15) pl), '[]'::jsonb),
    'accounts', public.it_account_overview(_orgs));
END $$;
REVOKE ALL ON FUNCTION public.it_system_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.it_system_status() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Finance and grades are not part of the administrator role
-- ---------------------------------------------------------------------------
-- No override for the administrator: every table already behind the gate stays read-only for them, whatever the interface shows.
CREATE OR REPLACE FUNCTION public.start_admin_override(_reason text, _minutes integer DEFAULT 30) RETURNS timestamp with time zone
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Finance and grade changes are not part of the Organization Admin role. Ask the Super Admin or the responsible finance or academic officer.' USING ERRCODE = '42501';
END $$;
REVOKE ALL ON FUNCTION public.start_admin_override(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_admin_override(text, integer) TO authenticated;

-- the five finance tables the review found writable without an override join the gate
DO $$
DECLARE t text; c text;
BEGIN
  FOREACH t IN ARRAY ARRAY['financial_queue', 'trainee_financial_accounts', 'billing_records', 'finance_settings', 'department_budgets'] LOOP
    FOREACH c IN ARRAY ARRAY['insert', 'update', 'delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admin writes need an override (' || c || ')', t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (public.admin_write_allowed())', 'Admin writes need an override (insert)', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE USING (public.admin_write_allowed()) WITH CHECK (public.admin_write_allowed())', 'Admin writes need an override (update)', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE USING (public.admin_write_allowed())', 'Admin writes need an override (delete)', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Records an administrator cannot delete, and wider audit of what they can still change
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trainees', 'trainee_applications', 'registrations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins do not delete trainee records" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins do not delete trainee records" ON public.%I AS RESTRICTIVE FOR DELETE USING (NOT (SELECT public.is_org_admin_only(auth.uid())) OR public.has_role(auth.uid(), ''registration_officer''::app_role))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['trainees', 'trainee_applications', 'registrations', 'financial_queue', 'trainee_financial_accounts', 'billing_records',
                           'finance_settings', 'department_budgets', 'password_policies', 'support_tickets'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_admin_change ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_admin_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change()', t);
  END LOOP;
END $$;
