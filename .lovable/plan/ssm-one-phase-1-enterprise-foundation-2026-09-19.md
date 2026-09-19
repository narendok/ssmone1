# SSM One Phase 1 — Enterprise Foundation

## Outcome
Transform the existing PartsBench application into the first module of **SSM One**, initially branded as **Six Sense Mobility**, while preserving all current inventory, BOM, PCB, Drive, task, project, and procurement capabilities. Branding stays editable through Administration.

## Existing compatibility baseline
- Preserve the existing auth-linked `profiles`, legacy `user_roles`, R&D roster (`rd_members`), PartsBench inventory/BOM/procurement/PCB tables, storage buckets, supplier integration, and bookmarked routes.
- Keep the existing `app_role`, `has_role`, `can_purchase`, `can_inward`, and document-number functions operating for PartsBench. Add the enterprise permission model alongside them rather than replacing them.
- Treat current authenticated accounts as active employees by default. Ensure `narendok@gmail.com` is the initial System Admin; if no account exists, provide an administrator invitation rather than creating an unlabelled account.
- Remove the public one-click demo-account experience from the production login surface; no fake employee data will be added.

## 1. Safe data and access foundation
- Inspect current database policies and authentication configuration before applying one additive migration.
- Add normalized enterprise tables for organization settings, departments, employees, employee-department membership, roles, permissions, role-permissions, employee-role assignments, module settings, notifications, activity/audit records, entity registry, and document-numbering configuration.
- Seed only the stated official department names/codes and a reusable initial permission/module catalogue. Seed Six Sense Mobility organization defaults in editable settings; do not seed fake people or operational data.
- Bridge the new employee record to existing authenticated profiles and optionally link the historical `rd_members` roster without changing legacy identifiers or foreign keys.
- Add a reusable, server-validated effective-permission function and least-privilege RLS policies. Protect administration records, employee privacy fields, notifications, audit entries, and future-module routes; keep existing PartsBench policies intact.
- Audit organization, department, employee status, role, and permission changes. Support employee states: invited, active, suspended, exited.

## 2. Authentication and identity experience
- Retain email/password and Google sign-in, add password-reset and invitation activation flows, and enable safe session handling.
- Route suspended/exited accounts away from the application with a clear access message.
- Replace the split PartsBench login branding with the editable Six Sense Mobility/SSM One identity while keeping the page hydration-safe.
- Consolidate identity loading into one profile/permission source so the existing two-role frontend mismatch cannot weaken navigation or authorization.

## 3. Unified responsive shell and navigation
- Replace the PartsBench-only shell with a compact desktop sidebar, responsive mobile drawer, and top bar containing organization mark, global search, quick create, notifications, approvals placeholder, identity/department indicator, and profile/settings menu.
- Drive sidebar items from a central module registry and effective permissions. Group modules as Home, Work, Business, Engineering, Operations, Workplace, Management, and System.
- Preserve all working PartsBench pages under Engineering → R&D / PartsBench, while leaving their current URLs functional. Map existing inventory, BOM, procurement, PCB, Drive, projects, assignments, and task pages into the new shell.
- Add protected, polished “Coming in next implementation phase” routes for explicitly listed future modules; no fake workflows or data.

## 4. Phase 1 application surfaces
- Build a role-aware **Home / My Work** dashboard shell. Today’s work and overdue/pending work appear first, followed by reusable empty-state cards for priority work, approvals, notifications, active projects, department status, activity, and quick access.
- Build an Administration area for Organization Settings, Departments, Users, Roles, Permissions, user/department assignments, module status, document-numbering configuration, audit log, and system settings.
- Build profile viewing/editing within privacy rules, employee suspension controls, and invitation actions.
- Build notification center basics (unread count, list, read/unread, mark all read, target link) with one clearly labelled system notification per active user only where needed to validate the feature.
- Build a keyboard-accessible Ctrl/Cmd+K global search overlay for permitted PartsBench objects, employees, departments, and modules. Search results use the same permission checks as their destinations.
- Add reusable activity timeline and permission-gate utilities for current and future modules.

## 5. Stable identity and document groundwork
- Introduce a permanent UUID-based entity registry/permalink convention without changing existing primary keys or document codes.
- Add QR/deep-link-ready entity metadata and stable URL patterns for future records.
- Add editable controlled-document numbering tiers and governance metadata as configuration/foundation only; defer the document editor, revision engine, approvals, and file generation.

## 6. Quality, verification, and handoff
- Add route metadata to every new content route and correct the existing root metadata strategy.
- Verify the reported `/auth` hydration mismatch is resolved.
- Test existing PartsBench routes and data access, administration CRUD/RLS, role-specific navigation, unauthorized direct-route denial, suspension, branding edits, audit entries, notifications, global search, and desktop/tablet/mobile layouts.

## Deferred to Phase 2+
- Full task/process/approval engine, controlled document editor/revisions/approval workflows, automated reminders, HRM workflows, production/facility/security operations, full unified Drive migration, native mobile app, and department-specific operational workflows.

## Technical notes
- The migration is additive and reversible where practical; no production tables, enum values, legacy roles, existing URLs, or existing records will be reset, dropped, or renamed.
- Granular enterprise RBAC will coexist with legacy PartsBench roles until each existing capability is deliberately migrated.
- Database types will be regenerated after the migration, and client code will use server-validated permissions plus RLS rather than UI-only checks.
