# Sales Intake & Master Specification — Review Export (2026-10-05 UTC)

## Scope and safety state

This is a source-and-schema review export. It performs no mutation and does not include credentials, tokens, identity material, or private URLs.

- Original application: Master Specification persistence is deployed and visible through the normal signed-in Sales UI.
- Client requirement intake through an external portal and assigned-reviewer response remain **source-only and disabled** pending isolated caller-RLS acceptance.
- No project conversion, baseline, external sharing, document generation, or production gate enablement is included here.

## 2026-10-06 controlled-write review addendum

### Confirmed Master Specification bypass

The deployed Master Specification contract does **not** currently make the save RPC the exclusive mutation path.

- `authenticated` has `INSERT`, `UPDATE`, and `DELETE` table privileges on `master_specifications`, and the broad `FOR ALL` policy admits every `sales.manage` caller or administrator.
- `authenticated` has `INSERT` on `master_specification_versions`, and the append policy admits the same callers.
- The only deployed version trigger rejects `UPDATE` and `DELETE`. It does not validate a new version's source, sequence, actor, change note, pointer, or audit record.
- There is no deployed header trigger preventing direct source-pair changes, `current_version` mutation, `created_by` spoofing, status mutation, or deletion.

Therefore a `sales.manage` caller can directly create or alter records while bypassing the canonical pairing check, optimistic lock, atomic revision increment, server-owned actor provenance, and activity audit in `save_master_specification_version`. Existing happy-path UI saves do not prove this boundary.

### Source-only compatible replacement, deliberately unapplied

- Proposal: `supabase/pending/20261006_master_specification_controlled_mutation_hardening.sql`
- Isolated acceptance runner: `supabase/pending/tests/master_specification_direct_write_acceptance.sql`
- Source regression: `src/lib/master-specification-controlled-mutation.test.ts`

The proposal first replaces `save_master_specification_version(...)` with the compatible controlled transaction, then removes direct authenticated and inherited `PUBLIC` write grants plus broad write policies. It does **not** install an unconditional reject trigger: PostgreSQL triggers execute inside `SECURITY DEFINER` calls too, so that design would deny the legitimate routine. The replacement is `SECURITY DEFINER` with `SET search_path = public, pg_temp`; it has no actor or role input. It derives its actor from `auth.uid()`, explicitly re-checks existing `sales.manage`/admin authorization, locks the authoritative Sales opportunity and header, derives the customer pairing from that source, performs the expected-version check, atomically inserts one revision/updates the pointer/writes the audit, and returns the existing receipt shape. The function is `PUBLIC`/`anon` revoked and executable only by `authenticated` and `service_role`.

It rejects an initial-save replay when the authoritative opportunity already owns a specification instead of silently creating a duplicate. A retry after an uncertain successful response must reopen with the returned `specificationId` and current version; a stale retry is rejected under the header lock. It is intentionally **not applied** until the caller-authenticated acceptance cases below pass.

The matching handler remains `src/lib/master-specifications.functions.ts`, export `saveMasterSpecification = createServerFn({ method: "POST" })`, with `requireSupabaseAuth`, `masterSpecificationSaveSchema`, and a caller-RLS lookup of the authoritative opportunity/customer pair. It never receives an actor, role, customer ID, or service credential from the browser. It calls the routine with the derived pair and retains the existing `{ specificationId, versionId, versionNumber, specificationNumber }` receipt.

The proposal explicitly rejects null IDs, expected version, title, change summary, and payload before business checks. It accepts only nonempty workstream arrays whose values are `HARDWARE`, `FIRMWARE`, `MECHANICAL`, `TEST`, or `MANUFACTURING`.

Required isolated evidence is enumerated in `supabase/pending/tests/master_specification_direct_write_acceptance.sql`: preflight privilege inspection, normal controlled save through the retained immutable-version trigger, null-input rejection, source-pair rejection, stale expected version, direct header insert/update/delete denial, direct version insert denial, forced audit rollback, and a two-session concurrent expected-version race. Immutable historical revision and non-admin caller-RLS proof remain required additions to the isolated run.

The present deployed Sales access model is **global permission scoped**, not record-owner scoped: its policies test `sales.view`, `engineering.view`, `sales.manage`, or admin capability, without an ownership predicate. The pending change preserves that read model; it does not broaden a grant or claim row-level Sales ownership.

### Client-intake RLS compatibility gap

