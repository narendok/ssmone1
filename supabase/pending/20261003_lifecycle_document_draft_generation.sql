-- UNAPPLIED REVIEW PROPOSAL — source-only. Do not apply before the isolated
-- acceptance suite in tests/lifecycle_document_draft_acceptance.sql passes.
--
-- This is a single database transaction for Drive metadata, the immutable
-- revision, DRAFT controlled-document registration, activity audit, and its
-- receipt. Object bytes are staged by the server-only storage adapter before
-- this RPC. Postgres cannot read storage bytes; it verifies the claimed SHA-256
-- and size against its canonical render before linking that attempt path.
--
-- Browser-provided template content, field values, actor, project scope,
-- template revision, target ancestry, numbering, and audit provenance are
-- never authoritative.

-- Every staged object gets a server-owned receipt before commit. The database
-- cannot inspect storage bytes; it can require the adapter's exact bucket/path,
-- checksum, size, project, request, and actor receipt before making it canonical.
CREATE TABLE public.lifecycle_document_storage_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  storage_bucket text NOT NULL CHECK (storage_bucket = 'project-drive'),
  storage_path text NOT NULL CHECK (btrim(storage_path) <> ''),
  sha256_checksum text NOT NULL CHECK (sha256_checksum ~ '^[a-f0-9]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  consumed_by_receipt_id uuid,
  UNIQUE (storage_bucket, storage_path)
);
GRANT ALL ON public.lifecycle_document_storage_attempts TO service_role;
ALTER TABLE public.lifecycle_document_storage_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.lifecycle_document_storage_attempt_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.uploaded_by IS DISTINCT FROM auth.uid() OR NEW.consumed_at IS NOT NULL OR NEW.consumed_by_receipt_id IS NOT NULL THEN
      RAISE EXCEPTION 'Storage attempt provenance is server-owned';
    END IF;
    NEW.uploaded_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.uploaded_by = auth.uid() AND OLD.consumed_at IS NULL
     AND NEW.project_id = OLD.project_id AND NEW.request_key = OLD.request_key
     AND NEW.storage_bucket = OLD.storage_bucket AND NEW.storage_path = OLD.storage_path
     AND NEW.sha256_checksum = OLD.sha256_checksum AND NEW.size_bytes = OLD.size_bytes
     AND NEW.uploaded_by = OLD.uploaded_by AND NEW.uploaded_at = OLD.uploaded_at
     AND NEW.consumed_at IS NOT NULL AND NEW.consumed_by_receipt_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Storage attempt is immutable';
