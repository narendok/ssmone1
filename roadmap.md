# Unified platform roadmap

## Current request

- [ ] Harden the Master Specification controlled-write contract before any further deployment: the deployed `sales.manage` direct table grants/policies currently bypass source pairing, optimistic version locking, revision progression, actor provenance, and audit. **Source-only proposal and denial acceptance are required before any revocation; no production migration, permission widening, fixtures, identities, or publication.** Client requirement intake and assigned engineering feasibility remain source-only until scoped external RLS compatibility is accepted.

## Maintenance

- [ ] Complete backend-level Master Specification acceptance against the managed isolated environment, including denied user, transaction rollback, optimistic conflict/concurrency, immutable revision, and non-admin RLS proof. **Current deployed original contract:** the source-of-truth specification and revision records are live; no additional fixtures will be created. **In progress:** Sales reload query repair removes the undeployed `current_version_id` assumption and waits for authenticated identity hydration before fetching. **Blocked evidence:** accepted isolated manager is an administrator; a scoped non-administrator identity is not available and must not be created for this work.
- [ ] Complete isolated caller-authenticated acceptance for scoped client requirement intake and engineering feasibility. **Source-only protected intake correction prepared:** `supabase/pending/20261005_client_requirement_intake.sql` now uses a narrow authenticated actor/contact/party/opportunity/customer-verified SECURITY DEFINER transaction for atomic requirement, immutable revision 1, and audit creation without widening direct external table RLS. **Blocked:** a secure isolated runner with approved scoped external/reviewer identities is required to prove expiry/revocation/wrong-pair/direct-table denial, audit rollback, caller RLS, reviewer immutability, and concurrency before application. The UI remains disabled; no live schema, permissions, records, or conversion changed.
  **Harness added:** `supabase/pending/tests/run_client_requirement_intake_isolated_acceptance.sh` refuses the original backend and emits only a read-only allowlisted isolated-backend preflight; `src/lib/isolated-sales-acceptance.functions.ts` provides the same authenticated, no-mutation status. Execution remains blocked because the isolated executor has no approved scoped external/reviewer identities or authenticated application-RPC transport.

- [ ] Surface all agreed Master Specification core and More Options fields in the Proposed Project dialog, backed by immutable versioned specification revisions; create only one synthetic proposal after contract acceptance.
- [ ] Implement versioned Master Specification persistence for Proposed Projects. **Source and unapplied contract prepared:** canonical fields, immutable append-only versions, actor/source provenance, optimistic conflict checks, audit receipt, and permission-scoped RLS are in `src/lib/master-specification.ts`, `src/lib/master-specifications.functions.ts`, and `supabase/pending/20261005_master_specification_versions.sql`. **Blocked:** original schema does not contain the tables/RPC; accepted isolated backend must prove denied-user, rollback, concurrency and non-admin RLS before the proposal can be applied. Document generation remains gated.
- [ ] Reconcile the reviewed isolated Template Acceptance source with the original project without enabling production lifecycle mutations. **In progress:** preserve the isolated-only deployment gate; compare and transfer only compatible additive Drive/project serialization, canonical nontrashed scope validation, preview-safe project/task error handling, and invalidation fixes. **Blocked from deployment:** original backend enablement still requires exact deployed-schema reconciliation plus real authorization, rollback/storage-compensation, replay/conflict/concurrency, and non-admin RLS acceptance evidence.
- [ ] Review and accept the hardened project-Drive provisioner proposal. **Source-only:** `supabase/pending/20261005_harden_project_drive_provisioning_boundary.sql` serializes provision requests, excludes trashed roots, and validates/persists the canonical root pointer without widening access. **Blocked:** it needs managed-backend regression acceptance against existing roots before it can be applied.
- [x] Add OAuth-protected, read-only agent integration tools for accessible projects, tasks, and Drive document metadata; all tool data remains subject to each connected user’s existing workspace permissions.
- [x] Create three SAMPLE ONLY OEM tracker tasks in PROJECT-2026-0005 after correcting the canonical department-to-task enum mapping. **Verified:** all three records are linked to the sample Hardware project; no identities, roles, or access changed.
- [ ] Verify lifecycle documentation generation on PROJECT-2026-0005. **Blocked:** the reviewed lifecycle mutation bridge intentionally rejects all creates, edits, saves, retries, and audit/revision generation pending isolated acceptance. The exact missing evidence is authorization denial, transaction rollback, replay/concurrent-request behavior, and non-administrator RLS using approved test identities. The project contains generated folders only, no document drafts.
- [x] Implement source-only deterministic lifecycle document rendering, storage orchestration, server-only database-RPC bridge, authoritative preflight, and governed template-content façade/proposal: immutable identifiers only, server-loaded template revision/content, Drive target, project fields, canonical SQL-equivalent source fingerprint, and service-only append/activate/retire routines. **Implemented source:** protected authenticated façades validate department management and DRAFT-only content intent before the closed mutation gate; the settings register exposes disabled template-body, clone, activate, retire, and stage controls. **Proposal only:** the pending SQL defines actual content-revision, activation, and retirement RPCs; neither it nor a live action/UI bridge is deployed. `supabase/pending/20261003_lifecycle_document_draft_generation.sql`, `supabase/pending/tests/lifecycle_document_draft_acceptance.sql`, and `supabase/pending/tests/lifecycle_document_draft_concurrency.sh` remain unapplied. Mutation stays disabled until isolated storage/DB, rollback, concurrent replay/conflict, and non-admin RLS acceptance pass. Browser template content and fields are not accepted.

