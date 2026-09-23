# Phase 9 — QMS, customer quality & governance

## Outcome
Build the Phase 9 QMS governance layer inside SSM One. It will use live data from existing procurement, production, maintenance, calibration, HR, customer, project and document systems—without parallel spreadsheets or duplicate operational records.

## What will be added

### QMS governance
- Quality objectives linked to one or more KPIs, with owners, targets, dates, evidence and controlled reviews.
- KPI master, versioned calculation definitions, reproducible period snapshots, status thresholds, source-data drill-down and human-reviewed manual inputs where no reliable live source exists.
- Risk and opportunity register with links back to the originating customer, project, audit, supplier, production, calibration or maintenance record.
- Controlled contingency plans, tests, evidence and review schedules.

### Audits, findings and improvement
- Audit program, plan, auditor competency/independence checks, configurable checklists, findings and evidence.
- Controlled NCR, root-cause, CAPA, effectiveness verification, improvement actions and lessons learned.
- Management-review agenda, live performance inputs, decisions, actions and follow-up tracking.

### Customer quality
- One connected customer-service workspace for complaints, field failures, warranty, returns and satisfaction feedback.
- Reuse customer, dispatch, production, supplier-quality, project and document records wherever linked evidence already exists.

### QMS records
- QMS views over the existing controlled document and Drive system: master list, distribution/acknowledgement requirements, change-impact assessments and retention policies.
- Approved/released quality records remain immutable; corrections use traceable amendments.

### Operational experience
- Permission-controlled QMS dashboard with live KPI status, overdue actions, CAPA, findings, complaints, warranty, supplier performance, calibration, training, PPAP, production trends, risks and management-review actions.
- QMS and Customer Service navigation with focused lists, creation flows, review actions and source-record drill-down.
- Review-required automation for overdue/high-risk items, KPI exceptions, CAPA reminders and management-review inputs; AI suggestions remain evidence-bound and human-controlled.

## Technical details
- Additive database migrations only, with explicit authenticated/service grants, RLS and role-scoped policies for every new table.
- New QMS permissions and Quality/Customer Service roles will use the existing access-role catalog.
- Server-side save/review functions will authenticate every request and enforce permissions; browser reads remain scoped by RLS.
- Live KPI calculations will read existing operational sources first. Manual values are retained only with evidence and reviewer controls; incomplete source data is explicitly shown as incomplete.
- Preserve PartsBench, existing documents, Phase 6 supplier quality, Phase 7 NCR/PPAP/production quality, and Phase 8 maintenance/calibration records.

## Validation and stop condition
- Validate permissions, database policies, navigation, key list/create/review flows, automation safeguards and live KPI source handling.
- Deliver a Phase 9 completion report after stabilization.
- Do not begin Phase 10 automatically.
