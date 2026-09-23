# Phase 8 — Facility, Assets, Maintenance, Calibration, Security & Workplace

## Scope
Extend SSM One with a single, QR-addressable, mobile-ready Phase 8 operating layer. Reuse existing employees, departments, projects, purchasing, inventory, production stations, drive, tasks, approvals, notifications, automation rules, roles, permissions, and numbering.

## Deliverables
1. **Facility** — hierarchical location master, responsible people, QR resolution, utilities/electrical readings, recurring checks, issues, and incidents.
2. **Assets** — generated asset IDs and QR labels; configurable categories; acquisition, custody, status, lifecycle, assignment, CAPEX and disposal records; purchase/GRN-assisted creation.
3. **Maintenance** — asset-linked preventive plans, condition readings, scheduled work orders, breakdowns, repair history, spares and purchasing handoff.
4. **Calibration and workplace** — instrument/IMTE register, calibration schedule and certificates, lab/ESD checks, MSA references, workstations, benches and employee allocations.
5. **Security operations** — visitor and vehicle movements, material gate passes, patrols, guard-post location links, and incident logging.
6. **Experience and access** — role-scoped navigation, desktop and field-friendly screens, QR detail pages, quick-create flows, automatic numbering, activity history and controlled attachments.
7. **Automation** — due-date reminders, escalation candidates, asset/calibration/maintenance status suggestions, and reviewable automation history using the existing Automation Center.

## Data and safeguards
- Use additive migrations only; preserve existing identifiers and history.
- Reuse `locations` where suitable or safely extend it into the facility hierarchy instead of duplicating masters.
- Apply RLS and explicit table grants for every new table; use existing permission patterns and roles.
- Make identifiers system-generated and protect duplicates with database constraints/triggers where needed.
- Keep human approval for asset creation, status changes, maintenance completion, calibration acceptance, disposals, and gate/security exceptions.

## Technical details
```text
Locations → assets → assignments / maintenance / calibration / readings / incidents
Assets → purchase orders / GRNs / inventory spares / employees / projects / stations
Security → locations / employees / visitors / vehicles / materials / patrols / incidents
```

New route groups will be provided under `/facility`, `/assets`, `/maintenance`, `/calibration`, `/security`, and `/workplace`, with permission-scoped visibility.

## Acceptance checks
- A location, asset, instrument, work order, visitor and gate pass can be created without manually typing a business identifier.
- QR-linked detail views show the linked operating context.
- Maintenance and calibration due states are visible and actionable.
- Asset assignments and returns retain history.
- Signed-in roles can only see and operate the areas their permissions allow.
- Existing Phase 1–7 data and workflows remain available.
