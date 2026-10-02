CREATE TABLE public.department_process_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  template_key text NOT NULL CHECK (btrim(template_key) <> ''),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  retired_at timestamptz,
  UNIQUE (department_id, template_key, version)
);
GRANT SELECT ON public.department_process_templates TO authenticated;
GRANT ALL ON public.department_process_templates TO service_role;
ALTER TABLE public.department_process_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.department_process_template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.department_process_templates(id) ON DELETE RESTRICT,
  stage_key text NOT NULL CHECK (btrim(stage_key) <> ''),
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text,
  sort_order integer NOT NULL CHECK (sort_order > 0),
  source_company_process_stage_id uuid NOT NULL REFERENCES public.company_process_stages(id) ON DELETE RESTRICT,
  task_department public.department_type NOT NULL,
  required boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, stage_key),
  UNIQUE (template_id, sort_order),
  UNIQUE (template_id, source_company_process_stage_id)
);
GRANT SELECT ON public.department_process_template_stages TO authenticated;
GRANT ALL ON public.department_process_template_stages TO service_role;
ALTER TABLE public.department_process_template_stages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_stage_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_stage_record_id uuid NOT NULL REFERENCES public.project_process_stage_records(id) ON DELETE CASCADE,
  predecessor_stage_record_id uuid NOT NULL REFERENCES public.project_process_stage_records(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (project_stage_record_id <> predecessor_stage_record_id),
  UNIQUE (project_stage_record_id, predecessor_stage_record_id)
);
GRANT SELECT ON public.project_stage_dependencies TO authenticated;
GRANT ALL ON public.project_stage_dependencies TO service_role;
ALTER TABLE public.project_stage_dependencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_feedback_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requirement_baseline_id uuid NOT NULL REFERENCES public.requirement_baselines(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'SUPERSEDED')),
  feedback_text text NOT NULL CHECK (btrim(feedback_text) <> ''),
  source_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  accepted_at timestamptz,
  superseded_at timestamptz,
  UNIQUE (project_id, revision_number)
);
GRANT SELECT ON public.project_feedback_revisions TO authenticated;
GRANT ALL ON public.project_feedback_revisions TO service_role;
ALTER TABLE public.project_feedback_revisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_lifecycle_generation_requests (
  request_key uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  template_id uuid NOT NULL REFERENCES public.department_process_templates(id) ON DELETE RESTRICT,
  template_version integer NOT NULL CHECK (template_version > 0),
  requested_by uuid NOT NULL,
  payload_hash text NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_lifecycle_generation_requests TO authenticated;
GRANT ALL ON public.project_lifecycle_generation_requests TO service_role;
ALTER TABLE public.project_lifecycle_generation_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.project_process_stage_records
  ADD COLUMN lifecycle_template_id uuid REFERENCES public.department_process_templates(id) ON DELETE RESTRICT,
  ADD COLUMN lifecycle_template_version integer,
  ADD COLUMN lifecycle_template_stage_id uuid REFERENCES public.department_process_template_stages(id) ON DELETE RESTRICT;
ALTER TABLE public.project_tasks ADD COLUMN lifecycle_source_key text;

CREATE UNIQUE INDEX department_process_templates_one_active_version
  ON public.department_process_templates(department_id, template_key)
  WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX project_tasks_lifecycle_source_key_unique
  ON public.project_tasks(project_id, lifecycle_source_key)
  WHERE lifecycle_source_key IS NOT NULL;
CREATE INDEX project_stage_dependencies_project_stage_record_id_idx
  ON public.project_stage_dependencies(project_stage_record_id);

CREATE OR REPLACE FUNCTION public.lifecycle_actor()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN v_actor;
END;
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_can_manage_department(p_actor uuid, p_department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_department_drive(p_actor, p_department_id, NULL)
    AND public.has_any_permission(p_actor, ARRAY['projects.manage','engineering.manage','documents.edit']);
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_assert_template_draft(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.department_process_templates WHERE id = p_template_id FOR SHARE;
  IF NOT FOUND OR v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only DRAFT template versions may be changed; create a new version';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_template_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Template actor provenance is server-owned'; END IF;
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Template provenance is immutable';
  END IF;
  IF OLD.status IN ('ACTIVE','RETIRED') AND current_setting('lifecycle.template_transition', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Active and retired template versions are immutable';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only DRAFT template versions may be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status AND current_setting('lifecycle.template_transition', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Template status changes require a protected lifecycle contract';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_template_stage_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.lifecycle_assert_template_draft(NEW.template_id);
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Stage actor provenance is server-owned'; END IF;
    NEW.created_at := now();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.lifecycle_assert_template_draft(OLD.template_id);
    PERFORM public.lifecycle_assert_template_draft(NEW.template_id);
    IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Stage provenance is immutable';
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.lifecycle_assert_template_draft(OLD.template_id);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER lifecycle_template_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.department_process_templates
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_template_guard();
CREATE TRIGGER lifecycle_template_stage_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.department_process_template_stages
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_template_stage_guard();

CREATE OR REPLACE FUNCTION public.lifecycle_assert_stage_graph(
  p_target_record_id uuid,
  p_predecessor_record_id uuid,
  p_exclude_dependency_id uuid DEFAULT NULL,
  p_exclude_legacy_record_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_project_id uuid;
DECLARE v_predecessor_project_id uuid;
BEGIN
  IF p_predecessor_record_id IS NULL THEN RETURN; END IF;
  SELECT project_id INTO v_project_id FROM public.project_process_stage_records WHERE id = p_target_record_id FOR SHARE;
  SELECT project_id INTO v_predecessor_project_id FROM public.project_process_stage_records WHERE id = p_predecessor_record_id FOR SHARE;
  IF v_project_id IS NULL OR v_project_id <> v_predecessor_project_id THEN
    RAISE EXCEPTION 'Dependency records must belong to the same project';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_project_id::text, 0));
  IF EXISTS (
    WITH RECURSIVE edges(from_id, to_id) AS (
      SELECT r.id, r.predecessor_record_id
      FROM public.project_process_stage_records AS r
      WHERE r.project_id = v_project_id
        AND r.predecessor_record_id IS NOT NULL
        AND (p_exclude_legacy_record_id IS NULL OR r.id <> p_exclude_legacy_record_id)
      UNION ALL
      SELECT d.project_stage_record_id, d.predecessor_stage_record_id
      FROM public.project_stage_dependencies AS d
      JOIN public.project_process_stage_records AS r ON r.id = d.project_stage_record_id
      WHERE r.project_id = v_project_id
        AND (p_exclude_dependency_id IS NULL OR d.id <> p_exclude_dependency_id)
    ), reach(node_id) AS (
      SELECT to_id FROM edges WHERE from_id = p_predecessor_record_id
      UNION
      SELECT e.to_id FROM edges e JOIN reach x ON e.from_id = x.node_id
    )
    SELECT 1 FROM reach WHERE node_id = p_target_record_id
  ) THEN
    RAISE EXCEPTION 'Dependency would create a cycle';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_dependency_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.lifecycle_assert_stage_graph(
    NEW.project_stage_record_id,
    NEW.predecessor_stage_record_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END,
    NULL
  );
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Dependency actor provenance is server-owned'; END IF;
    NEW.created_at := now();
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Dependency provenance is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_legacy_predecessor_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.predecessor_record_id IS NOT NULL THEN
    PERFORM public.lifecycle_assert_stage_graph(
      NEW.id,
      NEW.predecessor_record_id,
      NULL,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lifecycle_dependency_guard_trigger
BEFORE INSERT OR UPDATE OF project_stage_record_id, predecessor_stage_record_id ON public.project_stage_dependencies
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_dependency_guard();
CREATE TRIGGER lifecycle_legacy_predecessor_guard_trigger
BEFORE INSERT OR UPDATE OF predecessor_record_id ON public.project_process_stage_records
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_legacy_predecessor_guard();

CREATE POLICY "Scoped users view lifecycle templates" ON public.department_process_templates
FOR SELECT TO authenticated USING (public.can_access_department_drive(auth.uid(), department_id, NULL));
CREATE POLICY "Scoped users view lifecycle template stages" ON public.department_process_template_stages
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.department_process_templates t
  WHERE t.id = department_process_template_stages.template_id
    AND public.can_access_department_drive(auth.uid(), t.department_id, NULL)
));
CREATE POLICY "Scoped users view lifecycle dependencies" ON public.project_stage_dependencies
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.project_process_stage_records r
  JOIN public.projects p ON p.id = r.project_id
  WHERE r.id = project_stage_dependencies.project_stage_record_id
    AND public.can_access_department_drive(auth.uid(), p.department_id, p.id)
));
CREATE POLICY "Scoped users view feedback revisions" ON public.project_feedback_revisions
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.projects p
  JOIN public.requirement_baselines b ON b.id = project_feedback_revisions.requirement_baseline_id
  LEFT JOIN public.drive_nodes n ON n.id = project_feedback_revisions.source_drive_node_id
  WHERE p.id = project_feedback_revisions.project_id
    AND b.id = project_feedback_revisions.requirement_baseline_id
    AND b.id = p.requirement_baseline_id
    AND b.status = 'active'
    AND (n.id IS NULL OR (n.project_id = p.id AND n.department_id = p.department_id))
    AND public.can_access_department_drive(auth.uid(), p.department_id, p.id)
));
CREATE POLICY "Actors view own lifecycle generation receipts" ON public.project_lifecycle_generation_requests
FOR SELECT TO authenticated USING (requested_by = auth.uid());