The previous `submit_external_customer_requirement(...)` draft was `SECURITY INVOKER`, while the existing `customer_requirements` and `customer_requirement_revisions` write policies are staff-only (`sales.manage`/administrator). It could never complete an otherwise valid external submission.

The pending replacement at `supabase/pending/20261005_client_requirement_intake.sql` is now a narrow `SECURITY DEFINER` transaction with `SET search_path = public, pg_temp`. It derives the actor only from `auth.uid()`, resolves the active external contact and party via the established helpers, verifies active/non-revoked/non-expired `CLIENT_REQUIREMENTS` access with explicit opportunity and customer scope, verifies the party/customer and authoritative opportunity/customer pairing, then atomically inserts the requirement, immutable revision 1, and provenance-rich audit. The caller supplies no contact, party, actor, role, or privilege parameter. Each request receipt stores both an MD5 collision-detection value and the exact canonical JSONB payload; replay requires equality of both.

No direct external table policy or grant is widened: the pending routine is the sole proposed external write path, and the acceptance runner explicitly requires direct requirement/revision/audit reads and writes to remain denied. The existing feasibility-review policy mismatch remains a separate, pending reviewer-contract gap; it is not loosened or enabled by this correction.

The intake UI remains disabled until an isolated authenticated external-contact acceptance proves the protected RPC, atomic audit rollback, expiry/revocation/wrong-pair denial, direct-table denial, and caller RLS. No policy or live data changed.

## Exact migration and proposal paths

### Deployed Master Specification migration

- `supabase/migrations/20261005183103_2157aab7-4509-46b0-bc31-4d5f6e7785d0.sql`
- Source-equivalent review proposal: `supabase/pending/20261005_master_specification_versions.sql`

The migration creates:

- `public.master_specifications`
- `public.master_specification_versions`
- `public.master_specification_versions_immutable()` and trigger `master_specification_versions_no_update_delete`
- `public.save_master_specification_version(...)`

### Pending client-intake proposal

- `supabase/pending/20261005_client_requirement_intake.sql`
- Acceptance contract: `supabase/pending/tests/client_requirement_intake_acceptance.sql`

The pending proposal defines:

- `public.external_requirement_scope_allows(p_opportunity_id uuid, p_customer_id uuid) returns boolean` (internal only; derives the current caller contact)
- `public.submit_external_customer_requirement(p_opportunity_id uuid, p_customer_id uuid, p_title text, p_customer_reference text, p_requirement_data jsonb, p_request_key uuid) returns uuid`
- `public.record_requirement_feasibility_response(p_review_id uuid, p_status text, p_findings text, p_assumptions text, p_risks text) returns uuid`
- `public.requirement_feasibility_response_guard()` and its update trigger

## Server façades and signatures

### Signed-in Master Specification save façade

- `src/lib/master-specifications.functions.ts`
- Export: `saveMasterSpecification = createServerFn({ method: "POST" })`
- Middleware: `requireSupabaseAuth`
- Input: `masterSpecificationSaveSchema`
- Database RPC: `save_master_specification_version(p_specification_id, p_opportunity_id, p_customer_id, p_title, p_expected_version, p_change_summary, p_specification_data)`
- Receipt shape: `{ specificationId, versionId, versionNumber, specificationNumber }`

The façade retrieves the authoritative opportunity/customer pair through the caller-RLS client before calling the RPC. It does not use a service client in browser code.

### Pending client intake façades

- `src/lib/client-requirement-intake.functions.ts`
- `submitClientRequirement = createServerFn({ method: "POST" })`
  - middleware: `requireSupabaseAuth`
  - input: `{ opportunityId, customerId, requestKey, title, description, customerReference }`
  - calls `submit_external_customer_requirement(...)`
- `recordAssignedFeasibility = createServerFn({ method: "POST" })`
  - middleware: `requireSupabaseAuth`
  - requires `engineering.manage` through `has_permission`
  - input: `{ reviewId, verdict, findings, assumptions, risks }`
  - calls `record_requirement_feasibility_response(...)`

These façades exist in source only. The associated UI is explicitly disabled and does not claim a live submission path.

## Effective grants and controls

### Master Specification, deployed original contract

