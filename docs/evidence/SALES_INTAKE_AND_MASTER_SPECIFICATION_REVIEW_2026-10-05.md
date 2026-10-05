# Sales Intake & Master Specification — Review Export (2026-10-05 UTC)

## Scope and safety state

This is a source-and-schema review export. It performs no mutation and does not include credentials, tokens, identity material, or private URLs.

- Original application: Master Specification persistence is deployed and visible through the normal signed-in Sales UI.
- Client requirement intake through an external portal and assigned-reviewer response remain **source-only and disabled** pending isolated caller-RLS acceptance.
- No project conversion, baseline, external sharing, document generation, or production gate enablement is included here.

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

- `public.external_requirement_scope_allows(p_contact_id uuid, p_opportunity_id uuid, p_customer_id uuid) returns boolean`
- `public.submit_external_customer_requirement(p_opportunity_id uuid, p_customer_id uuid, p_title text, p_customer_reference text, p_requirement_data jsonb) returns uuid`
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
  - input: `{ opportunityId, customerId, title, description, customerReference }`
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

The proposed routines are `SECURITY INVOKER`; no external-table policy widening is proposed. External callers are restricted inside the requirement RPC by a current external-contact lookup, active/revoked/expiry checks, and explicit `access_scope` membership for both opportunity and customer.

```sql
REVOKE ALL ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_external_customer_requirement(uuid, uuid, text, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_requirement_feasibility_response(uuid, text, text, text, text) TO authenticated, service_role;
```

The feasibility response routine locks the assigned review, requires a terminal verdict and findings, rejects a second terminal response, and records an audit event. The trigger prevents reassignment and post-terminal edits.

## Acceptance SQL and test runners

- Master Specification source tests: `src/lib/master-specification.test.ts`
- Master Specification façade tests: `src/lib/master-specifications.functions.ts` has no dedicated test file in the reviewed source.
- Client-intake unit tests: `src/lib/client-requirement-intake.test.ts`
- Client-intake isolated DB acceptance: `supabase/pending/tests/client_requirement_intake_acceptance.sql`

The intake acceptance SQL requires secure, separate authenticated sessions and provides cases for outsider denial, expired/revoked/unscoped access, forced audit rollback, one-time reviewer response, caller-RLS denial, and concurrent reviewer conflict. It intentionally does not contain credentials.

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
