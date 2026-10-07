-- Privacy fix: several policies let EVERY member of an organisation (including trainees) read other trainees'
-- fees, balances, results, invoices and registrations, one let any signed-in user of any organisation read attendance,
-- and one let trainees write final continuous-assessment results.
-- After this migration: staff (any non-trainee role in the centre) keep the access they had; trainees see only their
-- own rows; nothing is readable across organisations.

-- Any role other than trainee, in that organisation
CREATE OR REPLACE FUNCTION public.is_org_staff(_user_id uuid, _org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.organization_id = _org AND ur.role::text <> 'trainee');
$$;

-- The caller is this trainee
CREATE OR REPLACE FUNCTION public.is_own_trainee(_trainee uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _trainee IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trainees t WHERE t.id = _trainee AND t.user_id = auth.uid());
$$;

-- The caller owns this application (applicants who are provisioned before they have a trainee record)
CREATE OR REPLACE FUNCTION public.is_own_application(_application uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _application IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trainee_applications a WHERE a.id = _application AND a.user_id = auth.uid());
$$;

-- ---- trainee-linked tables: staff of the centre, or the trainee themselves --------------------------------------
DROP POLICY IF EXISTS "Users can view alumni in their organization" ON public.alumni;
CREATE POLICY "Staff or the graduate view alumni" ON public.alumni FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));

DROP POLICY IF EXISTS "Staff can view ca final results" ON public.ca_final_results;
CREATE POLICY "Staff or the trainee view ca final results" ON public.ca_final_results FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));
-- trainees could previously insert/update/delete these; only assessment and academic staff may write directly
DROP POLICY IF EXISTS "System can manage ca final results" ON public.ca_final_results;
CREATE POLICY "Assessment staff manage ca final results" ON public.ca_final_results FOR ALL
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['assessment_coordinator','admin','organization_admin','head_of_training']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['assessment_coordinator','admin','organization_admin','head_of_training']));

DROP POLICY IF EXISTS "Users can view fees in their organization" ON public.hostel_fees;
CREATE POLICY "Staff or the resident view hostel fees" ON public.hostel_fees FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));

DROP POLICY IF EXISTS "Users can view visitors in their organization" ON public.hostel_visitors;
CREATE POLICY "Staff or the resident view hostel visitors" ON public.hostel_visitors FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));

DROP POLICY IF EXISTS "Users can view invoices in their organization" ON public.invoices;
CREATE POLICY "Staff or the trainee view invoices" ON public.invoices FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));

DROP POLICY IF EXISTS "Users can view payment plans in their organization" ON public.payment_plans;
CREATE POLICY "Staff or the trainee view payment plans" ON public.payment_plans FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));

DROP POLICY IF EXISTS "Staff can view summative results" ON public.summative_results;
CREATE POLICY "Staff or the trainee view summative results" ON public.summative_results FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));

DROP POLICY IF EXISTS "Staff can view qualification results" ON public.qualification_results;
CREATE POLICY "Staff or the trainee view qualification results" ON public.qualification_results FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));

DROP POLICY IF EXISTS "Users can view proof of registrations" ON public.proof_of_registrations;
CREATE POLICY "Staff or the trainee view proof of registrations" ON public.proof_of_registrations FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id));

-- Admins of ANOTHER organisation could read these (is_admin() is not organisation-scoped); admins of this one already
-- have "Admins can manage transcripts".
DROP POLICY IF EXISTS "Trainees can view their transcripts" ON public.transcripts;
CREATE POLICY "Trainees view their own transcripts" ON public.transcripts FOR SELECT
  USING (public.is_own_trainee(trainee_id));

-- ---- finance ---------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "tfa_org_read" ON public.trainee_financial_accounts;
CREATE POLICY "tfa_staff_or_owner_read" ON public.trainee_financial_accounts FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR public.is_own_trainee(trainee_id) OR public.is_own_application(application_id));

DROP POLICY IF EXISTS "ft_org_read" ON public.financial_transactions;
CREATE POLICY "ft_staff_or_owner_read" ON public.financial_transactions FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id) OR EXISTS (
    SELECT 1 FROM public.trainee_financial_accounts a
    WHERE a.id = financial_transactions.account_id
      AND (public.is_own_trainee(a.trainee_id) OR public.is_own_application(a.application_id))));

-- ---- exam timetables: unpublished ones are for staff only (trainees keep "Trainees can view published exam timetables")
DROP POLICY IF EXISTS "Staff can view exam timetables" ON public.exam_timetables;
CREATE POLICY "Staff can view exam timetables" ON public.exam_timetables FOR SELECT
  USING (public.is_org_staff(auth.uid(), organization_id));

-- ---- attendance: was readable by any signed-in user of any organisation, and writable by trainers/admins of any ---
DROP POLICY IF EXISTS "Authenticated users can view attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Trainers and admins can manage attendance records" ON public.attendance_records;
CREATE POLICY "Staff or the trainee view attendance" ON public.attendance_records FOR SELECT
  USING (public.is_own_trainee(trainee_id) OR EXISTS (
    SELECT 1 FROM public.attendance_registers r WHERE r.id = attendance_records.register_id AND public.is_org_staff(auth.uid(), r.organization_id)));
CREATE POLICY "Teaching staff manage attendance in their centre" ON public.attendance_records FOR ALL
  USING (EXISTS (SELECT 1 FROM public.attendance_registers r WHERE r.id = attendance_records.register_id
                 AND public.has_org_role(auth.uid(), r.organization_id, ARRAY['trainer','admin','organization_admin','head_of_training','hod'])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.attendance_registers r WHERE r.id = attendance_records.register_id
                 AND public.has_org_role(auth.uid(), r.organization_id, ARRAY['trainer','admin','organization_admin','head_of_training','hod'])));

DROP POLICY IF EXISTS "Trainers and admins can create attendance registers" ON public.attendance_registers;
CREATE POLICY "Teaching staff create attendance registers in their centre" ON public.attendance_registers FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['trainer','admin','organization_admin','head_of_training','hod']));
CREATE POLICY "Teaching staff update attendance registers in their centre" ON public.attendance_registers FOR UPDATE
  USING (public.has_org_role(auth.uid(), organization_id, ARRAY['trainer','admin','organization_admin','head_of_training','hod']))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['trainer','admin','organization_admin','head_of_training','hod']));
