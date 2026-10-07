-- Resource Centre (spec section 7): members, reservations, interlibrary loans,
-- barcode/RFID, overdue processing, fines for lost items, announcements.

CREATE OR REPLACE FUNCTION public.is_library_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.organization_id = _org
      AND ur.role::text IN ('admin', 'organization_admin', 'librarian')
  );
$$;

-- Catalogue: barcode / RFID identifiers
ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS rfid_tag text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_items_barcode ON public.library_items (organization_id, barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_items_rfid ON public.library_items (organization_id, rfid_tag) WHERE rfid_tag IS NOT NULL;

-- Per-organisation circulation policy
CREATE TABLE public.library_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_days integer NOT NULL DEFAULT 14,
  fine_per_day numeric(10,2) NOT NULL DEFAULT 1.00,
  max_active_loans integer NOT NULL DEFAULT 3,
  reservation_hold_days integer NOT NULL DEFAULT 3,
  reminder_days_before integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view library settings" ON public.library_settings
FOR SELECT USING (organization_id = public.get_user_organization(auth.uid()));
CREATE POLICY "Library staff manage settings" ON public.library_settings
FOR ALL USING (public.is_library_staff(auth.uid(), organization_id))
WITH CHECK (public.is_library_staff(auth.uid(), organization_id));

-- Members (trainees, trainers, staff and community members)
CREATE TABLE public.library_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_number text NOT NULL,
  member_type text NOT NULL DEFAULT 'trainee' CHECK (member_type IN ('trainee','trainer','staff','community','partner_library')),
  user_id uuid,
  trainee_id uuid REFERENCES public.trainees(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  id_number text,
  address text,
  barcode text,
  rfid_tag text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended','expired')),
  expiry_date date,
  registered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, member_number)
);
CREATE INDEX idx_library_members_user ON public.library_members (user_id);
ALTER TABLE public.library_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Library staff manage members" ON public.library_members
FOR ALL USING (public.is_library_staff(auth.uid(), organization_id))
WITH CHECK (public.is_library_staff(auth.uid(), organization_id));
CREATE POLICY "Members view own profile" ON public.library_members
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users self-register as pending" ON public.library_members
FOR INSERT WITH CHECK (
  user_id = auth.uid() AND status = 'pending'
  AND organization_id = public.get_user_organization(auth.uid())
);
CREATE TRIGGER update_library_members_updated_at BEFORE UPDATE ON public.library_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_library_member_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.member_number IS NULL OR NEW.member_number = '' THEN
    NEW.member_number := 'LIB' || to_char(now(), 'YY') || lpad((floor(random() * 100000))::int::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;
-- member_number is NOT NULL, so give it a default the trigger can replace
ALTER TABLE public.library_members ALTER COLUMN member_number SET DEFAULT '';
CREATE TRIGGER trg_library_member_number BEFORE INSERT ON public.library_members
FOR EACH ROW EXECUTE FUNCTION public.set_library_member_number();

-- Reservations / holds
CREATE TABLE public.library_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  library_item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.library_members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','ready','fulfilled','cancelled','expired')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  expires_at timestamptz
);
CREATE INDEX idx_library_reservations_item ON public.library_reservations (library_item_id, status);
ALTER TABLE public.library_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Library staff manage reservations" ON public.library_reservations
FOR ALL USING (public.is_library_staff(auth.uid(), organization_id))
WITH CHECK (public.is_library_staff(auth.uid(), organization_id));
CREATE POLICY "Members view own reservations" ON public.library_reservations
FOR SELECT USING (member_id IN (SELECT id FROM public.library_members WHERE user_id = auth.uid()));
CREATE POLICY "Members reserve for themselves" ON public.library_reservations
FOR INSERT WITH CHECK (
  status = 'waiting'
  AND member_id IN (SELECT id FROM public.library_members WHERE user_id = auth.uid() AND status = 'active' AND organization_id = library_reservations.organization_id)
);
CREATE POLICY "Members cancel own reservations" ON public.library_reservations
FOR UPDATE USING (member_id IN (SELECT id FROM public.library_members WHERE user_id = auth.uid()))
WITH CHECK (status = 'cancelled');

