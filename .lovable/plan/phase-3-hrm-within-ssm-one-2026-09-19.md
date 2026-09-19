# Phase 3 — HRM within SSM One

## What will be built

1. Add a secure HR module that extends the existing employee directory, RBAC, activity log, notifications, Drive and entity identity foundations without creating separate authentication, HR, task, drive, or approval products.
2. Build recruitment from requisition through approved hiring: requisitions, jobs, candidate identity/application records, public Careers pages, resume intake and reviewable extraction, duplicate review, pipeline, assessments, interview scorecards/scheduling, offers and controlled candidate-to-employee conversion.
3. Build employee-facing HR capabilities: onboarding and department hand-offs, employee identity/QR, welcome-kit and ID tracking, profiles, leave requests, policy acknowledgements, training/competency records, probation and exit foundations.
4. Reuse common operations records where available for approvals, tasks, processes, document records, Drive references, entity links, activity and notifications; implement missing common primitives once as shared infrastructure rather than HR-only copies.
5. Keep Google Workspace optional: integration health and connection-aware actions will be surfaced, while Gmail, Calendar and Drive features remain usable only after an authorized connection is linked.

## Delivery sequence

1. Establish the additive shared operational foundation required by Phase 2/3: process, approval, comments, controlled documents/templates, safe entity links, task extensions, and restricted Drive access references.
2. Apply additive HR schema and permissions with RLS that separates candidate, employee and application-account identities and limits confidential records to authorized HR or assigned evaluators.
3. Build internal HR dashboard, recruitment, job, candidate, interview, offer, onboarding, employee, leave, training and policy workspaces.
4. Build public Careers browsing, job detail, application, secure candidate status, and secure assessment flows with server-side token validation and candidate-only scope.
5. Add controlled conversion, invitations, onboarding task/checklist generation, HR document/Drive references, entity/QR resolution, search, activity and quick-create integrations.
6. Add Google Workspace connection status and guarded Gmail/Calendar/Drive integration seams; implement provider actions only once a linked connection and required scopes are available.
7. Validate critical public, HR, manager and employee authorization flows; leave external-provider actions explicitly marked as awaiting connection where applicable.

## Technical details

- No production table, bucket, URL, account, PartsBench workflow or existing Drive path will be dropped, renamed or reset.
- Candidate, candidate application, employee and authenticated account remain distinct records. Candidate data never creates an employee or internal account until an authorized hiring conversion.
- Candidate resumes and confidential HR files are stored through the private Unified Drive with access references; copied links must be checked through server-side authorization.
- Resume parsing stores original file, parser output, and candidate-confirmed values separately. Parser and scoring results assist human review only and never auto-hire or auto-reject.
- Human-readable identifiers are generated alongside permanent UUIDs. Job slugs and candidate/assessment tokens are random, scoped, revocable and expire where appropriate.
- All sensitive creation/state-transition paths use authenticated server functions or secure public endpoints with strict validation. RLS and permission checks mirror the UI boundaries.
- Requisition approval, interview/offer/hiring approval and leave approval use the shared approval model. Onboarding uses the shared process and task/checklist model.
- Google credentials are never stored in browser code. Gmail, Calendar and Drive use optional workspace connections with minimum scopes; no full inbox mirror or default Drive mirror is introduced.

## Deferrals

- Payroll, statutory processing, tax, PF/ESI, bank disbursement, final settlement and a full asset/security-gate system remain out of scope.
- Automatic candidate anonymization/purge, advanced recruiter AI ranking, surveillance/proctoring, full mailbox synchronization, and broad Google Drive mirroring remain disabled until separately approved.
- Provider-backed Gmail/Calendar/Drive actions require an authorized connection and are not simulated when no connection exists.