CREATE OR REPLACE FUNCTION public.create_department_process_template(
  p_department_id uuid,
  p_template_key text,
  p_title text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
DECLARE v_version integer;
DECLARE v_id uuid;
BEGIN
  IF NOT public.lifecycle_can_manage_department(v_actor, p_department_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_department_id::text || '|' || p_template_key, 0));
  SELECT coalesce(max(version), 0) + 1 INTO v_version FROM public.department_process_templates
  WHERE department_id = p_department_id AND template_key = p_template_key;
  INSERT INTO public.department_process_templates(department_id, template_key, version, title, description, created_by)
  VALUES (p_department_id, p_template_key, v_version, p_title, p_description, v_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_department_process_template_stage(
  p_template_id uuid,
  p_stage_id uuid,
  p_stage_key text,
  p_title text,
  p_description text,
  p_sort_order integer,
  p_source_company_process_stage_id uuid,
  p_task_department public.department_type,
  p_required boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
DECLARE v_department_id uuid;
DECLARE v_stage_active boolean;
DECLARE v_result uuid;
BEGIN
  SELECT t.department_id INTO v_department_id FROM public.department_process_templates t WHERE t.id = p_template_id FOR UPDATE;
  IF NOT FOUND OR NOT public.lifecycle_can_manage_department(v_actor, v_department_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM public.lifecycle_assert_template_draft(p_template_id);
  SELECT is_active INTO v_stage_active FROM public.company_process_stages WHERE id = p_source_company_process_stage_id;
  IF v_stage_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'Active company process stage required'; END IF;
  IF p_stage_id IS NULL THEN
    INSERT INTO public.department_process_template_stages(template_id, stage_key, title, description, sort_order, source_company_process_stage_id, task_department, required, created_by)
    VALUES (p_template_id, p_stage_key, p_title, p_description, p_sort_order, p_source_company_process_stage_id, p_task_department, coalesce(p_required, true), v_actor)
    RETURNING id INTO v_result;
  ELSE
    UPDATE public.department_process_template_stages
    SET stage_key = p_stage_key, title = p_title, description = p_description, sort_order = p_sort_order,
        source_company_process_stage_id = p_source_company_process_stage_id, task_department = p_task_department,
        required = coalesce(p_required, true)
    WHERE id = p_stage_id AND template_id = p_template_id
    RETURNING id INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Template stage not found'; END IF;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_department_process_template(p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
DECLARE v_source public.department_process_templates%ROWTYPE;
DECLARE v_clone_id uuid;
DECLARE v_next_version integer;
BEGIN
  SELECT * INTO v_source FROM public.department_process_templates WHERE id = p_template_id FOR SHARE;
  IF NOT FOUND OR NOT public.lifecycle_can_manage_department(v_actor, v_source.department_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_source.department_id::text || '|' || v_source.template_key, 0));
  SELECT coalesce(max(version), 0) + 1 INTO v_next_version FROM public.department_process_templates
    WHERE department_id = v_source.department_id AND template_key = v_source.template_key;
  INSERT INTO public.department_process_templates(department_id, template_key, version, title, description, created_by)
  VALUES (v_source.department_id, v_source.template_key, v_next_version, v_source.title, v_source.description, v_actor)
  RETURNING id INTO v_clone_id;
  INSERT INTO public.department_process_template_stages(template_id, stage_key, title, description, sort_order, source_company_process_stage_id, task_department, required, created_by)
  SELECT v_clone_id, stage_key, title, description, sort_order, source_company_process_stage_id, task_department, required, v_actor
  FROM public.department_process_template_stages WHERE template_id = v_source.id ORDER BY sort_order, id;
  RETURN v_clone_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_department_process_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
DECLARE v_template public.department_process_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_template FROM public.department_process_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND OR NOT public.lifecycle_can_manage_department(v_actor, v_template.department_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_template.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only DRAFT templates can be activated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.department_process_template_stages s JOIN public.company_process_stages c ON c.id=s.source_company_process_stage_id WHERE s.template_id=v_template.id AND c.is_active) THEN
    RAISE EXCEPTION 'At least one active company process stage is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.department_process_template_stages s JOIN public.company_process_stages c ON c.id=s.source_company_process_stage_id WHERE s.template_id=v_template.id AND c.is_active IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Inactive company process stages cannot be activated';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_template.department_id::text || '|' || v_template.template_key, 0));
  IF EXISTS (SELECT 1 FROM public.department_process_templates WHERE department_id=v_template.department_id AND template_key=v_template.template_key AND status='ACTIVE') THEN
    RAISE EXCEPTION 'Retire the active template version before activating a successor';
  END IF;
  PERFORM set_config('lifecycle.template_transition','on',true);
  UPDATE public.department_process_templates SET status='ACTIVE', activated_at=now() WHERE id=v_template.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_department_process_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
