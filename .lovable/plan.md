# Department consolidation, access removal, and governed Drive structure

## Outcome

Retire the legacy Hardware, R&D, Marketing & Business Development, and Administrator department concepts; remove the Administrator role; and organize department documents under controlled common standards plus department-owned Internal and Client project folders. Add realistic, clearly labelled example records for the requested work areas.

## Changes

1. Consolidate departments safely
   - Keep the active operating departments: Hardware / R&D, Procurement, Production, Facility / Maintenance, Operations / QMS, HR, Sales, and Finance.
   - Retire the legacy Hardware, R&D, and Marketing & Business Development entries without deleting historical records.
   - Remove the Administration workspace and its navigation, dashboard, and work-area mappings.
   - Replace the outdated department synchronization seed so it cannot recreate retired departments.
   - Replace remaining legacy task and R&D-member department labels with their canonical department assignments.

2. Remove Administrator access safely
   - Remove the Administrator/System Administrator access template, its permission assignments, and its workspace-only controls.
   - Reassign or deactivate existing Administrator-linked access only after an explicit data audit identifies affected employees and operating ownership.
   - Remove administrator-only department switching and cross-department visibility controls, then make department views use the signed-in employee’s approved department access.
   - Preserve secure, server-enforced authorization checks; no client-side access shortcuts.

3. Add the department Drive hierarchy
   - Create one locked main folder for every active department.
   - Add a shared `Rules, Regulations & Standards` area plus separate `Internal Projects` and `Client Projects` areas beneath each department.
   - When a project is created and assigned to a department, place its governed project folder into the department’s Internal or Client Projects area.
   - Use the supplied 8-part project hierarchy for each individual project folder:
     1. Project Management & Administration
     2. Requirements & System Engineering
     3. Hardware Engineering
     4. Software & Firmware
     5. Mechanical & Thermal Design
     6. Validation & Testing
     7. Manufacturing, Quality & Supply Chain
     8. Deliverables & Client Handover
   - Keep the supplied detailed subfolders within those eight areas, prevent deletion or renaming of the structural folders, and preserve existing files.

4. Apply department-scoped document access
   - Add department ownership and folder type metadata to document nodes and department assignment/type to projects.
   - Backfill existing project folders conservatively: attach only projects with a verified department; keep unassigned projects in a protected fallback location.
   - Tighten document visibility and editing so users see only documents for their own authorized department or explicit project membership; client projects remain restricted to their authorized teams.

5. Add labelled starter records
   - Add realistic `SAMPLE ONLY` records, never mixed with live operational data, for:
     - R&D requirements
     - Procurement RFQs
     - Production assembly work
     - Facility assets
     - Operations audits
     - HR employee records
     - Sales quotations
   - Use the existing record screens and protected workflows rather than creating parallel data structures.

6. Validate the changed experience
   - Verify retired departments and Administrator controls cannot reappear through synchronization, navigation, or new assignments.
   - Verify each department opens only its approved work areas and document root.
   - Verify standard/internal/client folder placement, locked structure protection, project membership restrictions, and project-folder provisioning.
   - Verify every sample record is visibly labelled and reachable only through its appropriate department workspace.

## Technical details

- Department removal will be archival/deactivation and reference migration, not hard deletion, to protect employee, task, HR, procurement, quality, and project history.
- The existing Drive tree has only project linkage today, so this work adds controlled department and folder-type relationships before moving folders.
- Role removal requires a pre-change audit of affected employee-role assignments; the plan will not silently strip active users of access without a defined replacement.
- Database changes will include explicit grants and row-level access policies for every new or modified user-facing structure.