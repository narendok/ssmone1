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
2. Canonicalizes input, serializes the supplied request key, and checks its receipt **before** current-source verification. Exact historical retries return their original ID even after the Master Specification advances; changed caller/source/payload fails.
3. On first creation only, locks the authoritative opportunity with `FOR UPDATE`, then its Master Specification with `FOR UPDATE`, matching the controlled Master save's source order. These locks block a concurrent opportunity customer-pair or current-version update until the transaction resolves.
4. Verifies the requested Master Specification version belongs to that locked pair and equals the locked header's current version.
5. Creates the numbered requirement, revision 1, activity event, and receipt in one transaction. Any later failure rolls back every earlier insert.

## Receipt isolation

The pending DDL grants receipt-table access only to `service_role` and explicitly revokes all access from `PUBLIC`, `anon`, and `authenticated`. The protected definer routine alone reads/writes caller receipts; browser callers cannot inspect or insert them.

## Pending direct-write decision

This proposal does **not** revoke existing direct requirement-table writes yet. The legacy `createCustomerRequirement` path must be removed or redirected in the same accepted migration; revoking first would break existing Sales flows. The new source-bound path itself never falls back to that legacy multi-call function.

## Required isolated acceptance

- Caller-authenticated Sales allowance and non-admin/RLS denial.
- Opportunity/customer mismatch and unavailable, stale, or cross-source Master-version denial.
- Exact retry returns the original ID; payload/caller/source change under the same key rejects.
- Exact replay still returns the historical ID after the Master Specification advances; a fresh key with the earlier version fails.
- Concurrent same-key calls converge to one requirement, revision, audit, and receipt.
- A concurrent source-pair/current-version mutation blocks behind the first-create locks and cannot change the verified provenance before that create commits.
- Forced audit failure rolls back the header, revision, and receipt.
- Compatibility migration removes or redirects the legacy write path, then proves direct requirement/revision writes fail while all existing manual and approved records remain intact.

## Full pending SQL

```sql
-- See the exact source file: supabase/pending/20261006_sales_bound_requirement_creation.sql
-- This export embeds the complete routine body for independent review.
CREATE OR REPLACE FUNCTION public.create_sales_bound_customer_requirement(
  p_opportunity_id uuid, p_customer_id uuid, p_master_specification_version_id uuid,
  p_title text, p_customer_reference text, p_summary text, p_request_key uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_requirement public.customer_requirements%ROWTYPE;
  v_prior public.sales_requirement_creation_requests%ROWTYPE;
  v_payload_canonical jsonb;
  v_payload_hash text;
  v_source_specification_id uuid;
  v_source_version_number integer;
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN RAISE EXCEPTION 'Sales management permission is required'; END IF;
  IF p_request_key IS NULL OR p_opportunity_id IS NULL OR p_customer_id IS NULL OR p_master_specification_version_id IS NULL OR NULLIF(btrim(p_title), '') IS NULL OR char_length(btrim(p_title)) > 240 OR (p_customer_reference IS NOT NULL AND char_length(btrim(p_customer_reference)) > 160) OR (p_summary IS NOT NULL AND char_length(btrim(p_summary)) > 8000) THEN RAISE EXCEPTION 'A request key, bound sources, and valid requirement fields are required'; END IF;
  v_payload_canonical := public.sales_requirement_creation_canonical_payload(p_opportunity_id, p_customer_id, p_master_specification_version_id, p_title, p_customer_reference, p_summary);
  v_payload_hash := public.sales_requirement_creation_payload_hash(p_opportunity_id, p_customer_id, p_master_specification_version_id, p_title, p_customer_reference, p_summary);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  SELECT * INTO v_prior FROM public.sales_requirement_creation_requests WHERE request_key = p_request_key FOR UPDATE;
  IF FOUND THEN
    IF v_prior.requested_by = v_actor_id AND v_prior.opportunity_id = p_opportunity_id AND v_prior.customer_id = p_customer_id AND v_prior.master_specification_version_id = p_master_specification_version_id AND v_prior.payload_hash = v_payload_hash AND v_prior.payload_canonical = v_payload_canonical THEN RETURN v_prior.requirement_id; END IF;
    RAISE EXCEPTION 'Request key conflicts with a different caller or payload';
  END IF;
  PERFORM 1 FROM public.sales_opportunities WHERE id = p_opportunity_id AND customer_id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity/customer source mismatch'; END IF;
  SELECT specification.id, version.version_number INTO v_source_specification_id, v_source_version_number FROM public.master_specifications specification JOIN public.master_specification_versions version ON version.specification_id = specification.id WHERE version.id = p_master_specification_version_id AND specification.opportunity_id = p_opportunity_id AND specification.customer_id = p_customer_id AND version.version_number = specification.current_version FOR UPDATE OF specification;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master Specification version is unavailable for this opportunity and customer'; END IF;
  INSERT INTO public.customer_requirements (requirement_number, opportunity_id, customer_id, title, status, current_revision, customer_reference, requirement_data, submitted_at, created_by) VALUES (public.next_business_number('customer_requirement', 'CR', NULL), p_opportunity_id, p_customer_id, btrim(p_title), 'submitted', 1, nullif(btrim(coalesce(p_customer_reference, '')), ''), jsonb_build_object('summary', nullif(btrim(coalesce(p_summary, '')), ''), 'source', jsonb_build_object('opportunity_id', p_opportunity_id, 'customer_id', p_customer_id, 'master_specification_id', v_source_specification_id, 'master_specification_version_id', p_master_specification_version_id, 'master_specification_version_number', v_source_version_number)), now(), v_actor_id) RETURNING * INTO v_requirement;
  INSERT INTO public.customer_requirement_revisions (requirement_id, revision_number, change_summary, requirement_data, status, created_by) VALUES (v_requirement.id, 1, 'Initial source-bound Sales requirement', v_requirement.requirement_data, 'submitted', v_actor_id);
  INSERT INTO public.activity_log (actor_user_id, module_key, entity_type, entity_id, action, summary, after_data) VALUES (v_actor_id, 'sales', 'customer_requirement', v_requirement.id, 'source_bound_created', 'Created source-bound customer requirement.', jsonb_build_object('opportunity_id', p_opportunity_id, 'customer_id', p_customer_id, 'master_specification_id', v_source_specification_id, 'master_specification_version_id', p_master_specification_version_id, 'master_specification_version_number', v_source_version_number, 'request_key', p_request_key, 'revision_number', 1));
  INSERT INTO public.sales_requirement_creation_requests (request_key, requested_by, opportunity_id, customer_id, master_specification_version_id, payload_hash, payload_canonical, requirement_id) VALUES (p_request_key, v_actor_id, p_opportunity_id, p_customer_id, p_master_specification_version_id, v_payload_hash, v_payload_canonical, v_requirement.id);
  RETURN v_requirement.id;
END;
$$;
```

## Full fail-closed facade

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const salesBoundRequirementSchema = z.object({
  opportunityId: z.string().uuid(), customerId: z.string().uuid(), masterSpecificationVersionId: z.string().uuid(),
  title: z.string().trim().min(3).max(240), customerReference: z.string().trim().max(160).nullable(),
  summary: z.string().trim().max(8000).nullable(), requestKey: z.string().uuid(),
});

export const createSalesBoundCustomerRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => salesBoundRequirementSchema.parse(data))
  .handler(async ({ data, context }) => {
    void data; void context;
    throw new Error("Source-bound requirement creation is unavailable until the protected database contract passes isolated acceptance.");
  });
```
