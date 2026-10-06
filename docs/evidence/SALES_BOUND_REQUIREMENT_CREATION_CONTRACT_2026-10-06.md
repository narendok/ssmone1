# Sales-Bound Requirement Creation — Full Pending Contract Export (2026-10-06 UTC)

**Status:** source-only and disabled. No migration, grant, identity, fixture, or existing record is changed by this export. Database execution evidence is pending and source tests are not database acceptance.

## Scope

The contract creates a new requirement only when a caller with `sales.manage` is bound to an existing opportunity/customer pair and the **current immutable** Master Specification version for that pair. It does not update the opportunity stage, create feasibility work, convert a project, publish anything, or infer/backfill source metadata for existing requirements—including the existing 24v tracker.

## Pending objects

- New: `public.sales_requirement_creation_requests` receipt table, used only by the protected routine. It stores the caller, opportunity/customer/version source tuple, canonical payload, and persisted requirement result.
- New: `public.sales_requirement_creation_canonical_payload(...)` and `public.sales_requirement_creation_payload_hash(...)`, unavailable to browser callers.
- New: `public.create_sales_bound_customer_requirement(...)`, the single protected creation routine.
- Existing reused objects: `sales_opportunities`, `customers`, `master_specifications`, `master_specification_versions`, `customer_requirements`, `customer_requirement_revisions`, `activity_log`, `has_permission`, and `next_business_number`.

## Transaction behavior

1. Derives actor solely from `auth.uid()` and validates `sales.manage` inside a `SECURITY DEFINER` function.
2. Locks and verifies the authoritative opportunity/customer pair.
3. Locks and verifies that the requested Master Specification version belongs to that pair and equals the header's current version.
4. Canonicalizes the exact input and serializes concurrent uses of the supplied request key with an advisory transaction lock.
5. Replays only if caller, sources, canonical payload, and hash all match; changed data under the same key fails.
6. Creates the numbered requirement, revision 1, activity event, and receipt in one transaction. Any later failure rolls back every earlier insert.

## Pending direct-write decision

This proposal does **not** revoke existing direct requirement-table writes yet. The legacy `createCustomerRequirement` path must be removed or redirected in the same accepted migration; revoking first would break existing Sales flows. The new source-bound path itself never falls back to that legacy multi-call function.

## Required isolated acceptance

- Caller-authenticated Sales allowance and non-admin/RLS denial.
- Opportunity/customer mismatch and unavailable, stale, or cross-source Master-version denial.
- Exact retry returns the original ID; payload/caller/source change under the same key rejects.
- Concurrent same-key calls converge to one requirement, revision, audit, and receipt.
- Forced audit failure rolls back the header, revision, and receipt.
- Compatibility migration removes or redirects the legacy write path, then proves direct requirement/revision writes fail while all existing manual and approved records remain intact.

## Files carrying the full contract

- `supabase/pending/20261006_sales_bound_requirement_creation.sql`
- `supabase/pending/tests/sales_bound_requirement_creation_acceptance.sql`
- `src/lib/sales-bound-requirement.functions.ts` (fail-closed facade; disabled until acceptance)
