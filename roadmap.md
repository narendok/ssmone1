# Unified platform roadmap

## Maintenance

- [x] Repair the sign-in page hydration mismatch.
- [ ] Review the newly added DigiKey order through the inventory CSV approval workflow after category safeguards are validated.

## Mobile Stage 5 backend remediation

- [x] Add payload-bound idempotent, atomic GRN and inventory posting contracts with deterministic locking and server-owned document numbers.
- [x] Route existing web GRN, R&D issue/return, and stock-adjustment screens through the controlled contracts without changing their user journeys.
- [x] Add commercial-safe operational receiving projections and refresh the mobile handoff package with individual 5A–5G readiness.
- [x] Add Administrator-only, idempotent `TEST-MOB-*` acceptance seed plus safe PR/RFQ/shipment/vendor projections that exclude commercial and sensitive vendor fields.
- [ ] Obtain approved test identities/environment support for live session-scoped RLS and concurrent transaction acceptance evidence. **Blocker:** no dedicated test identities/environment are available in this task.

## Phase 4 — Sales, customer requirements & handover

- [x] Build the sales foundation: customer master, contacts, enquiries, opportunities, owner assignment, navigation and dashboard. Customer, contact, enquiry, opportunity database foundations and sales/customer overview screens are complete; enquiry and opportunity creation forms remain.
- [x] Add NDA tracking and controlled customer requirement intake.
- [x] Add feasibility reviews, stable requirement IDs and revision foundations.
- [x] Add commercial references, customer authorization, baseline and controlled change foundations.
- [x] Add secure customer portal links and approved-baseline project handover records.

## Phase 3 — HR

- [ ] Establish any missing shared operational primitives required by the HR module without duplicating Phase 2 systems.
- [ ] Build secure HR recruitment and public Careers flows. Public candidate intake, secure resume uploads, private application status lookup, and recruiter pipeline review are complete.
- [ ] Add assessments, interviews, offers, controlled candidate-to-employee conversion and invitations. Interviews and offer controls are complete; conversion now creates an invited employee, starts onboarding, and sends an invite. Assessment remains.
- [ ] Build onboarding, digital ID, welcome-kit, employee self-service, leave, policies and training foundations. Plan/policy/training administration and onboarding execution are complete; digital ID, welcome-kit fulfilment controls, self-service, and manager leave approvals remain.
- [ ] Add connection-aware Google Workspace integration settings and guarded actions.
- [ ] Validate public, HR, reviewer, manager and employee authorization flows.

## Preserved follow-up work

- [ ] Complete remaining Phase 1 administration forms: users, roles/permission assignment, module status, document numbering, and audit log.
- [ ] Complete shared Phase 2 operational surfaces: My Work, approvals, documents, enriched Drive, resolver, global search and activity timelines.

## Phase 5 — Project delivery & engineering controls

- [x] Extend the shared project foundation, team access, design inputs, research records, engineering registers, delivery gates, issues and engineering changes.
- [x] Add the project portfolio and workspace surfaces for delivery governance, BOMs, files, firmware, CAD and project tasks.
- [x] Preserve existing PartsBench project, BOM, Drive, firmware, CAD and task workflows.
- [x] Add the Projects access module, Project Manager role, and project view/manage permissions to the shared administration catalog.

## Stabilization Patch 01

- [x] Central numbering, HR/customer/project auto-codes, canonical department task transition, department aliases, duplicate protections, scoped customer portal contacts, job-profile selection, and onboarding safeguards are complete.
- [x] Signed-in acceptance is complete for the System Admin access path across purchasing, stores, incoming quality, finance, and administration; public authentication and Careers checks passed without browser errors.

## Stabilization Patch 02

- [x] Build the shared automation registry, execution audit, cache, and provenance foundation without changing established records.
- [x] Add reviewed supplier and AI category suggestions to component entry, and establish safe, human-controlled automation patterns.
- [ ] Complete project-handover drafting and bounded background automation. Signed-in System Admin acceptance checks are complete.

## Phase 6 — Procurement, stores, quality & finance

- [x] Complete the Phase 6 operational workflows, role-gated screens, automation safeguards, and acceptance validation. Atomic GRN-to-incoming-quality lot holds, purchase-request review, delivery-revision decisions, supplier-return controls, payment approvals, RFQ/quotation capture, server-controlled workflow decisions, and signed-in System Admin acceptance are complete. Do not begin Phase 7 without an explicit instruction.

## Phase 7 — Production & manufacturing execution

- [x] Establish the controlled production foundation: role-gated Production workspace, configurable routes, BOM-snapshotted work orders, material readiness, lot-linked kitting records, and unique unit serialization.
- [x] Add server-controlled work-order creation and lifecycle transitions, including material-readiness blocking before release and approval-gated release/completion.
- [x] Add shop-floor execution, in-process quality, testing, and approval-gated NCR/rework/scrap dispositions with unit-level traceability.
- [x] Add finished-goods release, PPAP, and dispatch controls without duplicating shared systems. Finished-goods release, PPAP packages, controlled dispatch, and signed-in production route validation are complete.

## Phase 8 — Facility, assets, maintenance, calibration, security and workplace
- [x] Implement approved Phase 8 scope; stop before Phase 9.
- [x] Added Phase 8 facility, asset, maintenance, calibration, security, workplace foundations, QR identifiers, role permissions, RLS, reviewable automations, and mobile-ready operational screens.

## Phase 9 — QMS, customer quality & governance
- [x] Implement the approved QMS, KPI, audit, CAPA, customer quality, document-control and management-review layer; stop before Phase 10.


## Phase 10 — External collaboration extensions
- [x] Complete the Phase 10 security corrections: authenticated invitations, guarded portal access, immutable sharing, quarantined upload handling, signed webhook intake, workflow guards, and focused validation tests. Phase 11 remains out of scope.
