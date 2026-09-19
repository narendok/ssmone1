CREATE TABLE public.shared_boms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Shared component list',
  payload jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX shared_boms_created_by_idx ON public.shared_boms(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_boms TO authenticated;
GRANT ALL ON public.shared_boms TO service_role;

ALTER TABLE public.shared_boms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_boms select own" ON public.shared_boms
  FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "shared_boms insert own" ON public.shared_boms
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "shared_boms update own" ON public.shared_boms
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "shared_boms delete own" ON public.shared_boms
  FOR DELETE TO authenticated USING (created_by = auth.uid());