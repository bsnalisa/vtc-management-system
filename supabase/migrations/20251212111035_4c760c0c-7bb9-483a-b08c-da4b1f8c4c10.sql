-- ============================================
-- COMPREHENSIVE TRAINEE APPLICATION SYSTEM
-- ============================================

-- 1. Create entry_requirements table for course admission requirements
CREATE TABLE IF NOT EXISTS public.entry_requirements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    trade_id UUID NOT NULL REFERENCES public.trades(id),
    level INTEGER NOT NULL,
    requirement_name TEXT NOT NULL,
    min_grade INTEGER DEFAULT 10,
    min_points INTEGER DEFAULT 20,
    required_subjects JSONB DEFAULT '[]'::jsonb,
    english_symbol TEXT DEFAULT 'F',
    maths_symbol TEXT DEFAULT 'F',
    science_symbol TEXT,
    prevocational_symbol TEXT,
    requires_previous_level BOOLEAN DEFAULT false,
    previous_level_required INTEGER,
    mature_age_entry BOOLEAN DEFAULT false,
    mature_min_age INTEGER DEFAULT 23,
    mature_min_experience_years INTEGER DEFAULT 3,
    additional_requirements TEXT,
    active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    pending_changes JSONB,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create symbol_points table for grade symbol to points conversion
CREATE TABLE IF NOT EXISTS public.symbol_points (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    exam_level TEXT NOT NULL,
    symbol TEXT NOT NULL,
    points INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, exam_level, symbol)
);

-- 3. Add new columns to trainee_applications for comprehensive form
ALTER TABLE public.trainee_applications 
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Namibian',
    ADD COLUMN IF NOT EXISTS marital_status TEXT,
    ADD COLUMN IF NOT EXISTS region TEXT,
    ADD COLUMN IF NOT EXISTS postal_address TEXT,
    ADD COLUMN IF NOT EXISTS photo_path TEXT,
    ADD COLUMN IF NOT EXISTS trade_id_choice2 UUID REFERENCES public.trades(id),
    ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_region TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_email TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_town TEXT,
    ADD COLUMN IF NOT EXISTS highest_grade_passed INTEGER,
    ADD COLUMN IF NOT EXISTS school_subjects JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS calculated_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tertiary_institution TEXT,
    ADD COLUMN IF NOT EXISTS tertiary_region TEXT,
    ADD COLUMN IF NOT EXISTS tertiary_address TEXT,
    ADD COLUMN IF NOT EXISTS tertiary_phone TEXT,
    ADD COLUMN IF NOT EXISTS tertiary_fax TEXT,
    ADD COLUMN IF NOT EXISTS tertiary_exam_year INTEGER,
    ADD COLUMN IF NOT EXISTS employer_name TEXT,
    ADD COLUMN IF NOT EXISTS employer_address TEXT,
    ADD COLUMN IF NOT EXISTS employer_phone TEXT,
    ADD COLUMN IF NOT EXISTS employer_fax TEXT,
    ADD COLUMN IF NOT EXISTS employer_town TEXT,
    ADD COLUMN IF NOT EXISTS employer_region TEXT,
    ADD COLUMN IF NOT EXISTS employer_position TEXT,
    ADD COLUMN IF NOT EXISTS employer_duration TEXT,
    ADD COLUMN IF NOT EXISTS employer_email TEXT,
    ADD COLUMN IF NOT EXISTS needs_financial_assistance BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS needs_hostel_accommodation BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hostel_application_data JSONB,
    ADD COLUMN IF NOT EXISTS has_disability BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS disability_description TEXT,
    ADD COLUMN IF NOT EXISTS has_special_needs BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS special_needs_description TEXT,
    ADD COLUMN IF NOT EXISTS has_chronic_diseases BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS chronic_diseases_description TEXT,
    ADD COLUMN IF NOT EXISTS shoe_size TEXT,
    ADD COLUMN IF NOT EXISTS overall_size TEXT,
    ADD COLUMN IF NOT EXISTS tshirt_size TEXT,
    ADD COLUMN IF NOT EXISTS skirt_trousers_size TEXT,
    ADD COLUMN IF NOT EXISTS chef_trouser_size TEXT,
    ADD COLUMN IF NOT EXISTS chef_jacket_size TEXT,
    ADD COLUMN IF NOT EXISTS ict_access JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS id_document_path TEXT,
    ADD COLUMN IF NOT EXISTS school_leaving_cert_path TEXT,
    ADD COLUMN IF NOT EXISTS academic_qualifications_path TEXT,
    ADD COLUMN IF NOT EXISTS additional_documents_paths JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS declaration_accepted BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS declaration_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auto_qualification_result JSONB,
    ADD COLUMN IF NOT EXISTS qualification_reasons JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_mature_age_entry BOOLEAN DEFAULT false;

