-- UNAPPLIED REVIEW PROPOSAL — source-only. Do not apply before isolated DB,
-- storage, rollback, concurrent replay/conflict, and non-admin RLS acceptance.
-- This proposal never trusts browser template content, project fields, template
-- identity, target ancestry, or audit provenance.

CREATE TABLE public.department_process_template_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.department_process_templates(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  content text NOT NULL CHECK (btrim(content) <> ''),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, revision_number),
  UNIQUE (template_id, content_sha256)
);
GRANT SELECT ON public.department_process_template_document_revisions TO authenticated;
GRANT ALL ON public.department_process_template_document_revisions TO service_role;
ALTER TABLE public.department_process_template_document_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Department members view immutable template document revisions"
ON public.department_process_template_document_revisions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.department_process_templates template
  WHERE template.id = template_id
    AND public.can_access_department_drive(auth.uid(), template.department_id, NULL)
));

CREATE TABLE public.project_lifecycle_document_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  template_id uuid NOT NULL REFERENCES public.department_process_templates(id) ON DELETE RESTRICT,
  template_version integer NOT NULL CHECK (template_version > 0),
  template_document_revision_id uuid NOT NULL REFERENCES public.department_process_template_document_revisions(id) ON DELETE RESTRICT,
  target_drive_node_id uuid NOT NULL REFERENCES public.drive_nodes(id) ON DELETE RESTRICT,
  generated_drive_node_id uuid NOT NULL REFERENCES public.drive_nodes(id) ON DELETE RESTRICT,
  generated_revision_id uuid NOT NULL REFERENCES public.drive_node_revisions(id) ON DELETE RESTRICT,
  document_control_register_id uuid NOT NULL REFERENCES public.document_control_registers(id) ON DELETE RESTRICT,
  audit_event_id uuid NOT NULL REFERENCES public.activity_log(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  source_fingerprint text NOT NULL CHECK (btrim(source_fingerprint) <> ''),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, request_key),
  UNIQUE (generated_drive_node_id),
  UNIQUE (generated_revision_id),
  UNIQUE (document_control_register_id)
);
GRANT SELECT ON public.project_lifecycle_document_drafts TO authenticated;
GRANT ALL ON public.project_lifecycle_document_drafts TO service_role;
ALTER TABLE public.project_lifecycle_document_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members view lifecycle document draft receipts"
ON public.project_lifecycle_document_drafts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects project
  WHERE project.id = project_id
    AND public.can_access_department_drive(auth.uid(), project.department_id, project.id)
));

CREATE OR REPLACE FUNCTION public.lifecycle_document_template_revision_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Template revision actor provenance is server-owned'; END IF;
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Template document revisions are immutable';
END;
$$;
CREATE TRIGGER lifecycle_document_template_revision_immutable
BEFORE INSERT OR UPDATE ON public.department_process_template_document_revisions
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_document_template_revision_guard();
CREATE OR REPLACE FUNCTION public.lifecycle_document_template_revision_delete_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'Template document revisions are immutable'; END; $$;
CREATE TRIGGER lifecycle_document_template_revision_no_delete
BEFORE DELETE ON public.department_process_template_document_revisions
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_document_template_revision_delete_guard();

CREATE OR REPLACE FUNCTION public.lifecycle_document_draft_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Document draft actor provenance is server-owned'; END IF;
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Lifecycle document draft receipts are immutable';
END;
$$;
CREATE TRIGGER lifecycle_document_draft_immutable
BEFORE INSERT OR UPDATE ON public.project_lifecycle_document_drafts
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_document_draft_guard();
CREATE OR REPLACE FUNCTION public.lifecycle_document_draft_delete_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'Lifecycle document draft receipts are immutable'; END; $$;
CREATE TRIGGER lifecycle_document_draft_no_delete
BEFORE DELETE ON public.project_lifecycle_document_drafts
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_document_draft_delete_guard();

