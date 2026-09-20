# Phase 5 — Project & Engineering Delivery

## Outcome
Extend the existing SSM One workspace with the project-management and engineering controls in the Phase 5 brief, while retaining PartsBench, shared work, approvals, drive, controlled documents, sales handover, and the existing RBAC model.

## Delivery plan

1. **Project foundation**
   - Extend the existing project master rather than replace it: project type, customer/opportunity links, approved requirement baseline, product identifiers, owners, dates, volumes, lifecycle stage, APQP status, health state, visibility, and completion controls.
   - Add project team membership and scoped project roles using the existing employee and role directory.
   - Upgrade `/projects` and project detail to a practical dashboard with project health, stages, milestones, open work, blockers, approvals, current revisions, and linked customer context.

2. **Requirements, research, and architecture**
   - Add project design-input, requirement traceability, PRS/SRS/HRS, research, comparison, POC, approval, and architecture registers.
   - Link records to existing controlled files, tasks, approvals, and the Phase 4 approved requirement baseline without duplicating their source data.

3. **Engineering configuration**
   - Build on existing BOMs, component inventory, PCB tasks, firmware vault, CAD vault, drive folders, and revision history.
   - Add engineering BOM release context, alternate/deviation controls, schematic/PCB reviews, DFMEA, DFM/DFA, thermal, EMC/ESD, design-review actions, configuration/revision records, and firmware/software/mechanical release records.

4. **APQP, prototype, and validation**
   - Add configurable APQP templates and project-specific progress, separate from generic project lifecycle stages.
   - Add prototype builds, material reservations, kits, substitutions, unit traceability, EVT/DVT/PVT records, DVP&R, test plans/results, engineering issues, RCA, ECR/ECN, revalidation, certification, design freeze, and final engineering release.

5. **Connected operations and governance**
   - Reuse shared Drive, document control, approval, notifications, tasks, customer portal, Gmail/Calendar/Drive settings, search, audit, and external sharing.
   - Apply project-scoped access policies and retain departmental, commercial, HR, and unrelated-project separation.

## Technical approach

- Use additive database migrations only; preserve existing `projects`, PartsBench tables, BOMs, PCB tasks, Drive, and sales records.
- Make every new public table explicitly grant access, enable row-level protection, and enforce project membership/role checks through the established authorization model.
- Deliver in reviewed increments so the full 160-section brief becomes usable milestones rather than a single unstable release.
- Keep project stages, APQP stages, and Implementation Phase labels distinct throughout the data model and interface.

## Delivery milestones

1. Project master, team/access, dashboard, design inputs, traceability, research/POC.
2. Architecture, BOM/configuration, hardware/firmware/software/mechanical work areas, reviews.
3. APQP, prototype builds, EVT/DVT/PVT, DVP&R, testing and issue/change control.
4. Certification, design freeze, release/handover, integrations, access validation, and acceptance checks.

## Assumptions

- Phase 4 customer, opportunity, baseline, handover, and portal data remain the authoritative commercial sources.
- Google Workspace remains configured later in Settings; Phase 5 will use connection-aware actions rather than require credentials during this build.
- Phase 6 is reserved for any explicitly deferred advanced manufacturing/quality extensions, not started automatically.