-- Interlibrary loans (UNAM, other VTCs, community libraries)
CREATE TABLE public.interlibrary_loans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  partner_library text NOT NULL,
  title text NOT NULL,
  author text,
  isbn text,
  library_item_id uuid REFERENCES public.library_items(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.library_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','in_transit','received','returned','declined','cancelled')),
  requested_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  returned_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.interlibrary_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Library staff manage interlibrary loans" ON public.interlibrary_loans
FOR ALL USING (public.is_library_staff(auth.uid(), organization_id))
WITH CHECK (public.is_library_staff(auth.uid(), organization_id));
CREATE TRIGGER update_interlibrary_loans_updated_at BEFORE UPDATE ON public.interlibrary_loans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fines: distinguish overdue / lost / damaged; keep balance and status in sync
ALTER TABLE public.library_fines ADD COLUMN IF NOT EXISTS fine_type text NOT NULL DEFAULT 'overdue'
  CHECK (fine_type IN ('overdue','lost','damaged'));
CREATE OR REPLACE FUNCTION public.sync_library_fine()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.balance := NEW.fine_amount - NEW.amount_paid;
  IF NEW.status = 'pending' AND NEW.balance <= 0 THEN
    NEW.status := 'paid';
    NEW.payment_date := COALESCE(NEW.payment_date, CURRENT_DATE);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_library_fine BEFORE INSERT OR UPDATE ON public.library_fines
FOR EACH ROW EXECUTE FUNCTION public.sync_library_fine();

-- Keep available_copies in step with circulation
CREATE OR REPLACE FUNCTION public.library_adjust_copies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.library_items SET available_copies = available_copies - 1
      WHERE id = NEW.library_item_id AND available_copies > 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'No copies of this item are available'; END IF;
    -- a fulfilled hold for this member
    UPDATE public.library_reservations SET status = 'fulfilled'
      WHERE library_item_id = NEW.library_item_id AND member_id = NEW.borrower_id AND status IN ('waiting','ready');
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> 'returned' AND NEW.status = 'returned' THEN
    UPDATE public.library_items SET available_copies = LEAST(total_copies, available_copies + 1)
      WHERE id = NEW.library_item_id;
    -- notify the next member waiting
    SELECT res.id, m.user_id, i.title INTO r
      FROM public.library_reservations res
      JOIN public.library_members m ON m.id = res.member_id
      JOIN public.library_items i ON i.id = res.library_item_id
      WHERE res.library_item_id = NEW.library_item_id AND res.status = 'waiting'
      ORDER BY res.reserved_at LIMIT 1;
    IF FOUND THEN
      UPDATE public.library_reservations
        SET status = 'ready', notified_at = now(),
            expires_at = now() + make_interval(days => COALESCE((SELECT reservation_hold_days FROM public.library_settings WHERE organization_id = NEW.organization_id), 3))
        WHERE id = r.id;
      IF r.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
        VALUES (r.user_id, NEW.organization_id, 'library', 'Reserved item available',
                '"' || r.title || '" is now available for collection.', '/library');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_library_adjust_copies AFTER INSERT OR UPDATE ON public.library_borrowing
FOR EACH ROW EXECUTE FUNCTION public.library_adjust_copies();

-- Overdue sweep: flags overdue loans, accrues fines, sends reminders. Run daily.
CREATE OR REPLACE FUNCTION public.library_process_overdue(_org uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.library_settings%ROWTYPE;
  b record;
  n integer := 0;
  d integer;
BEGIN
  -- Library staff, or the scheduler (service role / pg_cron). Anonymous callers must not pass.
  IF NOT (public.is_library_staff(auth.uid(), _org) OR public.is_job_runner()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT * INTO s FROM public.library_settings WHERE organization_id = _org;
  IF NOT FOUND THEN s.fine_per_day := 1.00; s.reminder_days_before := 1; END IF;

  -- due-soon reminders
  FOR b IN
    SELECT lb.id, lb.due_date, m.user_id, i.title
    FROM public.library_borrowing lb
    JOIN public.library_members m ON m.id = lb.borrower_id
    JOIN public.library_items i ON i.id = lb.library_item_id
    WHERE lb.organization_id = _org AND lb.status = 'borrowed'
      AND lb.due_date = CURRENT_DATE + s.reminder_days_before AND m.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
    VALUES (b.user_id, _org, 'library', 'Library item due soon',
            '"' || b.title || '" is due on ' || b.due_date || '.', '/library');
  END LOOP;

  -- overdue loans
  FOR b IN
    SELECT lb.id, lb.borrower_id, lb.due_date, m.user_id, i.title
    FROM public.library_borrowing lb
    JOIN public.library_members m ON m.id = lb.borrower_id
    JOIN public.library_items i ON i.id = lb.library_item_id
    WHERE lb.organization_id = _org AND lb.status IN ('borrowed','overdue') AND lb.due_date < CURRENT_DATE
      AND NOT EXISTS (SELECT 1 FROM public.library_fines lf WHERE lf.borrowing_id = lb.id AND lf.fine_type IN ('lost','damaged'))
  LOOP
    d := CURRENT_DATE - b.due_date;
    UPDATE public.library_borrowing SET status = 'overdue' WHERE id = b.id AND status = 'borrowed';

    UPDATE public.library_fines SET days_overdue = d, fine_amount = d * s.fine_per_day
      WHERE borrowing_id = b.id AND fine_type = 'overdue' AND status = 'pending';
    IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.library_fines WHERE borrowing_id = b.id AND fine_type = 'overdue') THEN
      INSERT INTO public.library_fines (organization_id, borrowing_id, borrower_id, fine_amount, days_overdue, fine_type)
      VALUES (_org, b.id, b.borrower_id, d * s.fine_per_day, d, 'overdue');
    END IF;

    IF b.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
      VALUES (b.user_id, _org, 'library', 'Library item overdue',
              '"' || b.title || '" is ' || d || ' day(s) overdue.', '/library');
    END IF;
    n := n + 1;
  END LOOP;

  -- expire stale holds
  UPDATE public.library_reservations SET status = 'expired'
    WHERE organization_id = _org AND status = 'ready' AND expires_at < now();
  RETURN n;
END $$;

-- Announcements to library members
CREATE OR REPLACE FUNCTION public.library_send_announcement(_org uuid, _title text, _message text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_library_staff(auth.uid(), _org) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, action_url)
  SELECT DISTINCT user_id, _org, 'library', _title, _message, '/library'
  FROM public.library_members
  WHERE organization_id = _org AND status = 'active' AND user_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- The librarian role must exist in custom_roles or validate_role_assignment() rejects it.
INSERT INTO public.custom_roles (role_code, role_name, description, is_system_role, active)
VALUES ('librarian', 'Librarian', 'Manages the resource centre: catalogue, circulation, members and fines', true, true)
ON CONFLICT (role_code) DO NOTHING;