-- Server-only helper. It rechecks the actor and all authoritative records
-- before receipt disclosure, staging, or final commit.
CREATE OR REPLACE FUNCTION public.authorize_lifecycle_document_draft(
  p_project_id uuid,
  p_template_key text,
  p_template_version integer,
  p_request_key uuid,
  p_source_fingerprint text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_project public.projects%ROWTYPE;
DECLARE v_template public.department_process_templates%ROWTYPE;
BEGIN
  IF p_request_key IS NULL OR btrim(coalesce(p_source_fingerprint, '')) = '' THEN RAISE EXCEPTION 'Request key and source fingerprint are required'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR SHARE;
  IF NOT FOUND OR v_project.department_id IS NULL OR v_project.project_drive_node_id IS NULL OR btrim(coalesce(v_project.revision, '')) = '' THEN RAISE EXCEPTION 'Project provenance is incomplete'; END IF;
  IF NOT public.lifecycle_can_manage_department(v_actor, v_project.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_project.department_id, v_project.id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_template FROM public.department_process_templates
  WHERE department_id = v_project.department_id AND template_key = p_template_key AND version = p_template_version AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matching active immutable template version required'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_lifecycle_document_draft_receipt(p_request_key uuid)
RETURNS TABLE(request_key uuid, node_id uuid, revision_id uuid, register_id uuid, audit_event_id uuid, source_fingerprint text, uses_staged_object boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
BEGIN
  RETURN QUERY
  SELECT receipt.request_key, receipt.generated_drive_node_id, receipt.generated_revision_id, receipt.document_control_register_id, receipt.audit_event_id, receipt.source_fingerprint, true
  FROM public.project_lifecycle_document_drafts receipt
  JOIN public.projects project ON project.id = receipt.project_id
  WHERE receipt.request_key = p_request_key
    AND public.lifecycle_can_manage_department(v_actor, project.department_id)
    AND public.can_access_department_drive(v_actor, project.department_id, project.id);
END;
$$;

-- Called after a storage upload. Locks the project and request key, reloads all
-- provenance, rejects conflicts, creates FILE + initial revision + DRAFT
-- register + explicit audit row + immutable receipt in one transaction.
CREATE OR REPLACE FUNCTION public.commit_lifecycle_document_draft(
  p_request_key uuid, p_source_fingerprint text, p_template_key text, p_template_version integer,
  p_file_name text, p_mime_type text, p_storage_bucket text, p_storage_path text,
  p_sha256_checksum text, p_size_bytes bigint
) RETURNS TABLE(request_key uuid, node_id uuid, revision_id uuid, register_id uuid, audit_event_id uuid, source_fingerprint text, uses_staged_object boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_project public.projects%ROWTYPE;
DECLARE v_template public.department_process_templates%ROWTYPE; v_template_revision public.department_process_template_document_revisions%ROWTYPE;
DECLARE v_target public.drive_nodes%ROWTYPE; v_prior public.project_lifecycle_document_drafts%ROWTYPE;
DECLARE v_node_id uuid; DECLARE v_revision_id uuid; DECLARE v_register_id uuid; DECLARE v_audit_id uuid; DECLARE v_document_number text;
DECLARE v_expected_fingerprint text;
BEGIN
  IF p_request_key IS NULL OR btrim(coalesce(p_source_fingerprint,'')) = '' OR btrim(coalesce(p_storage_path,'')) = '' OR p_size_bytes < 0 OR p_sha256_checksum !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid document draft payload'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  SELECT * INTO v_project FROM public.projects WHERE id = (SELECT project_id FROM public.project_lifecycle_document_drafts WHERE request_key=p_request_key LIMIT 1) FOR UPDATE;
  -- First attempts identify the project through the target Drive folder. The
  -- application bridge must pass the target ID in the accepted final signature.
  RAISE EXCEPTION 'Review required: final RPC signature must include target folder and project ID, bind source snapshot server-side, and be replaced before application';
END;
$$;

-- Fails closed until commit has a definitive receipt/object association.
CREATE OR REPLACE FUNCTION public.can_discard_lifecycle_document_object(p_storage_bucket text, p_storage_path text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.project_lifecycle_document_drafts receipt
    JOIN public.drive_node_revisions revision ON revision.id = receipt.generated_revision_id
    WHERE revision.storage_path = p_storage_path
  );
$$;

REVOKE ALL ON FUNCTION public.lifecycle_document_template_revision_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_document_template_revision_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_document_draft_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_document_draft_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.authorize_lifecycle_document_draft(uuid,text,integer,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_lifecycle_document_draft_receipt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_lifecycle_document_draft(uuid,text,text,integer,text,text,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_discard_lifecycle_document_object(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_lifecycle_document_draft(uuid,text,integer,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_lifecycle_document_draft_receipt(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_lifecycle_document_draft(uuid,text,text,integer,text,text,text,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_discard_lifecycle_document_object(text,text) TO service_role;

-- Required acceptance before applying:
-- 1. Use isolated admin/manager/out-of-scope identities; prove denial before
--    receipt lookup, non-admin direct RPC denial, and RLS read isolation.
-- 2. Force each DB write failure after object staging; prove only the exact
--    unreferenced object is removed and uncertain outcomes are retained.
-- 3. Run concurrent identical and conflicting request-key calls; prove one
--    immutable receipt for identical replay and a conflict for any mismatch.
-- 4. Complete the final commit RPC body only after its project/target/source
--    snapshot parameters and record-level ancestry checks are independently reviewed.