- [ ] Complete lifecycle foundation Pack 0 with versioned templates, guarded draft generation, mixed dependency DAG protection, and verified client contracts. **Applied:** the additive schema and RLS/read contracts are live; template/stage immutability, clone/activate/retire contracts, server-owned provenance, and legacy predecessor edge guards are present. **Source-only Pack 1:** department lifecycle settings now display RLS-visible templates/stages and clearly disabled management actions; the Drive identifies the final three taxonomy categories without altering historical folders. A Platform Owner-only legacy Drive ownership preflight now reports RLS-visible project/Drive consistency and accepts only an explicit no-write dry-run owner selection. **Pending proposal:** `supabase/pending/20261003_periodic_conditional_review_mapping.sql` maps periodic/conditional reviews with locked `STANDARD` metadata under verified standards roots; it remains unapplied and does not touch historical folders. **Blocked:** no isolated database environment or approved non-administrator identities exist for mutation, concurrency, rollback, and least-privilege acceptance; no project records were generated.
- [ ] Verify the served development preview contains the department-scoped Drive repair and diagnose stale preview delivery without publishing production. **In progress:** user reports an older `/drive` surface at `preview--ssmone1.lovable.app`.
- [x] Separate the System controls overview into the `/admin` index route so `/admin/drive-ownership` renders the guarded read-only ownership preflight instead of the parent overview. **Source/UI only:** no data, access, or publishing changes.
- [x] Extend the read-only legacy Drive preflight to normalize real Drive node values, flag every FILE without a persisted revision (including version one), identify blank source paths, and report missing BOM source node/revision links. **Source/UI only:** no records changed.
- [x] Restrict Drive Project BOM presentation and queries to the active authorized engineering, procurement, or production workspace; Finance, HR, Facility/security, Sales, Operations, and unknown workspaces cannot display or request BOM browsing, including when a project is selected. **Source/UI only:** backend RLS remains unchanged.
- [x] Repair department-scoped Drive entry points and stale workspace state without changing backend access controls.
- [x] Apply the approved consolidated department-to-role mapping, preserve inactive legacy aliases, align Drive management permissions, and verify existing mobile contracts.
- [x] Publish the exact verified Android client contract for notification inbox state and read actions.
- [x] Provision governed, idempotent project Drive templates with approved empty folders while preserving existing project files and access controls.
- [x] Implement server-side, RLS-safe in-app notification automation for task events, approvals, and authenticated read state.
- [x] Ensure administrators can edit existing department records from Administration, with clear save feedback and no permission bypass.
- [x] Refine daily-work navigation: remove repeated Command Center, Department Center, and task-board controls while preserving all existing task, approval, project, and document access.
- [x] Deliver Zoho-style department workspaces: each lead gets unified request, task, approval/gate, and SSM One document-reference controls without replacing established operational workflows. Google Drive linking remains blocked until an App User Connector is available.
- [x] Add an all-department lead command center with role-aware operational queues, workload pulse, and direct actions into each existing workspace.
- [x] Add department-specific Today’s priorities and past-due task focus to the command center, with administrator oversight across every department.
- [x] Add safe Administrator department-context switching so administrators can oversee each department from its dashboard without impersonating another user or changing authorization.
- [x] Add Administrator department quick-view cards for today, priority, and pending work, with each card opening its department dashboard.
- [x] Consolidate the department dashboard into one role-aware lead page with administrator-selectable department context and direct management access.
- [x] Link tasks to their existing project, purchase-request, CAPA, and customer-quality context, and allow administrators to create or edit projects from the project pages.
- [x] Group the department navigation under expandable department headings, expanded by default for administrators, with a direct Department Center entry point.
- [x] Connect R&D and project-member pages to their next actions, with contextual member creation links and no identity or authorization changes.
- [x] Make CSV and purchase-import approvals create visible available lots alongside location stock, ledger history, audit records, persisted posting results, and retry-safe locking.
- [x] Repair Add/Edit component location saves to use the protected inventory location action instead of blocked direct location writes.
- [ ] Re-enter verified source quantity and storage details for the remaining historical zero-stock components (max485, irfz44). **Blocker:** the database retained no source quantity or location data, so automatic backfill would invent inventory facts. The five verified DigiKey components (KG200ZABTB, VNH7040AYTR, MLPF-WB-02D3, C0402C105K4PAC7411, GRM188R71H224KAC4D) were posted through the Administrator-only recovery action: 5 units each in bin `bag 1`.
- [x] Repair the sign-in page hydration mismatch.
- [x] Standardize responsive workspace navigation around Dashboard, Work, Search/Scan, Drive, and More without changing department or inventory authorization.
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

