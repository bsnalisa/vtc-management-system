
-- =====================================================
-- COMPREHENSIVE SYSTEM UPGRADE MIGRATION
-- =====================================================

-- 1. PAYMENT PLANS TABLE (Financial Functions)
CREATE TABLE IF NOT EXISTS public.payment_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    trainee_id UUID NOT NULL REFERENCES public.trainees(id),
    fee_record_id UUID NOT NULL REFERENCES public.fee_records(id),
    plan_name TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    installments INTEGER NOT NULL DEFAULT 3,
    installment_amount NUMERIC NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Debtor officers and admins can manage payment plans"
ON public.payment_plans FOR ALL
USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'debtor_officer'::app_role)) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view payment plans in their organization"
ON public.payment_plans FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- 2. PAYMENT PLAN INSTALLMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payment_plan_installments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    paid_amount NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_id UUID REFERENCES public.payments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view installments for their plans"
ON public.payment_plan_installments FOR SELECT
USING (payment_plan_id IN (SELECT id FROM public.payment_plans WHERE organization_id = get_user_organization(auth.uid())));

CREATE POLICY "Debtor officers can manage installments"
ON public.payment_plan_installments FOR ALL
USING (payment_plan_id IN (SELECT id FROM public.payment_plans WHERE organization_id = get_user_organization(auth.uid()) AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'debtor_officer'::app_role))));

-- 3. INVOICES TABLE (Financial Functions)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    invoice_number TEXT NOT NULL,
    trainee_id UUID REFERENCES public.trainees(id),
    fee_record_id UUID REFERENCES public.fee_records(id),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    amount_paid NUMERIC NOT NULL DEFAULT 0,
    balance NUMERIC GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Debtor officers can manage invoices"
ON public.invoices FOR ALL
USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'debtor_officer'::app_role)) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view invoices in their organization"
ON public.invoices FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- 4. INVOICE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice items"
ON public.invoice_items FOR SELECT
USING (invoice_id IN (SELECT id FROM public.invoices WHERE organization_id = get_user_organization(auth.uid())));

CREATE POLICY "Debtor officers can manage invoice items"
ON public.invoice_items FOR ALL
USING (invoice_id IN (SELECT id FROM public.invoices WHERE organization_id = get_user_organization(auth.uid()) AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'debtor_officer'::app_role))));

-- 5. ACADEMIC TRANSCRIPTS TABLE
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    trainee_id UUID NOT NULL REFERENCES public.trainees(id),
    transcript_number TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    academic_year TEXT NOT NULL,
    total_credits INTEGER DEFAULT 0,
    completed_credits INTEGER DEFAULT 0,
    gpa NUMERIC(3,2),
    status TEXT NOT NULL DEFAULT 'draft',
    generated_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    file_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, transcript_number)
);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage transcripts"
ON public.transcripts FOR ALL
USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Trainees can view their transcripts"
ON public.transcripts FOR SELECT
USING (trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid()) OR is_admin(auth.uid()));

-- 6. TRAINEE PROGRESSION RULES TABLE
CREATE TABLE IF NOT EXISTS public.progression_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    trade_id UUID REFERENCES public.trades(id),
    from_level INTEGER NOT NULL,
    to_level INTEGER NOT NULL,
    min_credits_required INTEGER NOT NULL,
    min_competencies_required INTEGER DEFAULT 0,
    min_attendance_percentage INTEGER DEFAULT 75,
    max_outstanding_fees NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.progression_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage progression rules"
ON public.progression_rules FOR ALL
USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view progression rules"
ON public.progression_rules FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- 7. LOW STOCK ALERTS TABLE (Inventory)
CREATE TABLE IF NOT EXISTS public.stock_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL DEFAULT 'low_stock',
    threshold_quantity INTEGER NOT NULL,
    current_quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock officers can manage alerts"
