# Pending lifecycle schema patch

**Prepared:** 2026-10-01 UTC  
**Security revision:** 2026-10-01 UTC  
**Status:** deliberately **UNAPPLIED**. This is review material only. No migration, live data, roles, access, ownership, notifications, publishing, approval, stock, or finance change has been made.

## Final pending scope

This proposal is strictly additive: immutable, versioned department templates; project-stage dependency edges; provenance-bound draft generation; and revisioned client feedback. Direct authenticated mutation is intentionally not granted. Every write must use a separately reviewed `SECURITY DEFINER` server contract. Notifications and client feedback creation remain absent from the current web draft view.

## Blocking failures in the prior proposal

1. Replay was not proven identical and authorized before returning a receipt.
2. Template/stage rows allowed direct mutation, deletion, and caller-supplied provenance.
3. Stage source mappings could duplicate a company stage while task keys used a different identity, producing orphan tasks.
4. Dependency traversal omitted `project_process_stage_records.predecessor_record_id`, did not safely exclude an old edge on update, and did not serialize competing reverse-edge inserts.
5. Feedback baseline and source-Drive validation were incomplete; an unqualified identifier could bind the wrong column.
6. Defaults were not sufficient to establish server-owned actor/time provenance.

## Exact proposed SQL — still unapplied