-- 4. Create requirement_change_requests table for approval workflow
CREATE TABLE IF NOT EXISTS public.requirement_change_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    entry_requirement_id UUID REFERENCES public.entry_requirements(id),
    request_type TEXT NOT NULL,
    proposed_changes JSONB NOT NULL,
    requested_by UUID NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create Namibian regions reference table
CREATE TABLE IF NOT EXISTS public.namibia_regions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true
);

-- Insert Namibian regions
INSERT INTO public.namibia_regions (name, code) VALUES
    ('Erongo', 'ERO'),
    ('Hardap', 'HAR'),
    ('Karas', 'KAR'),
    ('Kavango East', 'KVE'),
    ('Kavango West', 'KVW'),
    ('Khomas', 'KHO'),
    ('Kunene', 'KUN'),
    ('Ohangwena', 'OHA'),
    ('Omaheke', 'OMA'),
    ('Omusati', 'OMU'),
    ('Oshana', 'OSH'),
    ('Oshikoto', 'OSK'),
    ('Otjozondjupa', 'OTJ'),
    ('Zambezi', 'ZAM')
ON CONFLICT (name) DO NOTHING;

-- 6. Create trade_levels table for trade-level combinations
CREATE TABLE IF NOT EXISTS public.trade_levels (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    trade_id UUID NOT NULL REFERENCES public.trades(id),
    level INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    capacity INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, trade_id, level)
);

-- Enable RLS on new tables
ALTER TABLE public.entry_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbol_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for entry_requirements
CREATE POLICY "Users can view entry requirements in their org"
    ON public.entry_requirements FOR SELECT
    USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and ROs can manage entry requirements"
    ON public.entry_requirements FOR ALL
    USING (
        (is_admin(auth.uid()) OR has_role(auth.uid(), 'registration_officer'::app_role) OR has_role(auth.uid(), 'head_trainee_support'::app_role))
        AND organization_id = get_user_organization(auth.uid())
    );

-- RLS Policies for symbol_points
CREATE POLICY "Users can view symbol points in their org"
    ON public.symbol_points FOR SELECT
    USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage symbol points"
    ON public.symbol_points FOR ALL
    USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

-- RLS Policies for requirement_change_requests
CREATE POLICY "Users can view change requests in their org"
    ON public.requirement_change_requests FOR SELECT
    USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "ROs can create change requests"
    ON public.requirement_change_requests FOR INSERT
    WITH CHECK (
        (has_role(auth.uid(), 'registration_officer'::app_role) OR is_admin(auth.uid()))
        AND organization_id = get_user_organization(auth.uid())
    );

CREATE POLICY "HoTS can approve change requests"
    ON public.requirement_change_requests FOR UPDATE
    USING (
        (has_role(auth.uid(), 'head_trainee_support'::app_role) OR is_admin(auth.uid()))
        AND organization_id = get_user_organization(auth.uid())
    );

-- RLS Policies for trade_levels
CREATE POLICY "Users can view trade levels in their org"
    ON public.trade_levels FOR SELECT
    USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and HoT can manage trade levels"
    ON public.trade_levels FOR ALL
    USING (
        (is_admin(auth.uid()) OR has_role(auth.uid(), 'head_of_training'::app_role))
        AND organization_id = get_user_organization(auth.uid())
    );

-- Function to calculate points from subjects
CREATE OR REPLACE FUNCTION public.calculate_application_points(
    _school_subjects JSONB,
    _org_id UUID
) RETURNS INTEGER AS $$
DECLARE
    total_points INTEGER := 0;
    subject JSONB;
    symbol_point INTEGER;
BEGIN
    IF _school_subjects IS NULL OR jsonb_array_length(_school_subjects) = 0 THEN
        RETURN 0;
    END IF;
    
    FOR subject IN SELECT * FROM jsonb_array_elements(_school_subjects)
    LOOP
        SELECT sp.points INTO symbol_point
        FROM public.symbol_points sp
        WHERE sp.organization_id = _org_id
          AND sp.exam_level = subject->>'exam_level'
          AND sp.symbol = subject->>'symbol'
        LIMIT 1;
        
        total_points := total_points + COALESCE(symbol_point, 0);
    END LOOP;
    
    RETURN total_points;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;