`master_specifications`

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_specifications TO authenticated;
GRANT ALL ON public.master_specifications TO service_role;
```

`master_specification_versions`

```sql
GRANT SELECT, INSERT ON public.master_specification_versions TO authenticated;
GRANT ALL ON public.master_specification_versions TO service_role;
```

RLS restricts reads to `sales.view`, `engineering.view`, or admin; mutations require `sales.manage` or admin. `save_master_specification_version` is `SECURITY INVOKER`, requires signed-in `sales.manage` or admin, validates the authoritative opportunity/customer pairing, locks the specification row, checks `current_version`, appends a new revision, and writes an activity record. Version rows reject both UPDATE and DELETE via trigger.

Function grant in source/deployed migration:

```sql
REVOKE ALL ON FUNCTION public.save_master_specification_version(uuid, uuid, uuid, text, integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_master_specification_version(uuid, uuid, uuid, text, integer, text, jsonb) TO authenticated, service_role;
```

### Pending client intake proposal

The pending external submission routine is `SECURITY DEFINER`, not `SECURITY INVOKER`; no external-table policy widening is proposed. It derives caller/contact/party identity from authenticated session helpers and restricts the scoped write by active/revoked/expiry checks plus explicit `access_scope` membership for both opportunity and customer.

```sql
REVOKE ALL ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb);
REVOKE ALL ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) TO authenticated, service_role;
```

The feasibility response routine locks the assigned review, requires a non-null terminal verdict and findings, requires the exact assigned reviewer to be an active employee of that review's department, rejects a second terminal response, and records an audit event. An engineering manager cannot silently submit another assigned reviewer's verdict. The trigger enforces the same assignment and department boundary on direct updates, then prevents reassignment and post-terminal edits.

## 2026-10-06 reviewer hardening — exact pending contract

This section exports the full reviewer-facing pending SQL contract for independent review. It is **unapplied** and the normal Sales UI keeps the actions disabled until caller-authenticated isolated acceptance exists.

### Assignment routine

```sql
public.assign_requirement_feasibility_review(
  p_requirement_id uuid,
  p_department_id uuid,
  p_reviewer_user_id uuid
) returns uuid
```

- `SECURITY DEFINER SET search_path = public, pg_temp`.
- Derives the actor solely from `auth.uid()` and requires `has_permission(auth.uid(), 'sales.manage')`.
- Requires all three IDs, an existing requirement, and an `ACTIVE` employee membership in the selected department for the requested reviewer.
- Locks the existing `(requirement_id, department_id)` row with `FOR UPDATE`.
- Creates a pending unresponded assignment, or resets only a `pending`/`in_review` assignment to pending when reassigned. Terminal review reassignment is rejected.
- Writes an `activity_log` `assigned` event in the same transaction with requirement, department, reviewer, and `pending` status. Audit failure rolls back the assignment.

### Response routine

```sql
public.record_requirement_feasibility_response(
  p_review_id uuid,
  p_status text,
  p_findings text,
  p_assumptions text,
  p_risks text
) returns uuid
```

- `SECURITY DEFINER SET search_path = public, pg_temp`.
- Derives the actor only through `auth.uid()` and requires `engineering.manage`.
- Rejects null/non-terminal verdicts and blank findings before changing state.
- Locks the review (`FOR UPDATE`) and linked `customer_requirements` source (`FOR KEY SHARE`).
- Requires that the caller is exactly the assigned reviewer and remains an active employee in the assigned department.
- Allows only `pending`/`in_review` to one terminal verdict; writes one `responded` audit event whose `after_data` binds `requirement_id`, source opportunity/customer, department, reviewer, and verdict.
- There is no custom-GUC authorization marker in this routine or its guard.

### Direct-write boundary and trigger invariants

```sql
REVOKE INSERT, UPDATE, DELETE ON TABLE public.requirement_feasibility_reviews FROM authenticated;
DROP POLICY IF EXISTS "Sales users manage feasibility reviews" ON public.requirement_feasibility_reviews;
REVOKE ALL ON FUNCTION public.assign_requirement_feasibility_review(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_requirement_feasibility_review(uuid, uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) TO authenticated, service_role;
```

`requirement_feasibility_response_guard()` rejects terminal records before every other branch, then rejects all `requirement_id` and `department_id` mutation. Reviewer changes are permitted only as a fresh unresponded pending assignment; pending resets are permitted only from `pending`/`in_review`. Any terminal response otherwise requires the assigned active reviewer. The pending INSERT guard permits only unresponded `pending` rows and the DELETE guard rejects every delete; direct authenticated DML is unavailable in addition to these defense-in-depth triggers.

### Current Sales façade compatibility

- `src/lib/sales.functions.ts` now exports `assignFeasibilityReview`, validates `{ requirementId, departmentId, reviewerUserId }`, re-checks `sales.manage` as the caller, and calls only `assign_requirement_feasibility_review`.
- The legacy `saveFeasibilityReview` direct table upsert has been removed from source; it cannot silently bypass the pending transaction after revocation.
- `src/lib/client-requirement-intake.functions.ts` exports `recordAssignedFeasibility`, validates the terminal response shape, re-checks `engineering.manage`, then calls `record_requirement_feasibility_response`.
- `src/components/sales/SalesLifecycleDialogs.tsx` shows both assignment and response controls as acceptance-pending and disabled. It does not label either as an active workflow.

## Executable isolated acceptance harness

The runner is source-only and intentionally has no mutation mode until approved scoped identities and a caller-authenticated RPC transport are available.

- Read-only server façade: `src/lib/isolated-sales-acceptance.functions.ts`, export `getIsolatedSalesAcceptancePreflight`.
- Pure allowlist/preflight contract: `src/lib/isolated-sales-acceptance.ts`.
- Shell preflight: `supabase/pending/tests/run_client_requirement_intake_isolated_acceptance.sh`.
- SQL case contract: `supabase/pending/tests/client_requirement_intake_acceptance.sql`.

The runner accepts only isolated backend `egjotuxqguifnvdnflan` and refuses original backend `yyrvduosyyaluifqvwkr`. It neither reads nor accepts tokens, does not set JWT/custom-GUC identity, does not invoke an RPC, does not use service-role access, and does not apply SQL. Its read-only report names exact unavailable prerequisites: an approved scoped external-contact caller, an approved assigned-reviewer caller, caller-authenticated application-RPC execution, an audit-failure fixture boundary, and two independent approved sessions.

Once those prerequisites are supplied, the fixture is ready to execute exact retry/replay, canonical-payload collision/key conflict, legacy overload absence, terminal source/department/reviewer reassignment denial, audit-failure rollback, same-key concurrency, and concurrent expected-version tests. Until then, these are static/source coverage only, not executed database evidence.

## Acceptance SQL and test runners

- Master Specification source tests: `src/lib/master-specification.test.ts`
- Master Specification controlled-write source tests: `src/lib/master-specification-controlled-mutation.test.ts`
- Master Specification façade: `src/lib/master-specifications.functions.ts` (`saveMasterSpecification`, protected server function; source-integrated but pending caller-database acceptance)
- Client-intake unit tests: `src/lib/client-requirement-intake.test.ts`
- Client-intake isolated DB acceptance: `supabase/pending/tests/client_requirement_intake_acceptance.sql`

The intake acceptance SQL requires secure, separate authenticated sessions and provides cases for outsider denial, expired/revoked/unscoped access, wrong-pair denial, direct-table denial, forced audit rollback, one-time reviewer response, caller-RLS denial, and concurrent reviewer conflict. It intentionally does not contain credentials.

## Read-only acceptance inspection and execution blocker

Read-only inspection found `public.save_master_specification_version(...)` in the acceptance schema. Therefore the Master Specification RPC is **not missing** there.

The exact safe, non-secret read-only result from the isolated executor was:

```text
function: public.save_master_specification_version(p_specification_id uuid, p_opportunity_id uuid, p_customer_id uuid, p_title text, p_expected_version integer, p_change_summary text, p_specification_data jsonb)
executor_can_execute: false
```

The isolated SQL executor runs as `sandbox_exec` with `rolbypassrls = true`. It cannot invoke the application RPC, and its bypass role cannot supply evidence of caller RLS, denied-user behavior, or authenticated RPC execution. This is distinct from the normal signed-in UI server façade: the latter runs through `requireSupabaseAuth`, attaches the caller identity, and uses the caller-RLS database client.

The acceptance environment has historical evidence that an approved manager used the protected normal UI to save generated documents. That does not grant the isolated SQL executor application-RPC execution and does not prove the requested Master Specification denial, rollback, optimistic conflict, concurrency, immutable-revision, or non-admin RLS cases.

### Exact blocked operation

Running database acceptance transactions that call `save_master_specification_version` (and the pending intake RPCs after deployment) as an authenticated application caller is blocked until the isolated environment provides a secure caller-authenticated runner with EXECUTE on the application RPCs and approved scoped identities. No identity, grant, token, or permission change was made to bypass this limitation.

## Existing saved source snapshot

The preserved synthetic proposal remains:

- Opportunity: `OPPORTUNITY-2026-0013`
- Master Specification: `MASTER-2026-0001`, revision 1

Sales reads the immutable version payload from `master_specification_versions` by `specification_id` and `version_number`. The UI does not synthesize a new requirement, project, or conversion from that payload.
