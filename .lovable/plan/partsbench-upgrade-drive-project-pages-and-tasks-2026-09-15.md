# PartsBench upgrade: Drive, Project pages and Tasks

Built in three phases so you can use and review each one before the next starts.

## Phase 1 — Drive & file manager (`/drive`)

A Google-Drive-style area for project files.

- Folders and files with breadcrumbs (Home > PRJ-001 > 07_PPAP_and_Audit_Package > 18_PSW).
- Every new project automatically gets a full folder tree: BOM, Hardware EDA, Firmware, Mechanical CAD, Testing & QA, Procurement, the 18-part PPAP audit pack, and Backups. These folders are locked so nobody deletes them by accident.
- Upload, rename, move to trash, download. Each upload gets a checksum calculated in the browser so you can prove the file wasn't altered.
- Star / audit-critical marking per person, plus filter tabs: All items, Starred, PPAP package.
- Grid and dense list views, instant search, colour-coded folders.
- Version history per file — upload a new revision with a change note, see and download older ones.
- Share links for auditors or customers, with view/download permission and an optional expiry.
- Built-in previews: PDF (using the viewer already in the app), images, CSV/Excel tables, and a rotatable 3D viewer for STL models. STEP files download only — browsers can't display them without conversion.

## Phase 2 — Project detail page (`/projects/:id`)

Clicking a project anywhere in the app opens its own page with tabs:

- **Overview** — code, revision, status, colour, linked components count, design link.
- **Files** — the same Drive view, scoped to that project.
- **Firmware** — upload .bin/.hex/.elf/.uf2 with version, target chip, flash offset, a "golden production" badge and one-click checksum copy.
- **Mechanical** — CAD files with the 3D viewer, size box, and spec tags (material, finish, IP rating, weight).
- **Tasks** — arrives with Phase 3.

## Phase 3 — Tasks & departments (`/tasks`)

- New **Tasks** entry in the sidebar: every task across the company, including standalone ones not tied to a project ("Calibrate oscilloscope rig 2"). Toggle between All tasks and My tasks.
- Tasks carry a department (Hardware, Firmware, Mechanical, QA, Procurement, Production, Executive/PM), priority, status, assignee, due date, estimated vs logged hours, optional PPAP element number, and links to a Drive file or a PCB repair job.
- Kanban board (To do, In progress, In review, Blocked, Done) with drag-and-drop, plus a sortable table view.
- Coloured department filter pills as specified in your document.
- Slide-over drawer per task: description, checklist with progress bar, linked files, and a full activity timeline of every status change, reassignment and comment.
- Two new roles, **project manager** and **lead engineer**, and a department on each team member. Only admins and project managers can delete tasks or reassign across departments; assignees and department members can move their own work along. Moving a QA task to Done asks for an explicit sign-off confirmation.
- Demo login buttons gain the two new roles so you can try the permission rules.

## Not included (from your document)

These are already working or were left out of this round: barcode/DataMatrix scanning, Mouser price popover, stock transfers between bins, Ctrl+K command palette, BOM batch-build calculator, split-bin GRN receiving. Say the word and I'll plan them as a Phase 4.

## Technical notes

- **Phase 1 schema:** `drive_nodes` (project_id, parent_id, name, slug, node_type, file_type, mime_type, size, storage bucket/path, sha256, is_starred, current_version, is_locked), `drive_node_revisions`, `drive_user_favorites`, `drive_share_links`. Recursive `get_drive_breadcrumbs`, `toggle_node_star` RPC, and a `provision_project_drive_folders` AFTER INSERT trigger on `projects` — adapted to this database, which uses `projects.code`, not `project_code`. The uploaded SQL also has multi-row INSERTs with `RETURNING ... INTO` and a column-count mismatch on two rows; those are corrected in the applied version.
- New private storage bucket `project-drive`, with object policies restricting reads/writes to authenticated users; downloads issued as short-lived signed URLs from a server function. SHA-256 computed client-side via `crypto.subtle.digest`.
- **Phase 3 schema:** `department_type`, `task_priority`, `task_status` enums; `project_tasks`, `project_task_activity`, `project_task_checklists`; `app_role` extended with `project_manager` and `lead_engineer`; `profiles.department` added (the uploaded policy references it and it doesn't exist yet). `linked_bom_id` is dropped from the task table — there is no `boms` table in this database; BOM work stays file-linked via `drive_node_id`. `user_has_task_role` is rewritten to compare against `app_role` values rather than a text array cast.
- Every new table: explicit GRANTs to `authenticated` / `service_role`, RLS enabled, policies as described, and `EXECUTE` revoked from `public`/`anon` on all new SECURITY DEFINER functions.
- 3D viewer: `three` + STL loader, lazy-loaded behind `ClientOnly` so it never runs during server rendering (Cloudflare Workers constraint).
- Data access follows existing patterns: TanStack Query hooks against the browser Supabase client for reads, `createServerFn` for signed URLs and privileged writes.
