
-- ═══════════════════════════════════════════════════════════
-- Phase 5: Mark Query/Dispute Workflow
-- ═══════════════════════════════════════════════════════════

-- Mark queries/disputes table
CREATE TABLE public.gradebook_mark_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gradebook_id UUID NOT NULL REFERENCES public.gradebooks(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.gradebook_components(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  query_type TEXT NOT NULL DEFAULT 'marks_query' CHECK (query_type IN ('marks_query', 'competency_query', 'feedback_query', 'general')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gradebook_mark_queries ENABLE ROW LEVEL SECURITY;

-- Trainees can view and create their own queries
CREATE POLICY "Trainees view own mark queries"
ON public.gradebook_mark_queries
FOR SELECT
TO authenticated
USING (
  trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
);

CREATE POLICY "Trainees create own mark queries"
ON public.gradebook_mark_queries
FOR INSERT
TO authenticated
WITH CHECK (
  trainee_id IN (SELECT id FROM public.trainees WHERE user_id = auth.uid())
);

-- Staff can view and manage all mark queries in their org
CREATE POLICY "Staff manage mark queries"
ON public.gradebook_mark_queries
FOR ALL
TO authenticated
USING (
  gradebook_id IN (
    SELECT g.id FROM public.gradebooks g
    WHERE g.organization_id IN (
      SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('trainer', 'head_of_training', 'assessment_coordinator', 'organization_admin', 'super_admin')
    )
  )
);

-- Enable realtime for mark queries
ALTER PUBLICATION supabase_realtime ADD TABLE public.gradebook_mark_queries;
