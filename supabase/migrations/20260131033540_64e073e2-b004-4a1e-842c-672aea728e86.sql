-- Add unique constraint on national_id per organization to prevent duplicate applications
ALTER TABLE public.trainee_applications 
ADD CONSTRAINT trainee_applications_national_id_org_unique 
UNIQUE (organization_id, national_id);