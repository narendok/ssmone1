# Phase 4 — Sales, Customer Requirements & Handover

## Scope
Build Phase 4 as an additive module in the existing unified SSM One application. Reuse existing employees, RBAC, activity/audit, tasks, approvals, notifications, Drive, documents, entity IDs and project foundations; do not replace PartsBench or create separate systems.

## Delivery slices
1. **Sales foundation** — customer master and contacts, enquiries/opportunities, sales owner assignment, configurable pipeline status, dashboard and permission-aware navigation.
2. **NDA & customer intake** — configurable NDA templates/instances, secure customer links, requirement Part 1 drafts/submissions, attachments, customer actions and clarifications.
3. **Internal feasibility & specification** — selectable department feasibility reviews, task/approval integrations, one-view status, Part 2 technical specification, stable requirement IDs, revision comparison and traceability matrix.
4. **Commercial & baseline** — quotation references, customer authorization records, final gate, customer confirmation, immutable baseline and controlled post-baseline change requests.
5. **Portal & handover** — secure client portal with explicitly shared records, controlled document sharing, client-visible updates, project creation from an approved baseline and applicable departmental handover tasks.

## Security and controls
- Store every new record under UUID primary keys with business IDs where needed.
- Enforce least-privilege, customer isolation, deliberate external sharing and audit trails through backend policies and server-validated actions.
- Preserve submitted, approved and baseline records through revisions, supersession and archive states rather than silent overwrites or deletes.
- Keep Google Workspace actions optional and connection-aware; no Google Calendar work is required until Settings is configured.

## Technical details
- Add the module incrementally through migrations and server functions, granting only the roles permitted by row-level policies.
- Route sales, customers, portal, requirement and review views through the existing authenticated shell; secure-link routes remain external and narrowly scoped.
- Build initial scope in the first delivery slice, then expand through each lifecycle gate without duplicating shared engines.
