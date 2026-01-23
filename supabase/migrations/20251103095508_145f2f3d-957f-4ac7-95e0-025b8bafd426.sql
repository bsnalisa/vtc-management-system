-- Add full-text search capabilities
-- Create GIN indexes for full-text search on trainees
CREATE INDEX IF NOT EXISTS idx_trainees_search 
ON public.trainees USING GIN (
  to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(trainee_id, '') || ' ' || 
    COALESCE(national_id, '') || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(phone, '')
  )
);

-- Create GIN index for trainers full-text search
CREATE INDEX IF NOT EXISTS idx_trainers_search 
ON public.trainers USING GIN (
  to_tsvector('english', 
    COALESCE(full_name, '') || ' ' || 
    COALESCE(trainer_id, '') || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(phone, '')
  )
);

-- Create GIN index for courses full-text search
CREATE INDEX IF NOT EXISTS idx_courses_search 
ON public.courses USING GIN (
  to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(code, '') || ' ' || 
    COALESCE(description, '')
  )
);

-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_trainees_org_status ON public.trainees(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_trainees_trade_level ON public.trainees(trade_id, level);
CREATE INDEX IF NOT EXISTS idx_trainers_org_active ON public.trainers(organization_id, active);
CREATE INDEX IF NOT EXISTS idx_classes_org_year ON public.classes(organization_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_fee_records_trainee ON public.fee_records(trainee_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_payments_fee_record ON public.payments(fee_record_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_trainee ON public.trainee_enrollments(trainee_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_trainee ON public.attendance_records(trainee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_marks_assessment ON public.marks(assessment_id, trainee_id);

-- Create global search function
CREATE OR REPLACE FUNCTION public.global_search(
  search_query TEXT,
  org_id UUID DEFAULT NULL,
  search_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  result_type TEXT,
  result_id UUID,
  result_data JSONB,
  relevance REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Search trainees
  SELECT 
    'trainee'::TEXT as result_type,
    t.id as result_id,
    jsonb_build_object(
      'id', t.id,
      'trainee_id', t.trainee_id,
      'name', t.first_name || ' ' || t.last_name,
      'email', t.email,
      'phone', t.phone,
      'trade', tr.name,
      'level', t.level
    ) as result_data,
    ts_rank(
      to_tsvector('english', 
        COALESCE(t.first_name, '') || ' ' || 
        COALESCE(t.last_name, '') || ' ' || 
        COALESCE(t.trainee_id, '') || ' ' || 
        COALESCE(t.national_id, '') || ' ' || 
        COALESCE(t.email, '') || ' ' || 
        COALESCE(t.phone, '')
      ),
      plainto_tsquery('english', search_query)
    ) as relevance
  FROM public.trainees t
  LEFT JOIN public.trades tr ON t.trade_id = tr.id
  WHERE 
    (org_id IS NULL OR t.organization_id = org_id)
    AND to_tsvector('english', 
      COALESCE(t.first_name, '') || ' ' || 
      COALESCE(t.last_name, '') || ' ' || 
      COALESCE(t.trainee_id, '') || ' ' || 
      COALESCE(t.national_id, '') || ' ' || 
      COALESCE(t.email, '') || ' ' || 
      COALESCE(t.phone, '')
    ) @@ plainto_tsquery('english', search_query)
  
  UNION ALL
  
  -- Search trainers
  SELECT 
    'trainer'::TEXT as result_type,
    tr.id as result_id,
    jsonb_build_object(
      'id', tr.id,
      'trainer_id', tr.trainer_id,
      'name', tr.full_name,
      'email', tr.email,
      'phone', tr.phone,
      'designation', tr.designation
    ) as result_data,
    ts_rank(
      to_tsvector('english', 
        COALESCE(tr.full_name, '') || ' ' || 
        COALESCE(tr.trainer_id, '') || ' ' || 
        COALESCE(tr.email, '') || ' ' || 
        COALESCE(tr.phone, '')
      ),
      plainto_tsquery('english', search_query)
    ) as relevance
  FROM public.trainers tr
  WHERE 
    (org_id IS NULL OR tr.organization_id = org_id)
    AND to_tsvector('english', 
      COALESCE(tr.full_name, '') || ' ' || 
      COALESCE(tr.trainer_id, '') || ' ' || 
      COALESCE(tr.email, '') || ' ' || 
      COALESCE(tr.phone, '')
    ) @@ plainto_tsquery('english', search_query)
  
  UNION ALL
  
  -- Search courses
  SELECT 
    'course'::TEXT as result_type,
    c.id as result_id,
    jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'name', c.name,
      'description', c.description,
      'level', c.level,
      'trade', t.name
    ) as result_data,
    ts_rank(
      to_tsvector('english', 
        COALESCE(c.name, '') || ' ' || 
        COALESCE(c.code, '') || ' ' || 
        COALESCE(c.description, '')
      ),
      plainto_tsquery('english', search_query)
    ) as relevance
  FROM public.courses c
  LEFT JOIN public.trades t ON c.trade_id = t.id
  WHERE 
    c.active = true
    AND to_tsvector('english', 
      COALESCE(c.name, '') || ' ' || 
      COALESCE(c.code, '') || ' ' || 
      COALESCE(c.description, '')
    ) @@ plainto_tsquery('english', search_query)
  
  ORDER BY relevance DESC
  LIMIT search_limit;
END;
$$;

-- Create function for checking subscription expiry
CREATE OR REPLACE FUNCTION public.check_subscription_expiry()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  package_name TEXT,
  days_remaining INTEGER,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    op.organization_id,
    o.name as organization_name,
    p.name as package_name,
    EXTRACT(DAY FROM (op.end_date - CURRENT_DATE))::INTEGER as days_remaining,
    op.status
  FROM public.organization_packages op
  JOIN public.organizations o ON op.organization_id = o.id
  JOIN public.packages p ON op.package_id = p.id
  WHERE op.status = 'active'
    AND op.end_date IS NOT NULL
    AND op.end_date <= CURRENT_DATE + INTERVAL '30 days'
  ORDER BY op.end_date ASC;
$$;

-- Add comments
COMMENT ON FUNCTION public.global_search IS 'Full-text search across trainees, trainers, and courses';
COMMENT ON FUNCTION public.check_subscription_expiry IS 'Check for subscriptions expiring in the next 30 days';