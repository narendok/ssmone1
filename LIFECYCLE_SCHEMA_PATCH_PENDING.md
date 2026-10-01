# Pending lifecycle schema patch

**Prepared:** 2026-10-01 UTC  
**Status:** deliberately unapplied. It would create new authenticated write paths and needs security review before any migration is submitted.

## Additive objects proposed

```sql
CREATE TABLE public.department_process_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  template_key text NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE (department_id, template_key, version)
);

CREATE TABLE public.department_process_template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.department_process_templates(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL,
  source_company_process_stage_id uuid REFERENCES public.company_process_stages(id) ON DELETE SET NULL,
  required boolean NOT NULL DEFAULT true,
  UNIQUE (template_id, stage_key),
  UNIQUE (template_id, sort_order)
);

CREATE TABLE public.project_stage_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_stage_record_id uuid NOT NULL REFERENCES public.project_process_stage_records(id) ON DELETE CASCADE,
  predecessor_stage_record_id uuid NOT NULL REFERENCES public.project_process_stage_records(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (project_stage_record_id <> predecessor_stage_record_id),
  UNIQUE (project_stage_record_id, predecessor_stage_record_id)
);

CREATE TABLE public.project_feedback_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requirement_baseline_id uuid NOT NULL REFERENCES public.requirement_baselines(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','ACCEPTED','SUPERSEDED')),
  feedback_text text NOT NULL,
  source_drive_node_id uuid REFERENCES public.drive_nodes(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, revision_number)
);

ALTER TABLE public.project_tasks
  ADD COLUMN lifecycle_source_key text;
CREATE UNIQUE INDEX project_tasks_lifecycle_source_key_unique
  ON public.project_tasks(project_id, lifecycle_source_key)
  WHERE lifecycle_source_key IS NOT NULL;
```

## Required but intentionally unspecified security contract

- Template edit scope and template activation authority.
- Project materialization authority, template-version selection, and source-provenance validation.
- Whether a project team member, department lead, or administrator may create a feedback revision.
- Cycle prevention for the dependency DAG.
- Server-owned idempotency key, notification recipient resolution, and the existing service-only notification enqueue boundary.
- Exact RLS policies and grants for every new public table.

No SQL above has been migrated, no policies/grants were applied, and no records, notifications, access, roles, ownership, releases, or external links were changed.