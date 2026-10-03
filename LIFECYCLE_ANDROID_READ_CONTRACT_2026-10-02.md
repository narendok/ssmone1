# Android lifecycle read contract

**Verified date:** 2026-10-03 UTC  
**Scope:** authenticated read-only Android parity for lifecycle provenance. This contract does not authorize template editing, lifecycle materialization, feedback authoring, approvals, releases, notifications, or external sharing.

## Read tables

All lifecycle tables have RLS enabled and grant `SELECT` to `authenticated`; `service_role` has `ALL`. There are no `anon` grants or write policies on these tables.

| Table | Exact read predicate |
| --- | --- |
| `department_process_templates` | `can_access_department_drive(auth.uid(), department_id, NULL)` |
| `department_process_template_stages` | Parent template passes the template predicate. |
| `project_stage_dependencies` | Target stage joins to a project that passes `can_access_department_drive(auth.uid(), project.department_id, project.id)`. |
| `project_feedback_revisions` | Project passes Drive access; the baseline is the project’s active baseline; optional Drive source belongs to the same project and department. |
| `project_lifecycle_generation_requests` | `requested_by = auth.uid()` only. |

`can_access_department_drive(user, department, project)` accepts a Platform Owner, an active employee in the department, or an active employee project-team member. It does not infer ownership for legacy projects where `department_id` is null.

## Exact table shape

### `department_process_templates`

`id uuid PK`, `department_id uuid NOT NULL → departments.id RESTRICT`, `template_key text NOT NULL`, `version integer NOT NULL`, `title text NOT NULL`, `description text`, `status text NOT NULL DEFAULT 'DRAFT'` (`DRAFT | ACTIVE | RETIRED`), `created_by uuid NOT NULL`, `created_at timestamptz NOT NULL`, `activated_at timestamptz`, `retired_at timestamptz`; unique `(department_id, template_key, version)` and at most one `ACTIVE` version per `(department_id, template_key)`.

### `department_process_template_stages`

`id uuid PK`, `template_id uuid NOT NULL → department_process_templates.id RESTRICT`, `stage_key text NOT NULL`, `title text NOT NULL`, `description text`, `sort_order integer NOT NULL`, `source_company_process_stage_id uuid NOT NULL → company_process_stages.id RESTRICT`, `task_department department_type NOT NULL` (`hardware | firmware | mechanical | qa | procurement | production | executive`), `required boolean NOT NULL DEFAULT true`, `created_by uuid NOT NULL`, `created_at timestamptz NOT NULL`; unique per template for `stage_key`, `sort_order`, and source company stage.

### `project_stage_dependencies`

`id uuid PK`, `project_stage_record_id uuid NOT NULL → project_process_stage_records.id CASCADE`, `predecessor_stage_record_id uuid NOT NULL → project_process_stage_records.id CASCADE`, `created_by uuid NOT NULL`, `created_at timestamptz NOT NULL`; self dependency is rejected and each ordered edge is unique.

### `project_feedback_revisions`

`id uuid PK`, `project_id uuid NOT NULL → projects.id CASCADE`, `requirement_baseline_id uuid NOT NULL → requirement_baselines.id RESTRICT`, `revision_number integer NOT NULL`, `status text NOT NULL DEFAULT 'DRAFT'` (`DRAFT | SUBMITTED | ACCEPTED | SUPERSEDED`), `feedback_text text NOT NULL`, `source_drive_node_id uuid → drive_nodes.id RESTRICT`, `created_by uuid NOT NULL`, `created_at timestamptz NOT NULL`, `submitted_at timestamptz`, `accepted_at timestamptz`, `superseded_at timestamptz`; unique `(project_id, revision_number)`.

### `project_lifecycle_generation_requests`

`request_key uuid PK`, `project_id uuid NOT NULL → projects.id RESTRICT`, `template_id uuid NOT NULL → department_process_templates.id RESTRICT`, `template_version integer NOT NULL`, `requested_by uuid NOT NULL`, `payload_hash text NOT NULL`, `result jsonb NOT NULL`, `created_at timestamptz NOT NULL`.

Related read fields: `project_process_stage_records.lifecycle_template_id`, `.lifecycle_template_version`, `.lifecycle_template_stage_id`; `project_tasks.lifecycle_source_key`. `drive_node_revisions` uses `sha256_checksum`, not `checksum`.

## Lifecycle action status

The six action routines are `SECURITY DEFINER`, use `search_path=public`, and are executable only by `postgres` and `service_role`: `create_department_process_template(uuid,text,text,text)`, `upsert_department_process_template_stage(uuid,uuid,text,text,text,integer,uuid,department_type,boolean)`, `clone_department_process_template(uuid)`, `activate_department_process_template(uuid)`, `retire_department_process_template(uuid)`, and `generate_project_lifecycle_draft(uuid,uuid,uuid)`.

**Android action status:** none accepted. Mobile clients must not call those routines, cannot create/modify lifecycle records, and must treat lifecycle data as read-only until protected server actions are deployed and database acceptance succeeds.

## Guard behavior

- Template and stage provenance is server-owned; DRAFT-only edits are enforced by triggers.
- Activation and retirement are protected transitions; active and retired content is immutable.
- Generation authorizes before replay. An exact same `request_key`, actor, project, template/version, and payload hash returns the saved receipt; any difference conflicts.
- Stage generation rejects an existing project/company-stage source; successor versions do not regenerate automatically.
- New dependency edges and legacy `predecessor_record_id` writes run one mixed graph cycle guard under a project advisory lock.
- A linked process stage cannot move to another project; the reassignment trigger checks both new dependency edges and legacy predecessor links.
- Generation receipts are insert-only and immutable.

## Applied source integrity

| Migration | SHA-256 |
| --- | --- |
| `supabase/migrations/20261002220916_5d158822-de77-479d-a8af-54037acc96ad.sql` | `5e169d9c341e64b9395408e3b17f8342aa1368f9060e95b621e9fc1b5f7a1612` |
| `supabase/migrations/20261002220956_e9863fb2-326a-48c2-92e7-3ecf984fadef.sql` | `0a1fcc234fd3d440472129f7413c0159345ed1de6a6867699a996cc19f7df580` |
| `supabase/migrations/20261002222912_968576b3-8784-47e4-acd1-90a0855c459b.sql` | `ae262f3354f420c02b81c2380cd66ca561d22dd222f4a0ba226d506be46457dc` |
| `supabase/migrations/20261002223025_f7f9fcf2-063e-4223-b757-54c0dac73714.sql` | `42dfb5773f322b02479284b75d36b96bd99b55280a510dd6c39b26d068e36773` |

## Remaining acceptance findings

No isolated database mutation, concurrent reverse-edge/replay, rollback, or non-administrator RLS acceptance was run. The six database routines remain unavailable to authenticated callers and the web server-action bridge remains deliberately disabled. Suitable isolated database access plus approved administrator and non-administrator test identities are required before enabling the bridge. The Android build may read the contract above, but does not establish least-privilege acceptance.