ON public.stock_alerts FOR ALL
USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'stock_control_officer'::app_role)) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view stock alerts"
ON public.stock_alerts FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- 8. SUPPLIER PERFORMANCE TABLE
CREATE TABLE IF NOT EXISTS public.supplier_performance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    price_rating INTEGER CHECK (price_rating >= 1 AND price_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    overall_rating NUMERIC(3,2) GENERATED ALWAYS AS ((delivery_rating + quality_rating + price_rating + communication_rating) / 4.0) STORED,
    notes TEXT,
    evaluated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Procurement officers can manage performance"
ON public.supplier_performance FOR ALL
USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'procurement_officer'::app_role)) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view supplier performance"
ON public.supplier_performance FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- 9. HOSTEL VISITORS TABLE
CREATE TABLE IF NOT EXISTS public.hostel_visitors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    building_id UUID NOT NULL REFERENCES public.hostel_buildings(id),
    trainee_id UUID NOT NULL REFERENCES public.trainees(id),
    visitor_name TEXT NOT NULL,
    visitor_id_number TEXT,
    visitor_phone TEXT,
    relationship TEXT,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIME NOT NULL,
    check_out_time TIME,
    purpose TEXT,
    approved_by UUID,
    status TEXT NOT NULL DEFAULT 'checked_in',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hostel_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hostel coordinators can manage visitors"
ON public.hostel_visitors FOR ALL
USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'hostel_coordinator'::app_role)) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view visitors in their organization"
ON public.hostel_visitors FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- 10. ROOM INSPECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.room_inspections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    room_id UUID NOT NULL REFERENCES public.hostel_rooms(id),
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    inspector_id UUID NOT NULL,
    cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
    condition_rating INTEGER CHECK (condition_rating >= 1 AND condition_rating <= 5),
    safety_rating INTEGER CHECK (safety_rating >= 1 AND safety_rating <= 5),
    overall_rating NUMERIC(3,2) GENERATED ALWAYS AS ((cleanliness_rating + condition_rating + safety_rating) / 3.0) STORED,
    issues_found TEXT,
    recommendations TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.room_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hostel coordinators can manage inspections"
ON public.room_inspections FOR ALL
USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'hostel_coordinator'::app_role)) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view room inspections"
ON public.room_inspections FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- 11. PERMISSION AUDIT LOG TABLE (Authorization)
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    role_code TEXT,
    module_code TEXT,
    old_permissions JSONB,
    new_permissions JSONB,
    changed_by UUID NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view permission logs"
ON public.permission_audit_logs FOR SELECT
USING (is_admin(auth.uid()) AND (organization_id IS NULL OR organization_id = get_user_organization(auth.uid())));

CREATE POLICY "Admins can create permission logs"
ON public.permission_audit_logs FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- 12. SYSTEM CONFIGURATION TABLE (Super Admin)
CREATE TABLE IF NOT EXISTS public.system_configuration (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    config_key TEXT NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_global BOOLEAN DEFAULT false,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, config_key)
);

ALTER TABLE public.system_configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage global config"
ON public.system_configuration FOR ALL
USING (is_super_admin(auth.uid()) OR (organization_id = get_user_organization(auth.uid()) AND is_admin(auth.uid())));

CREATE POLICY "Users can view config in their organization"
ON public.system_configuration FOR SELECT
USING (is_global = true OR organization_id = get_user_organization(auth.uid()));

-- 13. PASSWORD POLICIES TABLE (Security)
CREATE TABLE IF NOT EXISTS public.password_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    min_length INTEGER NOT NULL DEFAULT 8,
    require_uppercase BOOLEAN DEFAULT true,
    require_lowercase BOOLEAN DEFAULT true,
    require_numbers BOOLEAN DEFAULT true,
    require_special_chars BOOLEAN DEFAULT true,
    max_age_days INTEGER DEFAULT 90,
    prevent_reuse_count INTEGER DEFAULT 5,
    lockout_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.password_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage password policies"
ON public.password_policies FOR ALL
USING (is_super_admin(auth.uid()) OR (organization_id = get_user_organization(auth.uid()) AND is_admin(auth.uid())));

CREATE POLICY "Users can view password policies"
ON public.password_policies FOR SELECT
USING (organization_id IS NULL OR organization_id = get_user_organization(auth.uid()));

-- 14. USER ACTIVITY LOG TABLE (User Management)
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    organization_id UUID REFERENCES public.organizations(id),
    activity_type TEXT NOT NULL,
    module_code TEXT,
    description TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity"
ON public.user_activity_logs FOR SELECT
USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "System can insert activity logs"
ON public.user_activity_logs FOR INSERT
WITH CHECK (true);