```sql
CREATE TABLE public.department_process_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  template_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
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
  stage_key text NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL CHECK (sort_order > 0),
  source_company_process_stage_id uuid NOT NULL REFERENCES public.company_process_stages(id) ON DELETE RESTRICT,
  required boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (template_id, stage_key),
  UNIQUE (template_id, sort_order),
  UNIQUE (template_id, source_company_process_stage_id)
);
GRANT SELECT ON public.department_process_template_stages TO authenticated;
GRANT ALL ON public.department_process_template_stages TO service_role;
ALTER TABLE public.department_process_template_stages ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX department_process_templates_one_active_version
  ON public.department_process_templates(department_id, template_key)
  WHERE status = 'ACTIVE';

CREATE TABLE public.project_stage_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_stage_record_id uuid NOT NULL REFERENCES public.project_process_stage_records(id) ON DELETE CASCADE,
  predecessor_stage_record_id uuid NOT NULL REFERENCES public.project_process_stage_records(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
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
  feedback_text text NOT NULL,
  source_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
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
  created_at timestamptz NOT NULL
);
GRANT SELECT ON public.project_lifecycle_generation_requests TO authenticated;
GRANT ALL ON public.project_lifecycle_generation_requests TO service_role;
ALTER TABLE public.project_lifecycle_generation_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.project_process_stage_records
  ADD COLUMN lifecycle_template_id uuid REFERENCES public.department_process_templates(id) ON DELETE RESTRICT,
  ADD COLUMN lifecycle_template_version integer,
  ADD COLUMN lifecycle_template_stage_id uuid REFERENCES public.department_process_template_stages(id) ON DELETE RESTRICT;
ALTER TABLE public.project_tasks ADD COLUMN lifecycle_source_key text;
CREATE UNIQUE INDEX project_tasks_lifecycle_source_key_unique
  ON public.project_tasks(project_id, lifecycle_source_key)
  WHERE lifecycle_source_key IS NOT NULL;

CREATE POLICY "Scoped users view lifecycle templates"
ON public.department_process_templates FOR SELECT TO authenticated
USING (public.can_access_department_drive(auth.uid(), department_id, NULL));
CREATE POLICY "Scoped users view lifecycle template stages"
ON public.department_process_template_stages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.department_process_templates AS t
  WHERE t.id = department_process_template_stages.template_id
    AND public.can_access_department_drive(auth.uid(), t.department_id, NULL)
));
CREATE POLICY "Scoped users view lifecycle dependencies"
ON public.project_stage_dependencies FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.project_process_stage_records AS r
  JOIN public.projects AS p ON p.id = r.project_id
  WHERE r.id = project_stage_dependencies.project_stage_record_id
    AND public.can_access_department_drive(auth.uid(), p.department_id, p.id)
));
CREATE POLICY "Scoped users view feedback revisions"
ON public.project_feedback_revisions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects AS p
  WHERE p.id = project_feedback_revisions.project_id
    AND public.can_access_department_drive(auth.uid(), p.department_id, p.id)
));
CREATE POLICY "Actors view own lifecycle generation receipts"
ON public.project_lifecycle_generation_requests FOR SELECT TO authenticated
USING (requested_by = auth.uid());

CREATE OR REPLACE FUNCTION public.lifecycle_assert_actor(p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_actor IS NULL OR p_actor <> auth.uid() THEN RAISE EXCEPTION 'Authenticated actor required'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_assert_template_mutable(p_template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE template_row public.department_process_templates%ROWTYPE;
BEGIN
  SELECT * INTO template_row FROM public.department_process_templates WHERE id = p_template_id FOR SHARE;
  IF NOT FOUND OR template_row.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only DRAFT template versions may be changed; create a new version';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_lifecycle_template_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('ACTIVE', 'RETIRED') THEN
    RAISE EXCEPTION 'Active and retired template versions are immutable';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only DRAFT template versions may be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.created_by <> OLD.created_by THEN RAISE EXCEPTION 'Template actor provenance is immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE OR REPLACE FUNCTION public.enforce_lifecycle_template_stage_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.lifecycle_assert_template_mutable(COALESCE(NEW.template_id, OLD.template_id));
  IF TG_OP = 'UPDATE' AND NEW.created_by <> OLD.created_by THEN RAISE EXCEPTION 'Stage actor provenance is immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER lifecycle_template_immutable BEFORE UPDATE OR DELETE ON public.department_process_templates
FOR EACH ROW EXECUTE FUNCTION public.enforce_lifecycle_template_immutability();
CREATE TRIGGER lifecycle_template_stage_immutable BEFORE UPDATE OR DELETE ON public.department_process_template_stages
FOR EACH ROW EXECUTE FUNCTION public.enforce_lifecycle_template_stage_immutability();

CREATE OR REPLACE FUNCTION public.enforce_project_stage_dependency_dag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_project_id uuid;
DECLARE predecessor_project_id uuid;
BEGIN
  SELECT r.project_id INTO target_project_id FROM public.project_process_stage_records AS r WHERE r.id = NEW.project_stage_record_id FOR SHARE;
  SELECT r.project_id INTO predecessor_project_id FROM public.project_process_stage_records AS r WHERE r.id = NEW.predecessor_stage_record_id FOR SHARE;
  IF target_project_id IS NULL OR target_project_id <> predecessor_project_id THEN RAISE EXCEPTION 'Dependency records must belong to the same project'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(target_project_id::text, 0));
  IF EXISTS (
    WITH RECURSIVE edges(from_id, to_id) AS (
      SELECT r.id, r.predecessor_record_id
      FROM public.project_process_stage_records AS r
      WHERE r.project_id = target_project_id AND r.predecessor_record_id IS NOT NULL
      UNION ALL
      SELECT d.project_stage_record_id, d.predecessor_stage_record_id
      FROM public.project_stage_dependencies AS d
      JOIN public.project_process_stage_records AS r ON r.id = d.project_stage_record_id
      WHERE r.project_id = target_project_id AND (TG_OP <> 'UPDATE' OR d.id <> OLD.id)
    ), reach(node_id) AS (
      SELECT to_id FROM edges WHERE from_id = NEW.predecessor_stage_record_id
      UNION
      SELECT e.to_id FROM edges AS e JOIN reach AS x ON e.from_id = x.node_id
    ) SELECT 1 FROM reach WHERE node_id = NEW.project_stage_record_id
  ) THEN RAISE EXCEPTION 'Dependency would create a cycle'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lifecycle_dependency_dag BEFORE INSERT OR UPDATE OF project_stage_record_id, predecessor_stage_record_id
ON public.project_stage_dependencies FOR EACH ROW EXECUTE FUNCTION public.enforce_project_stage_dependency_dag();

CREATE OR REPLACE FUNCTION public.generate_project_lifecycle_draft(p_project_id uuid, p_template_id uuid, p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_id uuid := auth.uid(); project_row public.projects%ROWTYPE; template_row public.department_process_templates%ROWTYPE;
DECLARE prior public.project_lifecycle_generation_requests%ROWTYPE; expected_hash text; stage_row public.department_process_template_stages%ROWTYPE;
DECLARE record_id uuid; task_id uuid; result jsonb; record_ids jsonb := '[]'::jsonb; task_ids jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.lifecycle_assert_actor(actor_id);
  IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
  SELECT * INTO project_row FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR project_row.department_id IS NULL THEN RAISE EXCEPTION 'Project requires an owning department'; END IF;
  IF NOT public.can_access_department_drive(actor_id, project_row.department_id, project_row.id)
     OR NOT public.has_any_permission(actor_id, ARRAY['projects.manage','engineering.manage','documents.edit']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO template_row FROM public.department_process_templates WHERE id = p_template_id FOR SHARE;
  IF NOT FOUND OR template_row.status <> 'ACTIVE' OR template_row.department_id <> project_row.department_id THEN RAISE EXCEPTION 'Matching active department template required'; END IF;
  expected_hash := encode(digest(concat_ws('|', p_project_id::text, template_row.id::text, template_row.version::text), 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  SELECT * INTO prior FROM public.project_lifecycle_generation_requests WHERE request_key = p_request_key FOR UPDATE;
  IF FOUND THEN
    IF prior.requested_by = actor_id AND prior.project_id = p_project_id AND prior.template_id = p_template_id
       AND prior.template_version = template_row.version AND prior.payload_hash = expected_hash THEN RETURN prior.result; END IF;
    RAISE EXCEPTION 'Request key conflicts with a different actor or payload';
  END IF;
  FOR stage_row IN SELECT * FROM public.department_process_template_stages WHERE template_id = template_row.id ORDER BY sort_order, id LOOP
    INSERT INTO public.project_process_stage_records (project_id, company_process_stage_id, status, created_by, lifecycle_template_id, lifecycle_template_version, lifecycle_template_stage_id)
    VALUES (project_row.id, stage_row.source_company_process_stage_id, 'NOT_STARTED', actor_id, template_row.id, template_row.version, stage_row.id)
    ON CONFLICT (project_id, company_process_stage_id) DO NOTHING RETURNING id INTO record_id;
    IF record_id IS NULL THEN RAISE EXCEPTION 'Lifecycle source stage already exists for this project; use an explicit lineage/migration contract'; END IF;
    INSERT INTO public.project_tasks (project_id, department_id, title, status, priority, lifecycle_source_key)
    VALUES (project_row.id, project_row.department_id, stage_row.title, 'todo', 'medium', concat('lifecycle:', template_row.id, ':', template_row.version, ':', stage_row.id))
    ON CONFLICT (project_id, lifecycle_source_key) WHERE lifecycle_source_key IS NOT NULL DO NOTHING RETURNING id INTO task_id;
    IF task_id IS NULL THEN RAISE EXCEPTION 'Lifecycle task key already exists; retry using the original request key'; END IF;
    UPDATE public.project_process_stage_records SET linked_task_id = task_id WHERE id = record_id;
    record_ids := record_ids || jsonb_build_array(record_id); task_ids := task_ids || jsonb_build_array(task_id);
  END LOOP;
  result := jsonb_build_object('project_id', project_row.id, 'template_id', template_row.id, 'template_version', template_row.version, 'state', 'DRAFT', 'stage_record_ids', record_ids, 'task_ids', task_ids, 'processed_at', now());
  INSERT INTO public.project_lifecycle_generation_requests (request_key, project_id, template_id, template_version, requested_by, payload_hash, result, created_at)
  VALUES (p_request_key, project_row.id, template_row.id, template_row.version, actor_id, expected_hash, result, now());
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_project_lifecycle_draft(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_project_lifecycle_draft(uuid, uuid, uuid) TO authenticated, service_role;
```

