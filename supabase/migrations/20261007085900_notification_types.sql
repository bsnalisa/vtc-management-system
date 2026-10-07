-- notifications.type is constrained; the new modules send these additional types.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'fee_reminder', 'marks_released', 'marks_withheld', 'registration', 'general',
  'library', 'graduation', 'assessment'
]));
