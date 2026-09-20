# Phase 3 — HR module completion

## Goal
Complete the remaining HR employee journey inside the existing SSM One application, preserving the implemented Careers intake, candidate pipeline, leave desk, and all PartsBench workflows.

## Work to complete
1. Finish the recruitment progression with assessments, interview scheduling/feedback, offer drafting and approval states, and a controlled hire conversion.
2. Add employee provisioning and onboarding: employee profile handoff, invitation readiness, onboarding checklist, digital identity record, and welcome-kit tracking.
3. Complete employee self-service and HR administration for leave review, training programs/enrollments, policies, and employee directory views.
4. Reuse the existing shared activity, notification, permission, Drive, and approval foundations rather than introducing parallel systems.
5. Add safe database/RLS changes only where missing, with explicit grants and role-scoped policies.
6. Validate public Careers, recruiter, interviewer, manager, and employee-facing flows, then close the Phase 3 roadmap items that are complete.

## Technical details
- New work remains additive to the existing HR tables and routes.
- Candidate records remain separate from employee records and application identities.
- Hiring conversion creates or links an employee record only after an offer is accepted and hiring authority approves it.
- Private candidate materials stay visible only to authorized HR/recruitment users.
