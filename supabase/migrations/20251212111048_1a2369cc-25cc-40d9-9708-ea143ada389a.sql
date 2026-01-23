-- Enable RLS on namibia_regions
ALTER TABLE public.namibia_regions ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view regions (public reference data)
CREATE POLICY "Everyone can view regions"
    ON public.namibia_regions FOR SELECT
    USING (true);