- [ ] Complete remaining Phase 1 administration forms: role/permission catalogue and module status. Employee access, document numbering, and activity-history access are available through Administration.
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

- [ ] Implement the approved lean portal foundation with clearly labeled demo data, preserving protected workflows and existing operational records.
- [ ] Expand the clearly labelled Command Center sample tasks with notes, progress, project, and team-owner context. **In progress:** sample data is display-only and will not create operational records.
- [x] Create a clearly labelled sample workspace-storage hierarchy from the supplied audit repository: exact top-level groups, device/part/revision packs, seven hardware phases, Supplier Quality, Calibration/Laboratory controls, and placeholder controlled-document records; do not alter live records.
- [x] Deliver and apply the approved department/access redesign: HW canonicalization, hierarchy, least-privilege inventory permissions, reconciled helpers/RLS, and guarded inventory routes. Verified with focused tests; no stock, credentials, users, or publishing changes.

- [ ] Apply approved access redesign: backend department canonicalization, RBAC/RLS reconciliation, and inventory route guards; verify denied and authorized access paths.

- [x] Make administrator workspace context switching primary; remove redundant My Day switching and add all-departments task visibility.
- [x] Focus navigation and quick work links on the selected administrator department workspace without altering authorization.
- [ ] Add user-approved real departmental operating records through their established workflows. **Blocker:** source records and owners have not been supplied; the workspace must not invent business data.
- [ ] Complete the authorized OEM Tracker SAMPLE ONLY acceptance fixture without duplicating the project. Reuse the three existing suspended, no-login sample employee profiles; the only verified new-employee workflow requires a hired application and provisions an auth invitation, which is prohibited. **In progress:** exact sample project/task/portal verification is underway. Verify documentation generation on `PROJECT-2026-0005` only: reversible detail edit, draft field mapping, template/version provenance, saved Drive revision, audit trail, idempotent retry, and preservation of manual/approved records; report unsupported operations without inferring a draft generator from the template catalogue.
- [x] Complete department cleanup and department-scoped Drive/project workflow.
- [x] Restore department Drive navigation with Common, Internal Project, Client Project, PPAP, Starred, and BOM filters; add Platform Owner editable folder categories for future projects.
- [ ] Restore signed-in Sales proposal detail: add clickable opportunity/Master Specification detail, reload-stable field and nine-stage applicability display, and prevent repeated submits without altering existing synthetic attempts. **In progress:** retain and clearly report pre-existing incomplete attempts; do not delete or archive them automatically.
