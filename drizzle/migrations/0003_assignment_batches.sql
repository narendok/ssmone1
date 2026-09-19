CREATE TABLE public.assignment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  assignee_id uuid NOT NULL REFERENCES public.rd_members(id) ON DELETE CASCADE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_batches TO authenticated;
GRANT ALL ON public.assignment_batches TO service_role;

ALTER TABLE public.assignment_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignment_batches read auth" ON public.assignment_batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignment_batches insert self or admin" ON public.assignment_batches
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "assignment_batches update self or admin" ON public.assignment_batches
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "assignment_batches delete self or admin" ON public.assignment_batches
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.assignments ADD COLUMN batch_id uuid REFERENCES public.assignment_batches(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX assignments_batch_id_idx ON public.assignments(batch_id);
CREATE INDEX assignments_project_id_idx ON public.assignments(project_id);