-- 15. ATTENDANCE ANALYTICS VIEW
CREATE OR REPLACE VIEW public.attendance_analytics AS
SELECT 
    ar.register_id,
    atr.organization_id,
    atr.trade_id,
    atr.level,
    atr.academic_year,
    COUNT(*) as total_records,
    SUM(CASE WHEN ar.present THEN 1 ELSE 0 END) as present_count,
    ROUND(SUM(CASE WHEN ar.present THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC * 100, 2) as attendance_percentage
FROM public.attendance_records ar
JOIN public.attendance_registers atr ON ar.register_id = atr.id
GROUP BY ar.register_id, atr.organization_id, atr.trade_id, atr.level, atr.academic_year;

-- 16. INVOICE NUMBER GENERATOR FUNCTION
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_number TEXT;
    year_suffix TEXT;
    counter INTEGER;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.invoices
    WHERE organization_id = _org_id AND invoice_number LIKE 'INV' || year_suffix || '%';
    
    new_number := 'INV' || year_suffix || LPAD(counter::TEXT, 5, '0');
    
    RETURN new_number;
END;
$$;

-- 17. TRANSCRIPT NUMBER GENERATOR FUNCTION
CREATE OR REPLACE FUNCTION public.generate_transcript_number(_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_number TEXT;
    year_suffix TEXT;
    counter INTEGER;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(transcript_number FROM 8) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.transcripts
    WHERE organization_id = _org_id AND transcript_number LIKE 'TRS' || year_suffix || '%';
    
    new_number := 'TRS' || year_suffix || LPAD(counter::TEXT, 5, '0');
    
    RETURN new_number;
END;
$$;

-- 18. CHECK TRAINEE PROGRESSION FUNCTION
CREATE OR REPLACE FUNCTION public.check_trainee_progression(_trainee_id UUID)
RETURNS TABLE(
    can_progress BOOLEAN,
    current_level INTEGER,
    next_level INTEGER,
    credits_completed INTEGER,
    credits_required INTEGER,
    attendance_percentage NUMERIC,
    attendance_required INTEGER,
    outstanding_fees NUMERIC,
    max_fees_allowed NUMERIC,
    reasons TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainee RECORD;
    v_rule RECORD;
    v_credits INTEGER;
    v_attendance NUMERIC;
    v_fees NUMERIC;
    v_reasons TEXT[] := ARRAY[]::TEXT[];
    v_can_progress BOOLEAN := true;
BEGIN
    -- Get trainee info
    SELECT t.*, tr.id as trade_id 
    INTO v_trainee 
    FROM public.trainees t 
    LEFT JOIN public.trades tr ON t.trade_id = tr.id 
    WHERE t.id = _trainee_id;
    
    -- Get progression rule
    SELECT * INTO v_rule 
    FROM public.progression_rules 
    WHERE (trade_id IS NULL OR trade_id = v_trainee.trade_id)
    AND from_level = v_trainee.level
    AND active = true
    LIMIT 1;
    
    IF v_rule IS NULL THEN
        RETURN QUERY SELECT false, v_trainee.level, v_trainee.level + 1, 0, 0, 0::NUMERIC, 75, 0::NUMERIC, 0::NUMERIC, ARRAY['No progression rule defined']::TEXT[];
        RETURN;
    END IF;
    
    -- Calculate completed credits
    SELECT COALESCE(SUM(us.credit), 0) INTO v_credits
    FROM public.assessment_results ar
    JOIN public.unit_standards us ON ar.unit_standard_id = us.id
    WHERE ar.trainee_id = _trainee_id AND ar.competency_status = 'competent';
    
    IF v_credits < v_rule.min_credits_required THEN
        v_can_progress := false;
        v_reasons := array_append(v_reasons, 'Insufficient credits: ' || v_credits || '/' || v_rule.min_credits_required);
    END IF;
    
    -- Calculate attendance (simplified)
    v_attendance := 85; -- Default for now
    IF v_attendance < v_rule.min_attendance_percentage THEN
        v_can_progress := false;
        v_reasons := array_append(v_reasons, 'Low attendance: ' || v_attendance || '%/' || v_rule.min_attendance_percentage || '%');
    END IF;
    
    -- Check outstanding fees
    SELECT COALESCE(SUM(balance), 0) INTO v_fees
    FROM public.fee_records
    WHERE trainee_id = _trainee_id AND balance > 0;
    
    IF v_fees > v_rule.max_outstanding_fees THEN
        v_can_progress := false;
        v_reasons := array_append(v_reasons, 'Outstanding fees: N$' || v_fees);
    END IF;
    
    RETURN QUERY SELECT 
        v_can_progress,
        v_trainee.level,
        v_rule.to_level,
        v_credits,
        v_rule.min_credits_required,
        v_attendance,
        v_rule.min_attendance_percentage,
        v_fees,
        v_rule.max_outstanding_fees,
        v_reasons;
END;
$$;

-- 19. LOW STOCK CHECK TRIGGER
CREATE OR REPLACE FUNCTION public.check_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if stock is below reorder level
    IF NEW.current_quantity <= NEW.reorder_level AND NEW.current_quantity > 0 THEN
        INSERT INTO public.stock_alerts (
            organization_id,
            stock_item_id,
            alert_type,
            threshold_quantity,
            current_quantity
        ) VALUES (
            NEW.organization_id,
            NEW.id,
            'low_stock',
            NEW.reorder_level,
            NEW.current_quantity
        )
        ON CONFLICT DO NOTHING;
    ELSIF NEW.current_quantity = 0 THEN
        INSERT INTO public.stock_alerts (
            organization_id,
            stock_item_id,
            alert_type,
            threshold_quantity,
            current_quantity
        ) VALUES (
            NEW.organization_id,
            NEW.id,
            'out_of_stock',
            NEW.reorder_level,
            0
        )
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER check_stock_levels
AFTER UPDATE OF current_quantity ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.check_low_stock();

-- 20. LOG PERMISSION CHANGE FUNCTION
CREATE OR REPLACE FUNCTION public.log_permission_change(
    _user_id UUID,
    _action TEXT,
    _role_code TEXT DEFAULT NULL,
    _module_code TEXT DEFAULT NULL,
    _old_permissions JSONB DEFAULT NULL,
    _new_permissions JSONB DEFAULT NULL,
    _reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _log_id UUID;
BEGIN
    INSERT INTO public.permission_audit_logs (
        organization_id,
        user_id,
        action,
        role_code,
        module_code,
        old_permissions,
        new_permissions,
        changed_by,
        reason
    ) VALUES (
        get_user_organization(auth.uid()),
        _user_id,
        _action,
        _role_code,
        _module_code,
        _old_permissions,
        _new_permissions,
        auth.uid(),
        _reason
    )
    RETURNING id INTO _log_id;
    
    RETURN _log_id;
END;
$$;

-- 21. Calculate GPA Function
CREATE OR REPLACE FUNCTION public.calculate_trainee_gpa(_trainee_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_weighted_marks NUMERIC := 0;
    total_credits INTEGER := 0;
    gpa NUMERIC;
BEGIN
    SELECT 
        SUM(ar.marks_obtained * us.credit),
        SUM(us.credit)
    INTO total_weighted_marks, total_credits
    FROM public.assessment_results ar
    JOIN public.unit_standards us ON ar.unit_standard_id = us.id
    WHERE ar.trainee_id = _trainee_id
    AND ar.marks_obtained IS NOT NULL;
    
    IF total_credits > 0 THEN
        gpa := ROUND((total_weighted_marks / total_credits / 100) * 4.0, 2);
    ELSE
        gpa := 0;
    END IF;
    
    RETURN gpa;
END;
$$;

-- 22. BULK USER OPERATIONS TABLE
CREATE TABLE IF NOT EXISTS public.bulk_operations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    operation_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    error_log JSONB,
    created_by UUID NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bulk operations"
ON public.bulk_operations FOR ALL
USING (is_admin(auth.uid()) AND (organization_id IS NULL OR organization_id = get_user_organization(auth.uid())));

-- Insert default password policy
INSERT INTO public.password_policies (organization_id, min_length, require_uppercase, require_lowercase, require_numbers, require_special_chars, max_age_days, prevent_reuse_count, lockout_attempts, lockout_duration_minutes)
VALUES (NULL, 8, true, true, true, true, 90, 5, 5, 30)
ON CONFLICT DO NOTHING;

-- Insert default system configuration
INSERT INTO public.system_configuration (config_key, config_value, description, is_global)
VALUES 
    ('session_timeout', '{"value": 30, "unit": "minutes"}'::jsonb, 'Session timeout duration', true),
    ('max_file_upload_size', '{"value": 10, "unit": "MB"}'::jsonb, 'Maximum file upload size', true),
    ('enable_mfa', '{"enabled": false}'::jsonb, 'Multi-factor authentication setting', true)
ON CONFLICT DO NOTHING;