DECLARE v_template public.department_process_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_template FROM public.department_process_templates WHERE id=p_template_id FOR UPDATE;
  IF NOT FOUND OR NOT public.lifecycle_can_manage_department(v_actor, v_template.department_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_template.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Only ACTIVE templates can be retired'; END IF;
  PERFORM set_config('lifecycle.template_transition','on',true);
  UPDATE public.department_process_templates SET status='RETIRED', retired_at=now() WHERE id=v_template.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_project_lifecycle_draft(p_project_id uuid, p_template_id uuid, p_request_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := public.lifecycle_actor();
DECLARE v_project public.projects%ROWTYPE;
DECLARE v_template public.department_process_templates%ROWTYPE;
DECLARE v_prior public.project_lifecycle_generation_requests%ROWTYPE;
DECLARE v_expected_hash text;
DECLARE v_stage public.department_process_template_stages%ROWTYPE;
DECLARE v_record_id uuid;
DECLARE v_task_id uuid;
DECLARE v_record_ids jsonb := '[]'::jsonb;
DECLARE v_task_ids jsonb := '[]'::jsonb;
DECLARE v_result jsonb;
BEGIN
  IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.department_id IS NULL THEN RAISE EXCEPTION 'Project requires an owning department'; END IF;
  IF NOT public.lifecycle_can_manage_department(v_actor, v_project.department_id) OR NOT public.can_access_department_drive(v_actor, v_project.department_id, v_project.id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_template FROM public.department_process_templates WHERE id=p_template_id FOR SHARE;
  IF NOT FOUND OR v_template.status <> 'ACTIVE' OR v_template.department_id <> v_project.department_id THEN
    RAISE EXCEPTION 'Matching active department template required';
  END IF;
  v_expected_hash := encode(digest(concat_ws('|', p_project_id::text, v_template.id::text, v_template.version::text), 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  SELECT * INTO v_prior FROM public.project_lifecycle_generation_requests WHERE request_key=p_request_key FOR UPDATE;
  IF FOUND THEN
    IF v_prior.requested_by=v_actor AND v_prior.project_id=p_project_id AND v_prior.template_id=p_template_id AND v_prior.template_version=v_template.version AND v_prior.payload_hash=v_expected_hash THEN
      RETURN v_prior.result;
    END IF;
    RAISE EXCEPTION 'Request key conflicts with a different actor or payload';
  END IF;
  FOR v_stage IN SELECT * FROM public.department_process_template_stages WHERE template_id=v_template.id ORDER BY sort_order, id LOOP
    INSERT INTO public.project_process_stage_records(project_id, company_process_stage_id, status, created_by, lifecycle_template_id, lifecycle_template_version, lifecycle_template_stage_id)
    VALUES (v_project.id, v_stage.source_company_process_stage_id, 'NOT_STARTED', v_actor, v_template.id, v_template.version, v_stage.id)
    ON CONFLICT (project_id, company_process_stage_id) DO NOTHING
    RETURNING id INTO v_record_id;
    IF v_record_id IS NULL THEN RAISE EXCEPTION 'Lifecycle source stage already exists for this project; use an explicit lineage contract'; END IF;
    INSERT INTO public.project_tasks(project_id, department, department_id, title, status, priority, created_by, lifecycle_source_key)
    VALUES (v_project.id, v_stage.task_department, v_project.department_id, v_stage.title, 'todo', 'medium', v_actor, concat('lifecycle:', v_template.id, ':', v_template.version, ':', v_stage.id))
    ON CONFLICT (project_id, lifecycle_source_key) WHERE lifecycle_source_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_task_id;
    IF v_task_id IS NULL THEN RAISE EXCEPTION 'Lifecycle task key already exists; retry with the original request key'; END IF;
    UPDATE public.project_process_stage_records SET linked_task_id=v_task_id WHERE id=v_record_id;
    v_record_ids := v_record_ids || jsonb_build_array(v_record_id);
    v_task_ids := v_task_ids || jsonb_build_array(v_task_id);
  END LOOP;
  v_result := jsonb_build_object('project_id',v_project.id,'template_id',v_template.id,'template_version',v_template.version,'state','DRAFT','stage_record_ids',v_record_ids,'task_ids',v_task_ids,'processed_at',now());
  INSERT INTO public.project_lifecycle_generation_requests(request_key,project_id,template_id,template_version,requested_by,payload_hash,result)
  VALUES (p_request_key,v_project.id,v_template.id,v_template.version,v_actor,v_expected_hash,v_result);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.lifecycle_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_can_manage_department(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_assert_template_draft(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_assert_stage_graph(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_template_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_template_stage_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_dependency_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_legacy_predecessor_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_department_process_template(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_department_process_template_stage(uuid,uuid,text,text,text,integer,uuid,public.department_type,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clone_department_process_template(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.activate_department_process_template(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.retire_department_process_template(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_project_lifecycle_draft(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_department_process_template(uuid,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_department_process_template_stage(uuid,uuid,text,text,text,integer,uuid,public.department_type,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clone_department_process_template(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_department_process_template(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.retire_department_process_template(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_project_lifecycle_draft(uuid,uuid,uuid) TO authenticated, service_role;