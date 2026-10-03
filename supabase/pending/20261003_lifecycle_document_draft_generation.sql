-- UNAPPLIED REVIEW PROPOSAL. Requires isolated database acceptance before migration.
-- Adds an immutable receipt binding a request to a populated Drive-backed DRAFT.
CREATE TABLE public.project_lifecycle_document_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  template_id uuid NOT NULL REFERENCES public.department_process_templates(id) ON DELETE RESTRICT,
  template_version integer NOT NULL CHECK (template_version > 0),
  target_drive_node_id uuid NOT NULL REFERENCES public.drive_nodes(id) ON DELETE RESTRICT,
  generated_drive_node_id uuid NOT NULL REFERENCES public.drive_nodes(id) ON DELETE RESTRICT,
  generated_revision_id uuid NOT NULL REFERENCES public.drive_node_revisions(id) ON DELETE RESTRICT,
  document_control_register_id uuid NOT NULL REFERENCES public.document_control_registers(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  source_fingerprint text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, request_key),
  UNIQUE (generated_drive_node_id)
);
GRANT SELECT ON public.project_lifecycle_document_drafts TO authenticated;
GRANT ALL ON public.project_lifecycle_document_drafts TO service_role;
ALTER TABLE public.project_lifecycle_document_drafts ENABLE ROW LEVEL SECURITY;
-- Required before application: RLS policy using project/department access; immutable actor/time trigger;
-- SECURITY DEFINER routine that validates scope before replay, locks request/project, creates the Drive file,
-- revision, DRAFT control register and audit event atomically, and compensates storage on DB failure.