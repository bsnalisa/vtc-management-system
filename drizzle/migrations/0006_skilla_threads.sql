CREATE TABLE public.skilla_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skilla_threads TO authenticated;
GRANT ALL ON public.skilla_threads TO service_role;
ALTER TABLE public.skilla_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Skilla chats" ON public.skilla_threads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX skilla_threads_user_idx ON public.skilla_threads(user_id, updated_at DESC);