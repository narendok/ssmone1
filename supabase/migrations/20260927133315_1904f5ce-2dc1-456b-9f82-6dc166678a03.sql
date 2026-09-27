CREATE TABLE public.user_saved_record_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  query_text text NOT NULL DEFAULT '',
  record_kind text NOT NULL DEFAULT 'all' CHECK (record_kind IN ('all', 'client', 'project', 'audit', 'document')),
  status_filter text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_record_searches TO authenticated;
GRANT ALL ON public.user_saved_record_searches TO service_role;

ALTER TABLE public.user_saved_record_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their saved record searches"
  ON public.user_saved_record_searches FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their saved record searches"
  ON public.user_saved_record_searches FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their saved record searches"
  ON public.user_saved_record_searches FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their saved record searches"
  ON public.user_saved_record_searches FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER user_saved_record_searches_touch_updated_at
  BEFORE UPDATE ON public.user_saved_record_searches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();