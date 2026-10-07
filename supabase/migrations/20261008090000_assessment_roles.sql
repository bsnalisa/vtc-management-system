-- New roles for the assessment workflow. Kept in their own migration because a new enum value
-- cannot be used in the transaction that adds it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'subject_matter_expert';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'printing_distribution_officer';
