-- A trainee whose registration moved to another VTC through an approved transfer keeps their record at the source VTC
-- with this status. (Kept in its own migration: a new enum value cannot be used in the transaction that adds it.)
ALTER TYPE public.trainee_status ADD VALUE IF NOT EXISTS 'transferred';
