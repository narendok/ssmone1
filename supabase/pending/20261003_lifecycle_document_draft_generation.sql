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

-- Extends the existing privileged numbering contract. The advisory lock is
-- global for the number series and the document-control unique constraint is
-- the final protection against accidental reuse.
CREATE OR REPLACE FUNCTION public.next_document_number(_kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yr text := to_char(now(), 'YYYY'); prefix text; n int;
BEGIN
  IF _kind = 'LIFECYCLE_DOC' THEN
    PERFORM pg_advisory_xact_lock(hashtext('lifecycle_document_number'));
    prefix := 'LCD-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(document_number, '^.*-', ''))::int), 0) + 1 INTO n
    FROM public.document_control_registers WHERE document_number LIKE prefix || '%';
  ELSIF _kind = 'PO' THEN
    PERFORM pg_advisory_xact_lock(hashtext('po_number')); prefix := 'PO-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(po_number, '^.*-', ''))::int), 0) + 1 INTO n FROM public.purchase_orders WHERE po_number LIKE prefix || '%';
  ELSIF _kind = 'GRN' THEN
    PERFORM pg_advisory_xact_lock(hashtext('grn_number')); prefix := 'GRN-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(grn_number, '^.*-', ''))::int), 0) + 1 INTO n FROM public.goods_receipt_notes WHERE grn_number LIKE prefix || '%';
  ELSIF _kind = 'BOM' THEN
    PERFORM pg_advisory_xact_lock(hashtext('bom_number')); prefix := 'BOM-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(bom_number, '^.*-', ''))::int), 0) + 1 INTO n FROM public.project_boms WHERE bom_number LIKE prefix || '%';
  ELSIF _kind = 'ADJUSTMENT' THEN
    PERFORM pg_advisory_xact_lock(hashtext('stock_adjustment_number')); prefix := 'ADJ-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(adjustment_number, '^.*-', ''))::int), 0) + 1 INTO n FROM public.stock_adjustments WHERE adjustment_number LIKE prefix || '%';
  ELSIF _kind = 'ISSUE' THEN
    PERFORM pg_advisory_xact_lock(hashtext('material_issue_number')); prefix := 'ISS-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(issue_number, '^.*-', ''))::int), 0) + 1 INTO n FROM public.material_issues WHERE issue_number LIKE prefix || '%';
  ELSIF _kind = 'RETURN' THEN
    PERFORM pg_advisory_xact_lock(hashtext('material_return_number')); prefix := 'RET-' || yr || '-';
    SELECT COALESCE(MAX((regexp_replace(return_number, '^.*-', ''))::int), 0) + 1 INTO n FROM public.material_returns WHERE return_number LIKE prefix || '%';
  ELSE RAISE EXCEPTION 'unknown document kind %', _kind;
  END IF;
  RETURN prefix || lpad(n::text, 4, '0');
END;
$$;

-- Re-authorize before a receipt is disclosed or a staged object is committed.
CREATE OR REPLACE FUNCTION public.authorize_lifecycle_document_draft(
  p_project_id uuid, p_template_key text, p_template_version integer,
  p_request_key uuid, p_source_fingerprint text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := public.lifecycle_actor(); v_project public.projects%ROWTYPE;
BEGIN
  IF p_request_key IS NULL OR btrim(coalesce(p_source_fingerprint, '')) = '' THEN RAISE EXCEPTION 'Request key and source fingerprint are required'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR SHARE;
  IF NOT FOUND OR v_project.department_id IS NULL OR v_project.project_drive_node_id IS NULL OR btrim(coalesce(v_project.revision, '')) = '' THEN RAISE EXCEPTION 'Project provenance is incomplete'; END IF;
  IF NOT public.lifecycle_can_manage_department(v_actor, v_project.department_id)
     OR NOT public.can_access_department_drive(v_actor, v_project.department_id, v_project.id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM 1 FROM public.department_process_templates
  WHERE department_id = v_project.department_id AND template_key = p_template_key AND version = p_template_version AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matching active immutable template version required'; END IF;
END;
$$;

-- Request keys are only unique within a project. Every lookup binds the actor,
-- project, target folder, template version and immutable template revision.
CREATE OR REPLACE FUNCTION public.find_lifecycle_document_draft_receipt(
  p_project_id uuid, p_target_folder_id uuid, p_template_key text,
  p_template_version integer, p_template_document_revision_id uuid,
  p_request_key uuid, p_source_fingerprint text
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
    AND receipt.template_document_revision_id = p_template_document_revision_id
    AND receipt.source_fingerprint = p_source_fingerprint;
END;
$$;

-- Called only after the server-only adapter has staged an immutable object.
-- The caller sends storage metadata, not document content. The database renders
-- the pin from its own immutable template snapshot and project fields, then
-- verifies its SHA-256/size/file name before it makes that object canonical.
CREATE OR REPLACE FUNCTION public.commit_lifecycle_document_draft(
  p_project_id uuid, p_target_folder_id uuid, p_request_key uuid, p_source_fingerprint text,
  p_template_key text, p_template_version integer, p_file_name text, p_mime_type text,
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
  v_rendered_content text; v_rendered_sha256 text; v_expected_name text; v_payload_hash text;
  v_ancestry_ids uuid[]; v_ancestry_count integer; v_root_id uuid; v_token text; v_result jsonb;
BEGIN
  IF p_request_key IS NULL OR btrim(coalesce(p_source_fingerprint,'')) = ''
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
  WHERE template_id = v_template.id ORDER BY revision_number DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Immutable template content revision required'; END IF;
  SELECT * INTO v_target FROM public.drive_nodes WHERE id = p_target_folder_id FOR UPDATE;
  IF NOT FOUND OR v_target.node_type <> 'FOLDER' OR v_target.is_trashed
     OR v_target.project_id IS DISTINCT FROM v_project.id OR v_target.department_id IS DISTINCT FROM v_project.department_id THEN
    RAISE EXCEPTION 'Target folder is outside the authorized project Drive';
  END IF;
  WITH RECURSIVE ancestry(id, parent_id, project_id, department_id, depth, path) AS (
    SELECT id, parent_id, project_id, department_id, 1, ARRAY[id] FROM public.drive_nodes WHERE id = v_target.id
    UNION ALL
    SELECT parent.id, parent.parent_id, parent.project_id, parent.department_id, ancestry.depth + 1, ancestry.path || parent.id
    FROM public.drive_nodes parent JOIN ancestry ON ancestry.parent_id = parent.id
    WHERE ancestry.depth < 64 AND NOT parent.id = ANY(ancestry.path)
  )
  SELECT array_agg(id ORDER BY depth), count(*), max(id) FILTER (WHERE parent_id IS NULL)
  INTO v_ancestry_ids, v_ancestry_count, v_root_id FROM ancestry;
  IF v_ancestry_count IS NULL OR v_ancestry_count >= 64 OR v_root_id IS DISTINCT FROM v_project.project_drive_node_id
     OR EXISTS (SELECT 1 FROM public.drive_nodes WHERE id = ANY(v_ancestry_ids)
                AND (project_id IS DISTINCT FROM v_project.id OR department_id IS DISTINCT FROM v_project.department_id OR is_trashed)) THEN
    RAISE EXCEPTION 'Target ancestry is not the locked project Drive tree';
  END IF;
  PERFORM 1 FROM public.drive_nodes WHERE id = ANY(v_ancestry_ids) ORDER BY id FOR UPDATE;
  SELECT * INTO v_prior FROM public.project_lifecycle_document_drafts
  WHERE project_id = v_project.id AND request_key = p_request_key FOR UPDATE;
  IF FOUND THEN
    IF v_prior.created_by = v_actor AND v_prior.template_id = v_template.id
       AND v_prior.template_version = v_template.version AND v_prior.template_document_revision_id = v_template_revision.id
       AND v_prior.target_drive_node_id = v_target.id AND v_prior.source_fingerprint = p_source_fingerprint
       AND v_prior.storage_bucket = p_storage_bucket AND v_prior.storage_path = p_storage_path
       AND v_prior.sha256_checksum = p_sha256_checksum AND v_prior.size_bytes = p_size_bytes THEN
      RETURN QUERY SELECT v_prior.request_key, v_prior.generated_drive_node_id, v_prior.generated_revision_id,
        v_prior.document_control_register_id, v_prior.audit_event_id, v_prior.source_fingerprint, false;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Request key conflicts with a different document draft payload';
  END IF;
  -- Only these four canonical server-owned values may appear in a template.
  FOR v_token IN SELECT (regexp_matches(v_template_revision.content, '\{\{\s*([A-Z0-9_]+)\s*\}\}', 'g'))[1] LOOP
    IF v_token NOT IN ('PROJECT_CODE','PROJECT_NAME','PROJECT_REVISION','DEPARTMENT') THEN RAISE EXCEPTION 'Unsupported immutable template token %', v_token; END IF;
  END LOOP;
  v_rendered_content := regexp_replace(v_template_revision.content, '\{\{\s*PROJECT_CODE\s*\}\}', v_project.code, 'g');
  v_rendered_content := regexp_replace(v_rendered_content, '\{\{\s*PROJECT_NAME\s*\}\}', v_project.name, 'g');
  v_rendered_content := regexp_replace(v_rendered_content, '\{\{\s*PROJECT_REVISION\s*\}\}', v_project.revision, 'g');
  v_rendered_content := regexp_replace(v_rendered_content, '\{\{\s*DEPARTMENT\s*\}\}', (SELECT name FROM public.departments WHERE id = v_project.department_id), 'g');
  IF v_rendered_content LIKE '%{{%' OR v_rendered_content LIKE '%}}%' THEN RAISE EXCEPTION 'Immutable template has unresolved token syntax'; END IF;
  v_rendered_sha256 := encode(digest(convert_to(v_rendered_content, 'UTF8'), 'sha256'), 'hex');
  v_expected_name := regexp_replace(v_project.code || '-' || v_template.template_key || '-v' || v_template.version::text, '[^A-Za-z0-9._-]+', '_', 'g') || '.txt';
  IF p_file_name <> v_expected_name OR p_sha256_checksum <> v_rendered_sha256 OR p_size_bytes <> octet_length(convert_to(v_rendered_content, 'UTF8')) THEN RAISE EXCEPTION 'Staged object does not match the server-rendered immutable template snapshot'; END IF;
  v_payload_hash := md5(concat_ws('|', v_project.id, v_actor, v_target.id, v_template.id, v_template.version, v_template_revision.id, p_request_key, p_source_fingerprint, p_file_name, p_mime_type, p_storage_bucket, p_storage_path, p_sha256_checksum, p_size_bytes));
  INSERT INTO public.drive_nodes(project_id, department_id, parent_id, name, slug, node_type, file_type, mime_type,
    file_size_bytes, storage_bucket, storage_path, sha256_checksum, current_version, is_locked, created_by, metadata)
  VALUES (v_project.id, v_project.department_id, v_target.id, p_file_name,
    'lifecycle-' || substr(md5(p_request_key::text), 1, 24), 'FILE', 'OTHER', p_mime_type,
    p_size_bytes, p_storage_bucket, p_storage_path, p_sha256_checksum, 1, false, v_actor,
    jsonb_build_object('lifecycle_document_draft', true, 'template_id', v_template.id,
      'template_version', v_template.version, 'template_document_revision_id', v_template_revision.id,
      'source_fingerprint', p_source_fingerprint, 'request_key', p_request_key))
  RETURNING id INTO v_node_id;
  INSERT INTO public.drive_node_revisions(node_id, version, file_size_bytes, storage_path, sha256_checksum, change_summary, uploaded_by)
  VALUES (v_node_id, 1, p_size_bytes, p_storage_path, p_sha256_checksum,
    'Initial lifecycle document DRAFT from immutable template revision ' || v_template_revision.revision_number, v_actor)
  RETURNING id INTO v_revision_id;
  v_document_number := public.next_document_number('LIFECYCLE_DOC');
  INSERT INTO public.document_control_registers(drive_node_id, department_id, document_number, title, document_status,
    controlled_version, created_by, project_id, source_revision_id, approval_note)
  VALUES (v_node_id, v_project.department_id, v_document_number, v_template.title, 'DRAFT', 1, v_actor,
    v_project.id, v_revision_id, 'Generated from immutable lifecycle template revision ' || v_template_revision.revision_number)
  RETURNING id INTO v_register_id;
  v_result := jsonb_build_object('request_key', p_request_key, 'node_id', v_node_id, 'revision_id', v_revision_id,
    'register_id', v_register_id, 'document_number', v_document_number, 'project_id', v_project.id,
    'target_drive_node_id', v_target.id, 'template_id', v_template.id, 'template_version', v_template.version,
    'template_document_revision_id', v_template_revision.id, 'source_fingerprint', p_source_fingerprint, 'status', 'DRAFT');
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
    v_revision_id, v_register_id, v_audit_id, p_request_key, p_source_fingerprint, v_payload_hash,
    p_storage_bucket, p_storage_path, p_sha256_checksum, p_size_bytes, v_result, v_actor);
  RETURN QUERY SELECT p_request_key, v_node_id, v_revision_id, v_register_id, v_audit_id, p_source_fingerprint, true;
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
  IF EXISTS (SELECT 1 FROM public.project_lifecycle_document_drafts WHERE project_id = p_project_id AND request_key = p_request_key) THEN RETURN false; END IF;
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
REVOKE ALL ON FUNCTION public.authorize_lifecycle_document_draft(uuid,text,integer,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_lifecycle_document_draft_receipt(uuid,uuid,text,integer,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_lifecycle_document_draft(uuid,uuid,uuid,text,text,integer,text,text,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_discard_lifecycle_document_object(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_lifecycle_document_draft(uuid,text,integer,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_lifecycle_document_draft_receipt(uuid,uuid,text,integer,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_lifecycle_document_draft(uuid,uuid,uuid,text,text,integer,text,text,text,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_discard_lifecycle_document_object(uuid,uuid,text,text) TO service_role;

-- Required acceptance before applying:
-- 1. Run tests/lifecycle_document_draft_acceptance.sql against an isolated DB
--    and storage bucket only, using manager and out-of-scope non-admin identities.
-- 2. Prove authorization denial before receipt disclosure, rollback after each
--    insert point, exact replay, request-key conflict, and concurrent requests.
-- 3. Confirm server bridge calls the new bound receipt/cleanup signatures and
--    preserves request JWT context when using the privileged transaction route.
-- 4. Confirm storage checksum comparison is sufficient for the storage adapter;
--    DB cannot fetch object bytes and must never delete uncertain attempt paths.