## Feedback contract deliberately deferred

No feedback RPC is proposed for activation. Before one may be added, it must make the baseline comparison fully qualified and prove source Drive scope:

```sql
EXISTS (
  SELECT 1
  FROM public.projects AS p
  JOIN public.requirement_baselines AS b ON b.id = project_feedback_revisions.requirement_baseline_id
  LEFT JOIN public.drive_nodes AS n ON n.id = project_feedback_revisions.source_drive_node_id
  WHERE p.id = project_feedback_revisions.project_id
    AND b.id = project_feedback_revisions.requirement_baseline_id
    AND b.id = p.requirement_baseline_id
    AND (n.id IS NULL OR (n.project_id = p.id AND n.department_id = p.department_id))
    AND public.can_access_department_drive(auth.uid(), p.department_id, p.id)
)
```

## Regeneration and lineage rule

Generation consumes one immutable ACTIVE template `id + version` exactly once per project source company stage. A newer template version is **not** regenerated automatically; if it maps to a source stage already present, it fails. Any migration, supersession, or task reassignment requires a distinct reviewed lineage contract. This prevents silent rewrites of used records and extra tasks.

## Pending integration tests required before migration

1. Authentication and scope denial occur before any receipt read/return.
2. Exact replay succeeds only for identical actor/project/template/version/hash; every mismatch conflicts.
3. Concurrent identical request-key calls yield one receipt; concurrent different keys cannot duplicate the same source stage.
4. Direct DML cannot spoof actor/time or mutate/delete active/retired templates and stages.
5. Source-stage duplicate mapping is rejected at template creation.
6. Existing `predecessor_record_id` plus new dependency edges reject mixed cycles; inserts, updates, and concurrent reverse edges all reject correctly.
7. Feedback RLS checks the fully qualified baseline relationship and Drive node project/department association.
8. Department-scoped RLS is proven with non-administrator identities; administrator switching is not acceptance evidence.

## Current web panel status

The web lifecycle panel is read-only. It explicitly lists visible provenance and missing fields. Template-document auto-fill, governed notifications, and revisioned client feedback are absent and no records are created.