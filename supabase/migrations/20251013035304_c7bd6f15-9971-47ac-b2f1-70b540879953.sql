-- First migration: Add the assessment_coordinator role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'assessment_coordinator';