END;
$$;
CREATE TRIGGER lifecycle_document_storage_attempt_immutable
BEFORE INSERT OR UPDATE ON public.lifecycle_document_storage_attempts
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_document_storage_attempt_guard();

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
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{32}$'),
  storage_bucket text NOT NULL CHECK (storage_bucket = 'project-drive'),
  storage_path text NOT NULL CHECK (btrim(storage_path) <> ''),
  sha256_checksum text NOT NULL CHECK (sha256_checksum ~ '^[a-f0-9]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, request_key),
  UNIQUE (generated_drive_node_id),
  UNIQUE (generated_revision_id),
  UNIQUE (document_control_register_id),
  UNIQUE (storage_bucket, storage_path)
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
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Template revision actor provenance is server-owned'; END IF;
    IF NEW.content_sha256 <> encode(digest(convert_to(NEW.content, 'UTF8'), 'sha256'), 'hex') THEN RAISE EXCEPTION 'Template revision checksum is invalid'; END IF;
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

-- Browser settings remain read-only. These service-only routines are the
-- proposed governed content-management boundary: they derive actor/time,
-- append immutable content only to DRAFT versions, and require the existing
-- department-lead authorization contract.
CREATE OR REPLACE FUNCTION public.create_lifecycle_document_template_revision(
  p_template_id uuid, p_content text
) RETURNS TABLE(id uuid, template_id uuid, revision_number integer, content_sha256 text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_template public.department_process_templates%ROWTYPE;
  v_revision_number integer; v_checksum text;
BEGIN
  IF btrim(coalesce(p_content, '')) = '' THEN RAISE EXCEPTION 'Immutable template content is required'; END IF;
  SELECT * INTO v_template FROM public.department_process_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND OR v_template.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only a DRAFT template may receive a new immutable content revision'; END IF;
  IF NOT public.lifecycle_can_manage_department(v_actor, v_template.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_template.department_id, NULL) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_checksum := encode(digest(convert_to(p_content, 'UTF8'), 'sha256'), 'hex');
  SELECT coalesce(max(revision.revision_number), 0) + 1 INTO v_revision_number
  FROM public.department_process_template_document_revisions revision WHERE revision.template_id = v_template.id FOR UPDATE;
  INSERT INTO public.department_process_template_document_revisions(template_id, revision_number, content, content_sha256, created_by)
  VALUES (v_template.id, v_revision_number, p_content, v_checksum, v_actor)
  RETURNING department_process_template_document_revisions.id INTO id;
  template_id := v_template.id; revision_number := v_revision_number; content_sha256 := v_checksum;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_lifecycle_document_template(
  p_template_id uuid, p_template_document_revision_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_template public.department_process_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_template FROM public.department_process_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND OR v_template.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only a DRAFT template may be activated'; END IF;
  IF NOT public.lifecycle_can_manage_department(v_actor, v_template.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_template.department_id, NULL) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM 1 FROM public.department_process_template_document_revisions revision
  WHERE revision.id = p_template_document_revision_id AND revision.template_id = v_template.id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activation requires a pinned immutable content revision'; END IF;
  UPDATE public.department_process_templates SET status = 'ACTIVE', activated_at = now() WHERE id = v_template.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_lifecycle_document_template(p_template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_template public.department_process_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_template FROM public.department_process_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND OR v_template.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Only an ACTIVE template may be retired'; END IF;
  IF NOT public.lifecycle_can_manage_department(v_actor, v_template.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_template.department_id, NULL) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.department_process_templates SET status = 'RETIRED', retired_at = now() WHERE id = v_template.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_document_draft_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- The storage receipt's eventual FK is added after its target table exists.
ALTER TABLE public.lifecycle_document_storage_attempts
  ADD CONSTRAINT lifecycle_document_storage_attempts_consumed_receipt_fkey
  FOREIGN KEY (consumed_by_receipt_id) REFERENCES public.project_lifecycle_document_drafts(id) ON DELETE RESTRICT;

-- Uses the independently scoped business-number series. This proposal does not
-- replace next_document_number, preserving every existing and future series.

-- Re-authorize before a receipt is disclosed or a staged object is committed.
CREATE OR REPLACE FUNCTION public.authorize_lifecycle_document_draft(
  p_project_id uuid, p_template_key text, p_template_version integer,
  p_template_document_revision_id uuid, p_request_key uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_project public.projects%ROWTYPE;
BEGIN
  IF p_request_key IS NULL OR p_template_document_revision_id IS NULL THEN RAISE EXCEPTION 'Request key and pinned template revision are required'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR SHARE;
  IF NOT FOUND OR v_project.department_id IS NULL OR v_project.project_drive_node_id IS NULL OR btrim(coalesce(v_project.revision, '')) = '' THEN RAISE EXCEPTION 'Project provenance is incomplete'; END IF;
  IF NOT public.lifecycle_can_manage_department(v_actor, v_project.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_project.department_id, v_project.id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM 1 FROM public.department_process_templates template
  JOIN public.department_process_template_document_revisions revision ON revision.id = p_template_document_revision_id AND revision.template_id = template.id
  WHERE template.department_id = v_project.department_id AND template.template_key = p_template_key AND template.version = p_template_version AND template.status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matching active immutable template version required'; END IF;
END;
$$;

-- The server-only adapter calls this after a successful storage response and
-- before commit. Actor provenance comes only from the request JWT context.
CREATE OR REPLACE FUNCTION public.register_lifecycle_document_storage_attempt(
  p_project_id uuid, p_template_key text, p_template_version integer,
  p_template_document_revision_id uuid, p_request_key uuid,
  p_storage_bucket text, p_storage_path text, p_sha256_checksum text, p_size_bytes bigint
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_attempt public.lifecycle_document_storage_attempts%ROWTYPE;
BEGIN
  PERFORM public.authorize_lifecycle_document_draft(p_project_id, p_template_key,
    p_template_version, p_template_document_revision_id, p_request_key);
  IF p_storage_bucket IS DISTINCT FROM 'project-drive'
    OR p_storage_path IS NULL
    OR p_storage_path !~ ('^' || p_project_id::text || '/[0-9a-f-]{36}-draft\.txt$')
    OR p_sha256_checksum IS NULL OR p_sha256_checksum !~ '^[a-f0-9]{64}$'
    OR p_size_bytes IS NULL OR p_size_bytes < 0 THEN
    RAISE EXCEPTION 'Invalid staged storage attempt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = p_storage_bucket AND name = p_storage_path) THEN
    RAISE EXCEPTION 'Staged storage object does not exist';
  END IF;
  INSERT INTO public.lifecycle_document_storage_attempts
    (project_id, request_key, storage_bucket, storage_path, sha256_checksum, size_bytes, uploaded_by)
  VALUES (p_project_id, p_request_key, p_storage_bucket, p_storage_path, p_sha256_checksum, p_size_bytes, v_actor)
  ON CONFLICT (storage_bucket, storage_path) DO NOTHING;
  SELECT * INTO v_attempt FROM public.lifecycle_document_storage_attempts
    WHERE storage_bucket = p_storage_bucket AND storage_path = p_storage_path FOR UPDATE;
  IF v_attempt.project_id IS DISTINCT FROM p_project_id OR v_attempt.request_key IS DISTINCT FROM p_request_key
    OR v_attempt.uploaded_by IS DISTINCT FROM v_actor OR v_attempt.sha256_checksum IS DISTINCT FROM p_sha256_checksum
    OR v_attempt.size_bytes IS DISTINCT FROM p_size_bytes THEN
    RAISE EXCEPTION 'Storage attempt conflicts with existing provenance';
  END IF;
  RETURN v_attempt.id;
END;
$$;

-- Request keys are only unique within a project. Every lookup binds the actor,
-- project, target folder, template version and immutable template revision.
CREATE OR REPLACE FUNCTION public.find_lifecycle_document_draft_receipt(
  p_project_id uuid, p_target_folder_id uuid, p_template_key text,
  p_template_version integer, p_template_document_revision_id uuid,
  p_request_key uuid
) RETURNS TABLE(request_key uuid, node_id uuid, revision_id uuid, register_id uuid,
  audit_event_id uuid, source_fingerprint text, uses_staged_object boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_project public.projects%ROWTYPE;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR SHARE;
  IF NOT FOUND OR NOT public.lifecycle_can_manage_department(v_actor, v_project.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_project.department_id, v_project.id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT receipt.request_key, receipt.generated_drive_node_id, receipt.generated_revision_id,
    receipt.document_control_register_id, receipt.audit_event_id, receipt.source_fingerprint, false
  FROM public.project_lifecycle_document_drafts receipt
  JOIN public.department_process_templates template ON template.id = receipt.template_id
  WHERE receipt.project_id = p_project_id AND receipt.request_key = p_request_key
    AND receipt.created_by = v_actor AND receipt.target_drive_node_id = p_target_folder_id
    AND template.template_key = p_template_key AND receipt.template_version = p_template_version
    AND receipt.template_document_revision_id = p_template_document_revision_id;
END;
$$;

-- Called only after the server-only adapter has staged an immutable object.
-- The caller sends storage metadata, not document content. The database renders
-- the pin from its own immutable template snapshot and project fields, then
-- verifies its SHA-256/size/file name before it makes that object canonical.
CREATE OR REPLACE FUNCTION public.commit_lifecycle_document_draft(
  p_project_id uuid, p_target_folder_id uuid, p_request_key uuid,
  p_template_key text, p_template_version integer, p_template_document_revision_id uuid,
  p_file_name text, p_mime_type text,
  p_storage_bucket text, p_storage_path text, p_sha256_checksum text, p_size_bytes bigint
) RETURNS TABLE(request_key uuid, node_id uuid, revision_id uuid, register_id uuid,
  audit_event_id uuid, source_fingerprint text, uses_staged_object boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := public.lifecycle_actor(); v_project public.projects%ROWTYPE;
  v_template public.department_process_templates%ROWTYPE;
  v_template_revision public.department_process_template_document_revisions%ROWTYPE;
  v_target public.drive_nodes%ROWTYPE; v_prior public.project_lifecycle_document_drafts%ROWTYPE;
  v_node_id uuid; v_revision_id uuid; v_register_id uuid; v_audit_id uuid; v_document_number text;
  v_rendered_content text; v_rendered_sha256 text; v_expected_name text; v_payload_hash text; v_source_fingerprint text;
  v_ancestry_ids uuid[]; v_ancestry_count integer; v_root_found boolean; v_ancestry_invalid boolean; v_token text; v_result jsonb;
  v_match text[]; v_remaining text; v_replacement text;
  v_attempt public.lifecycle_document_storage_attempts%ROWTYPE; v_receipt_id uuid;
BEGIN
  IF p_request_key IS NULL OR p_template_document_revision_id IS NULL
     OR btrim(coalesce(p_file_name,'')) = '' OR btrim(coalesce(p_mime_type,'')) = ''
     OR p_storage_bucket <> 'project-drive' OR p_storage_path <> p_project_id::text || '/' || regexp_replace(p_storage_path, '^' || p_project_id::text || '/', '')
     OR p_size_bytes < 0 OR p_sha256_checksum !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid document draft payload';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':' || p_request_key::text, 0));
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.department_id IS NULL OR v_project.project_drive_node_id IS NULL OR btrim(coalesce(v_project.revision,'')) = '' THEN RAISE EXCEPTION 'Project provenance is incomplete'; END IF;
  IF NOT public.lifecycle_can_manage_department(v_actor, v_project.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_project.department_id, v_project.id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_template FROM public.department_process_templates
  WHERE department_id = v_project.department_id AND template_key = p_template_key
    AND version = p_template_version AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matching active immutable template version required'; END IF;
  SELECT * INTO v_template_revision FROM public.department_process_template_document_revisions
  WHERE id = p_template_document_revision_id AND template_id = v_template.id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Immutable template content revision required'; END IF;
  SELECT * INTO v_target FROM public.drive_nodes WHERE id = p_target_folder_id FOR UPDATE;
  IF NOT FOUND OR v_target.node_type <> 'FOLDER' OR v_target.is_trashed
     OR v_target.project_id IS DISTINCT FROM v_project.id OR v_target.department_id IS DISTINCT FROM v_project.department_id THEN
    RAISE EXCEPTION 'Target folder is outside the authorized project Drive';
  END IF;
  WITH RECURSIVE ancestry(id, parent_id, project_id, department_id, is_trashed, depth, path) AS (
    SELECT id, parent_id, project_id, department_id, is_trashed, 1, ARRAY[id] FROM public.drive_nodes WHERE id = v_target.id
    UNION ALL
    SELECT parent.id, parent.parent_id, parent.project_id, parent.department_id, parent.is_trashed, ancestry.depth + 1, ancestry.path || parent.id
    FROM public.drive_nodes parent JOIN ancestry ON ancestry.parent_id = parent.id
    WHERE ancestry.depth < 64 AND ancestry.id <> v_project.project_drive_node_id AND NOT parent.id = ANY(ancestry.path)
  )
  SELECT array_agg(id ORDER BY depth), count(*), bool_or(id = v_project.project_drive_node_id),
    bool_or(project_id IS DISTINCT FROM v_project.id OR department_id IS DISTINCT FROM v_project.department_id OR is_trashed)
  INTO v_ancestry_ids, v_ancestry_count, v_root_found, v_ancestry_invalid FROM ancestry;
  IF v_ancestry_count IS NULL OR v_ancestry_count >= 64 OR NOT coalesce(v_root_found, false)
     OR coalesce(v_ancestry_invalid, true) THEN
    RAISE EXCEPTION 'Target ancestry is not the locked project Drive tree';
  END IF;
  PERFORM 1 FROM public.drive_nodes WHERE id = ANY(v_ancestry_ids) ORDER BY id FOR UPDATE;
  -- Recheck the locked chain: the project root can have a department parent.
  WITH RECURSIVE locked_ancestry(id, parent_id, project_id, department_id, is_trashed, depth, path) AS (
    SELECT id, parent_id, project_id, department_id, is_trashed, 1, ARRAY[id] FROM public.drive_nodes WHERE id = v_target.id
    UNION ALL
    SELECT parent.id, parent.parent_id, parent.project_id, parent.department_id, parent.is_trashed, locked_ancestry.depth + 1, locked_ancestry.path || parent.id
    FROM public.drive_nodes parent JOIN locked_ancestry ON locked_ancestry.parent_id = parent.id
    WHERE locked_ancestry.depth < 64 AND locked_ancestry.id <> v_project.project_drive_node_id AND NOT parent.id = ANY(locked_ancestry.path)
  )
  SELECT count(*), bool_or(id = v_project.project_drive_node_id), bool_or(project_id IS DISTINCT FROM v_project.id OR department_id IS DISTINCT FROM v_project.department_id OR is_trashed OR NOT id = ANY(v_ancestry_ids)) INTO v_ancestry_count, v_root_found, v_ancestry_invalid FROM locked_ancestry;
  IF v_ancestry_count >= 64 OR NOT coalesce(v_root_found, false)
     OR coalesce(v_ancestry_invalid, true) THEN
    RAISE EXCEPTION 'Target ancestry changed during locking';
  END IF;
  SELECT * INTO v_prior FROM public.project_lifecycle_document_drafts
  WHERE project_id = v_project.id AND request_key = p_request_key FOR UPDATE;
  IF FOUND THEN
    IF v_prior.created_by = v_actor AND v_prior.template_id = v_template.id
       AND v_prior.template_version = v_template.version AND v_prior.template_document_revision_id = v_template_revision.id
       AND v_prior.target_drive_node_id = v_target.id THEN
      RETURN QUERY SELECT v_prior.request_key, v_prior.generated_drive_node_id, v_prior.generated_revision_id,
        v_prior.document_control_register_id, v_prior.audit_event_id, v_prior.source_fingerprint, false;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Request key conflicts with a different document draft payload';
  END IF;
  -- Only these four canonical server-owned values may appear in a template.
  -- Validate malformed braces before a single substitution pass. Each original
  -- placeholder is expanded directly, so braces in project data stay literal.
  IF regexp_replace(v_template_revision.content, '\{\{\s*[A-Z0-9_]+\s*\}\}', '', 'g') LIKE '%{{%'
     OR regexp_replace(v_template_revision.content, '\{\{\s*[A-Z0-9_]+\s*\}\}', '', 'g') LIKE '%}}%' THEN
    RAISE EXCEPTION 'Invalid immutable template placeholder syntax';
  END IF;
  FOR v_token IN SELECT (regexp_matches(v_template_revision.content, '\{\{\s*([A-Z0-9_]+)\s*\}\}', 'g'))[1] LOOP
    IF v_token NOT IN ('PROJECT_CODE','PROJECT_NAME','PROJECT_REVISION','DEPARTMENT') THEN RAISE EXCEPTION 'Unsupported immutable template token %', v_token; END IF;
  END LOOP;
  v_rendered_content := '';
  v_remaining := v_template_revision.content;
  LOOP
    v_match := regexp_match(v_remaining, '^(.*?)\{\{\s*([A-Z0-9_]+)\s*\}\}(.*)$', 's');
    EXIT WHEN v_match IS NULL;
    v_token := v_match[2];
    v_replacement := CASE v_token
      WHEN 'PROJECT_CODE' THEN v_project.code
      WHEN 'PROJECT_NAME' THEN v_project.name
      WHEN 'PROJECT_REVISION' THEN v_project.revision
      WHEN 'DEPARTMENT' THEN (SELECT name FROM public.departments WHERE id = v_project.department_id)
    END;
    v_rendered_content := v_rendered_content || v_match[1] || v_replacement;
    v_remaining := v_match[3];
  END LOOP;
  v_rendered_content := v_rendered_content || v_remaining;
  v_rendered_sha256 := encode(digest(convert_to(v_rendered_content, 'UTF8'), 'sha256'), 'hex');
  v_source_fingerprint := encode(digest(convert_to(concat_ws('|', v_project.id, v_target.id, v_template.id, v_template.version, v_template_revision.id, v_rendered_sha256), 'UTF8'), 'sha256'), 'hex');
  v_expected_name := regexp_replace(v_project.code || '-' || v_template.template_key || '-v' || v_template.version::text, '[^A-Za-z0-9._-]+', '_', 'g') || '.txt';
  IF p_file_name <> v_expected_name OR p_sha256_checksum <> v_rendered_sha256 OR p_size_bytes <> octet_length(convert_to(v_rendered_content, 'UTF8')) THEN RAISE EXCEPTION 'Staged object does not match the server-rendered immutable template snapshot'; END IF;
  SELECT * INTO v_attempt FROM public.lifecycle_document_storage_attempts
  WHERE project_id = v_project.id AND request_key = p_request_key AND storage_bucket = p_storage_bucket
    AND storage_path = p_storage_path AND sha256_checksum = p_sha256_checksum AND size_bytes = p_size_bytes
    AND uploaded_by = v_actor AND consumed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staged storage object lacks a verified owned attempt receipt'; END IF;
  v_payload_hash := md5(concat_ws('|', v_project.id, v_actor, v_target.id, v_template.id, v_template.version, v_template_revision.id, p_request_key, v_source_fingerprint, p_file_name, p_mime_type, p_sha256_checksum, p_size_bytes));
  INSERT INTO public.drive_nodes(project_id, department_id, parent_id, name, slug, node_type, file_type, mime_type,
    file_size_bytes, storage_bucket, storage_path, sha256_checksum, current_version, is_locked, created_by, metadata)
  VALUES (v_project.id, v_project.department_id, v_target.id, p_file_name,
    'lifecycle-' || substr(md5(p_request_key::text), 1, 24), 'FILE', 'OTHER', p_mime_type,
    p_size_bytes, p_storage_bucket, p_storage_path, p_sha256_checksum, 1, false, v_actor,
    jsonb_build_object('lifecycle_document_draft', true, 'template_id', v_template.id,
      'template_version', v_template.version, 'template_document_revision_id', v_template_revision.id,
      'source_fingerprint', v_source_fingerprint, 'request_key', p_request_key))
  RETURNING id INTO v_node_id;
  INSERT INTO public.drive_node_revisions(node_id, version, file_size_bytes, storage_path, sha256_checksum, change_summary, uploaded_by)
  VALUES (v_node_id, 1, p_size_bytes, p_storage_path, p_sha256_checksum,
    'Initial lifecycle document DRAFT from immutable template revision ' || v_template_revision.revision_number, v_actor)
  RETURNING id INTO v_revision_id;
  v_document_number := public.next_business_number('lifecycle_document', (SELECT code FROM public.departments WHERE id = v_project.department_id), v_project.code);
  INSERT INTO public.document_control_registers(drive_node_id, department_id, document_number, title, document_status,
    controlled_version, created_by, project_id, source_revision_id, approval_note)
  VALUES (v_node_id, v_project.department_id, v_document_number, v_template.title, 'DRAFT', 1, v_actor,
    v_project.id, v_revision_id, 'Generated from immutable lifecycle template revision ' || v_template_revision.revision_number)
  RETURNING id INTO v_register_id;
  v_result := jsonb_build_object('request_key', p_request_key, 'node_id', v_node_id, 'revision_id', v_revision_id,
    'register_id', v_register_id, 'document_number', v_document_number, 'project_id', v_project.id,
    'target_drive_node_id', v_target.id, 'template_id', v_template.id, 'template_version', v_template.version,
    'template_document_revision_id', v_template_revision.id, 'source_fingerprint', v_source_fingerprint, 'status', 'DRAFT');
  INSERT INTO public.activity_log(actor_user_id, module_key, entity_type, entity_id, action, summary, after_data, reason)
  VALUES (v_actor, 'lifecycle_document', 'project_lifecycle_document_draft', v_register_id, 'created',
    'Created lifecycle document DRAFT ' || v_document_number, v_result, 'Immutable template-based generated draft')
  RETURNING id INTO v_audit_id;
  v_result := v_result || jsonb_build_object('audit_event_id', v_audit_id);
  INSERT INTO public.project_lifecycle_document_drafts(project_id, template_id, template_version,
    template_document_revision_id, target_drive_node_id, generated_drive_node_id, generated_revision_id,
    document_control_register_id, audit_event_id, request_key, source_fingerprint, payload_hash,
    storage_bucket, storage_path, sha256_checksum, size_bytes, result, created_by)
  VALUES (v_project.id, v_template.id, v_template.version, v_template_revision.id, v_target.id, v_node_id,
    v_revision_id, v_register_id, v_audit_id, p_request_key, v_source_fingerprint, v_payload_hash,
    p_storage_bucket, p_storage_path, p_sha256_checksum, p_size_bytes, v_result, v_actor)
  RETURNING id INTO v_receipt_id;
  UPDATE public.lifecycle_document_storage_attempts
  SET consumed_at = now(), consumed_by_receipt_id = v_receipt_id
  WHERE id = v_attempt.id;
  RETURN QUERY SELECT p_request_key, v_node_id, v_revision_id, v_register_id, v_audit_id, v_source_fingerprint, true;
END;
$$;

-- Cleanup is permitted only for the same authorized actor/project/request
-- attempt, the fixed project-drive bucket, and a path with no metadata or
-- revision reference anywhere in Drive. It fails closed for any uncertainty.
CREATE OR REPLACE FUNCTION public.can_discard_lifecycle_document_object(
  p_project_id uuid, p_request_key uuid, p_storage_bucket text, p_storage_path text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_project public.projects%ROWTYPE;
BEGIN
  IF p_storage_bucket <> 'project-drive' OR p_storage_path <> p_project_id::text || '/' || regexp_replace(p_storage_path, '^' || p_project_id::text || '/', '') THEN RETURN false; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR SHARE;
  IF NOT FOUND OR NOT public.lifecycle_can_manage_department(v_actor, v_project.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_project.department_id, v_project.id) THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lifecycle_document_storage_attempts attempt
    WHERE attempt.project_id = p_project_id AND attempt.request_key = p_request_key
      AND attempt.storage_bucket = p_storage_bucket AND attempt.storage_path = p_storage_path
      AND attempt.uploaded_by = v_actor AND attempt.consumed_at IS NULL
  ) THEN RETURN false; END IF;
  RETURN NOT EXISTS (SELECT 1 FROM public.drive_nodes WHERE storage_bucket = p_storage_bucket AND storage_path = p_storage_path)
     AND NOT EXISTS (
       SELECT 1 FROM public.drive_node_revisions revision
       JOIN public.drive_nodes node ON node.id = revision.node_id
       WHERE node.storage_bucket = p_storage_bucket AND revision.storage_path = p_storage_path
     );
END;
$$;

REVOKE ALL ON FUNCTION public.lifecycle_document_template_revision_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_document_template_revision_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_document_draft_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_document_draft_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_document_storage_attempt_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_lifecycle_document_template_revision(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_lifecycle_document_template(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retire_lifecycle_document_template(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.authorize_lifecycle_document_draft(uuid,text,integer,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_lifecycle_document_storage_attempt(uuid,text,integer,uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_lifecycle_document_draft_receipt(uuid,uuid,text,integer,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_lifecycle_document_draft(uuid,uuid,uuid,text,integer,uuid,text,text,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_discard_lifecycle_document_object(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_lifecycle_document_draft(uuid,text,integer,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_lifecycle_document_storage_attempt(uuid,text,integer,uuid,uuid,text,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_lifecycle_document_draft_receipt(uuid,uuid,text,integer,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_lifecycle_document_draft(uuid,uuid,uuid,text,integer,uuid,text,text,text,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_discard_lifecycle_document_object(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_lifecycle_document_template_revision(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_lifecycle_document_template(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.retire_lifecycle_document_template(uuid) TO service_role;

-- Required acceptance before applying:
-- 1. Run tests/lifecycle_document_draft_acceptance.sql against an isolated DB
--    and storage bucket only, using manager and out-of-scope non-admin identities.
-- 2. Prove authorization denial before receipt disclosure, rollback after each
--    insert point, exact replay, request-key conflict, and concurrent requests.
-- 3. Confirm server bridge calls the new bound receipt/cleanup signatures and
--    preserves request JWT context when using the privileged transaction route.
-- 4. Confirm storage checksum comparison is sufficient for the storage adapter;
--    DB cannot fetch object bytes and must never delete uncertain attempt paths.
