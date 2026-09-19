# Phase 2 — Common operational engine

## What will be built

1. Add the shared, permission-aware data foundation for tasks, recurring checklists, processes, approvals, comments, attachments, document control, templates, entity links, and activity/audit events.
2. Upgrade the existing task workspace into the global task engine and make **My Work** the initial logged-in view, with Today, Overdue, Upcoming, Waiting/Review, Approvals, and due checklists.
3. Extend the existing private Drive rather than replace it: stable file/folder links, reusable references, version history, sharing/revocation traceability, personal favorites, and richer file metadata.
4. Add a controlled-document register with numbering, working-vs-released lifecycle, immutable approved revisions, template metadata, and source-data snapshot/sync state.
5. Add reusable interfaces for process progress, approvals, comments/mentions, activity timelines, QR/entity resolution, global search, and permission-aware quick create.
6. Preserve all PartsBench records, URLs, storage, and workflows. No existing production table will be dropped, renamed, or reset.

## Delivery sequence

1. Apply one additive database migration with the shared schema, access functions, RLS policies, audit helpers, and indexes.
2. Build server-backed mutation helpers for state-changing actions so ownership, access, notifications, and audits are enforced together.
3. Evolve `/tasks` and add `/my-work`, `/approvals`, `/documents`, and entity resolver routes; enhance `/drive` in place.
4. Update sidebar navigation, global search, and quick-create controls only for completed routes.
5. Validate the highest-risk acceptance flows with an authenticated administrator session; clearly mark any flow awaiting another user account as unverified.

## Technical details

- Existing `project_tasks`, `project_task_checklists`, `drive_nodes`, `drive_node_revisions`, `drive_share_links`, `drive_user_favorites`, `notifications`, `activity_log`, `entity_registry`, and `document_numbering_config` remain in use and gain additive links/metadata only.
- New reusable records cover task collaborators/dependencies/attachments, checklist templates and immutable instances, process templates/stages/instances/gates, approvals/decisions, comments/mentions, attachment references, controlled documents/revisions/templates/source snapshots, drive access rules, and generic entity links.
- Protected writes use authenticated server functions and server-validated identity. Row-level policies restrict ordinary users to permitted task, approval, drive, document, and notification records; audit records remain non-editable.
- Scheduled reminder generation will be designed as an idempotent server-side job endpoint. In-app notifications are implemented in this phase; external email and mobile delivery are deferred.
- A single harmless demonstration process template will be created without fake employees or production operational data.

## Assumptions and deferrals

- The current administrator invitation must be completed before signed-in multi-user authorization tests can run.
- No hard-delete flows are introduced for business records; archive, cancel, supersede, and revoke are used instead.
- Phase 3 will add department-specific products (HR, sales, production, facility), complex template rendering/export, scheduled external delivery channels, customer portals, native mobile clients, and specialist engineering previews.
