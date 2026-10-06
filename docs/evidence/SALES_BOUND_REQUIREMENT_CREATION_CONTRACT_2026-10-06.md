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

RLS additionally carries an explicit authenticated deny-all policy. This is defense in depth: direct receipt access remains denied even if a future table grant is introduced accidentally.

## Pending direct-write decision

This compatibility group retires the legacy `createCustomerRequirement` facade with an explicit error (no fallback) and prepares a protected `approve_requirement_baseline(...)` routine for the live baseline approval flow. Only the accepted migration revokes direct authenticated requirement/revision mutations and removes their broad Sales write policies.

**Acceptance blocker:** all protected creation, external intake, feasibility, and baseline compatibility routines must pass isolated caller-authenticated acceptance together before any revocation can be applied. Existing manual/approved rows, including the 24v tracker, are retained exactly as-is; no source is inferred or backfilled.

## Required isolated acceptance

- Caller-authenticated Sales allowance and non-admin/RLS denial.
- Opportunity/customer mismatch and unavailable, stale, or cross-source Master-version denial.
- Exact retry returns the original ID; payload/caller/source change under the same key rejects.
- Exact replay still returns the historical ID after the Master Specification advances; a fresh key with the earlier version fails.
- Concurrent same-key calls converge to one requirement, revision, audit, and receipt.
- A concurrent source-pair/current-version mutation blocks behind the first-create locks and cannot change the verified provenance before that create commits.
- Forced audit failure rolls back the header, revision, and receipt.
- Compatibility migration removes or redirects the legacy write path, then proves direct requirement/revision writes fail while all existing manual and approved records remain intact.
- Protected baseline approval remains supported after revocation: it snapshots the current requirement/commercial state, updates the requirement status, and audits as one transaction.
- Sales-bound creation uses `next_business_number('customer_requirement', NULL, NULL)`, matching the installed `customer_requirements_assign_business_code` trigger. The supplied nonblank number prevents a second trigger allocation; Sales and client intake share the existing serialized customer-requirement counter.

## Full pending SQL

The following is copied verbatim from `supabase/pending/20261006_sales_bound_requirement_creation.sql` at this source revision. It is pending and unapplied.

```sql
-- SOURCE-ONLY PROPOSAL. Do not apply until isolated caller-authenticated acceptance
-- demonstrates Sales authorization, source binding, exact replay, concurrency, audit
-- rollback, direct-write denial, compatibility preservation, and non-admin RLS. This introduces no automatic
-- feasibility, approval, conversion, publication, or mutation of existing requirements.
--
-- New pending DDL: an internal Sales-only receipt table is necessary because no existing
-- receipt can bind the immutable Master Specification version to this write channel.
CREATE TABLE public.sales_requirement_creation_requests (
  request_key uuid PRIMARY KEY,
  requested_by uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  master_specification_version_id uuid NOT NULL REFERENCES public.master_specification_versions(id) ON DELETE RESTRICT,
  payload_hash text NOT NULL,
  payload_canonical jsonb NOT NULL,
  requirement_id uuid NOT NULL UNIQUE REFERENCES public.customer_requirements(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(payload_hash)) > 0),
  CHECK (jsonb_typeof(payload_canonical) = 'object')
);
GRANT ALL ON TABLE public.sales_requirement_creation_requests TO service_role;
REVOKE ALL ON TABLE public.sales_requirement_creation_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.sales_requirement_creation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct receipt access"
  ON public.sales_requirement_creation_requests
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.sales_requirement_creation_canonical_payload(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_master_specification_version_id uuid,
  p_title text,
  p_customer_reference text,
  p_summary text
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'opportunity_id', p_opportunity_id,
    'customer_id', p_customer_id,
    'master_specification_version_id', p_master_specification_version_id,
    'title', btrim(p_title),
    'customer_reference', nullif(btrim(coalesce(p_customer_reference, '')), ''),
    'summary', nullif(btrim(coalesce(p_summary, '')), '')
  )
$$;

CREATE OR REPLACE FUNCTION public.sales_requirement_creation_payload_hash(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_master_specification_version_id uuid,
  p_title text,
  p_customer_reference text,
  p_summary text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5(public.sales_requirement_creation_canonical_payload(
    p_opportunity_id, p_customer_id, p_master_specification_version_id,
    p_title, p_customer_reference, p_summary
  )::text)
$$;

CREATE OR REPLACE FUNCTION public.create_sales_bound_customer_requirement(
  p_opportunity_id uuid,
  p_customer_id uuid,
  p_master_specification_version_id uuid,
  p_title text,
  p_customer_reference text,
  p_summary text,
  p_request_key uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_request_key IS NULL
     OR p_opportunity_id IS NULL
     OR p_customer_id IS NULL
     OR p_master_specification_version_id IS NULL
     OR NULLIF(btrim(p_title), '') IS NULL
     OR char_length(btrim(p_title)) > 240
     OR (p_customer_reference IS NOT NULL AND char_length(btrim(p_customer_reference)) > 160)
     OR (p_summary IS NOT NULL AND char_length(btrim(p_summary)) > 8000) THEN
    RAISE EXCEPTION 'A request key, bound sources, and valid requirement fields are required';
  END IF;

  v_payload_canonical := public.sales_requirement_creation_canonical_payload(
    p_opportunity_id, p_customer_id, p_master_specification_version_id,
    p_title, p_customer_reference, p_summary
  );
  v_payload_hash := public.sales_requirement_creation_payload_hash(
    p_opportunity_id, p_customer_id, p_master_specification_version_id,
    p_title, p_customer_reference, p_summary
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  -- Global lock order for every future contract touching these resources:
  -- advisory(request_key) -> receipt row -> sales opportunity -> Master Specification.
  -- The controlled Master Specification save owns the trailing source order.
  SELECT * INTO v_prior
  FROM public.sales_requirement_creation_requests
  WHERE request_key = p_request_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_prior.requested_by = v_actor_id
       AND v_prior.opportunity_id = p_opportunity_id
       AND v_prior.customer_id = p_customer_id
       AND v_prior.master_specification_version_id = p_master_specification_version_id
       AND v_prior.payload_hash = v_payload_hash
       AND v_prior.payload_canonical = v_payload_canonical THEN
      RETURN v_prior.requirement_id;
    END IF;
    RAISE EXCEPTION 'Request key conflicts with a different caller or payload';
  END IF;

  -- First creation takes the same source-lock order as the controlled Master
  -- Specification save: opportunity, then specification. FOR UPDATE blocks a
  -- concurrent customer-pair/current-version mutation until this transaction
  -- commits. A historical exact receipt has already returned above and never
  -- requires its once-current version to remain current.
  PERFORM 1
  FROM public.sales_opportunities
  WHERE id = p_opportunity_id AND customer_id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity/customer source mismatch';
  END IF;

  SELECT specification.id, version.version_number
  INTO v_source_specification_id, v_source_version_number
  FROM public.master_specifications specification
  JOIN public.master_specification_versions version
    ON version.specification_id = specification.id
  WHERE version.id = p_master_specification_version_id
    AND specification.opportunity_id = p_opportunity_id
    AND specification.customer_id = p_customer_id
    AND version.version_number = specification.current_version
  FOR UPDATE OF specification;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master Specification version is unavailable for this opportunity and customer';
  END IF;

  INSERT INTO public.customer_requirements (
    requirement_number, opportunity_id, customer_id, title, status, current_revision,
    customer_reference, requirement_data, submitted_at, created_by
  ) VALUES (
    -- The established BEFORE INSERT trigger uses this exact entity and NULL scopes.
    -- Calling it here preserves one serialized counter for Sales and client intake,
    -- while the nonblank result prevents the trigger from allocating a second number.
    public.next_business_number('customer_requirement', NULL, NULL),
    p_opportunity_id, p_customer_id, btrim(p_title), 'submitted', 1,
    nullif(btrim(coalesce(p_customer_reference, '')), ''),
    jsonb_build_object(
      'summary', nullif(btrim(coalesce(p_summary, '')), ''),
      'source', jsonb_build_object(
        'opportunity_id', p_opportunity_id,
        'customer_id', p_customer_id,
        'master_specification_id', v_source_specification_id,
        'master_specification_version_id', p_master_specification_version_id,
        'master_specification_version_number', v_source_version_number
      )
    ),
    now(), v_actor_id
  ) RETURNING * INTO v_requirement;

  INSERT INTO public.customer_requirement_revisions (
    requirement_id, revision_number, change_summary, requirement_data, status, created_by
  ) VALUES (
    v_requirement.id, 1, 'Initial source-bound Sales requirement',
    v_requirement.requirement_data, 'submitted', v_actor_id
  );

  INSERT INTO public.activity_log (
    actor_user_id, module_key, entity_type, entity_id, action, summary, after_data
  ) VALUES (
    v_actor_id, 'sales', 'customer_requirement', v_requirement.id, 'source_bound_created',
    'Created source-bound customer requirement.',
    jsonb_build_object(
      'opportunity_id', p_opportunity_id,
      'customer_id', p_customer_id,
      'master_specification_id', v_source_specification_id,
      'master_specification_version_id', p_master_specification_version_id,
      'master_specification_version_number', v_source_version_number,
      'request_key', p_request_key,
      'revision_number', 1
    )
  );

  INSERT INTO public.sales_requirement_creation_requests (
    request_key, requested_by, opportunity_id, customer_id, master_specification_version_id,
    payload_hash, payload_canonical, requirement_id
  ) VALUES (
    p_request_key, v_actor_id, p_opportunity_id, p_customer_id,
    p_master_specification_version_id, v_payload_hash, v_payload_canonical, v_requirement.id
  );
  RETURN v_requirement.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sales_requirement_creation_canonical_payload(uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_requirement_creation_payload_hash(uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- COMPATIBILITY GROUP — apply only with 20261005_client_requirement_intake.sql and only
-- after isolated caller-authenticated acceptance. The controlled routines above and the
-- external intake routine remain SECURITY DEFINER entry points after authenticated table
-- writes are removed. The baseline workflow below preserves the one live Sales approval
-- operation that otherwise updates a requirement header.

CREATE OR REPLACE FUNCTION public.approve_requirement_baseline(
  p_requirement_id uuid,
  p_baseline_number text DEFAULT NULL
) RETURNS TABLE(baseline_id uuid, baseline_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_requirement public.customer_requirements%ROWTYPE;
  v_commercial public.sales_commercial_records%ROWTYPE;
  v_baseline public.requirement_baselines%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_permission(v_actor_id, 'sales.manage') THEN
    RAISE EXCEPTION 'Sales management permission is required';
  END IF;
  IF p_requirement_id IS NULL OR (p_baseline_number IS NOT NULL AND char_length(btrim(p_baseline_number)) > 64) THEN
    RAISE EXCEPTION 'A requirement and valid optional baseline number are required';
  END IF;

  SELECT * INTO v_requirement
  FROM public.customer_requirements
  WHERE id = p_requirement_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requirement not found'; END IF;
  IF v_requirement.status IN ('baselined', 'archived') THEN
    RAISE EXCEPTION 'Requirement is already baselined or archived';
  END IF;

  SELECT * INTO v_commercial
  FROM public.sales_commercial_records
  WHERE requirement_id = v_requirement.id AND status = 'customer_authorized'
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer commercial authorization is required before creating a baseline';
  END IF;

  INSERT INTO public.requirement_baselines (
    requirement_id, baseline_number, revision_number, requirement_snapshot,
    commercial_snapshot, approved_by
  ) VALUES (
    v_requirement.id, nullif(btrim(coalesce(p_baseline_number, '')), ''),
    v_requirement.current_revision, v_requirement.requirement_data,
    to_jsonb(v_commercial), v_actor_id
  ) RETURNING * INTO v_baseline;

  UPDATE public.customer_requirements
  SET status = 'baselined', approved_at = now()
  WHERE id = v_requirement.id;
  UPDATE public.sales_opportunities
  SET stage = 'approved', status = 'won'
  WHERE id = v_requirement.opportunity_id;
  INSERT INTO public.activity_log (
    actor_user_id, module_key, entity_type, entity_id, action, summary, after_data
  ) VALUES (
    v_actor_id, 'sales', 'requirement_baseline', v_baseline.id, 'created',
    'Created approved requirement baseline.',
    jsonb_build_object('requirement_id', v_requirement.id, 'revision_number', v_requirement.current_revision)
  );
  RETURN QUERY SELECT v_baseline.id, v_baseline.baseline_number;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_requirement_baseline(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_requirement_baseline(uuid, text) TO authenticated, service_role;

-- No direct authenticated header or revision mutations remain after the three protected
-- creation paths and baseline approval routine above are accepted. Existing manual and
-- approved rows are retained unchanged; this adds no source backfill for the 24v tracker.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_requirements FROM PUBLIC, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_requirement_revisions FROM PUBLIC, authenticated;
DROP POLICY IF EXISTS "Sales users manage requirements" ON public.customer_requirements;
DROP POLICY IF EXISTS "Sales users manage requirement revisions" ON public.customer_requirement_revisions;
```

## Full fail-closed facade

The following is copied verbatim from `src/lib/sales-bound-requirement.functions.ts`. It remains unavailable until the pending database contract has passed isolated acceptance; it has no legacy fallback.

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const salesBoundRequirementSchema = z.object({
  opportunityId: z.string().uuid(),
  customerId: z.string().uuid(),
  masterSpecificationVersionId: z.string().uuid(),
  title: z.string().trim().min(3).max(240),
  customerReference: z.string().trim().max(160).nullable(),
  summary: z.string().trim().max(8000).nullable(),
  requestKey: z.string().uuid(),
});

/** Disabled by the UI until the pending database contract completes isolated acceptance. */
export const createSalesBoundCustomerRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => salesBoundRequirementSchema.parse(data))
  .handler(async ({ data, context }) => {
    // The RPC is deliberately absent from generated database types until its pending SQL is accepted.
    // Keeping the facade fail-closed prevents a source-only contract from becoming callable early.
    void data;
    void context;
    throw new Error("Source-bound requirement creation is unavailable until the protected database contract passes isolated acceptance.");
  });
```

## Full executable concurrency harness

The following is copied verbatim from `supabase/pending/tests/sales_bound_requirement_creation_concurrency_acceptance.sh`. It is review-only and must run only against an authorized isolated database with an authenticated Sales caller, never a service-role caller.

```bash
#!/usr/bin/env bash
# ISOLATED ACCEPTANCE ONLY. Do not run against production and never use service-role impersonation.
# Required environment: DATABASE_URL, SALES_MANAGER_ID, OPPORTUNITY_ID, CUSTOMER_ID,
# MASTER_VERSION_ID, SPECIFICATION_ID, REQUEST_KEY, REQUEST_KEY_B, ADVANCE_EXPECTED_VERSION,
# ADVANCE_TITLE, ADVANCE_SUMMARY, ADVANCE_SPECIFICATION_DATA. The runner supplies a dedicated
# isolated tuple. It must use an authenticated Sales caller and never service-role impersonation.
set -euo pipefail

: "${DATABASE_URL:?}" "${SALES_MANAGER_ID:?}" "${OPPORTUNITY_ID:?}" "${CUSTOMER_ID:?}"
: "${MASTER_VERSION_ID:?}" "${SPECIFICATION_ID:?}" "${REQUEST_KEY:?}" "${REQUEST_KEY_B:?}" "${ADVANCE_EXPECTED_VERSION:?}"
: "${ADVANCE_TITLE:?}" "${ADVANCE_SUMMARY:?}" "${ADVANCE_SPECIFICATION_DATA:?}"

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

caller_prelude="SET LOCAL request.jwt.claim.sub = '${SALES_MANAGER_ID}'; SET LOCAL role = authenticated;"
create_call="SELECT public.create_sales_bound_customer_requirement('${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${MASTER_VERSION_ID}'::uuid, 'Concurrency acceptance requirement', 'LOCK-ACCEPT', 'Acceptance-only summary.', '${REQUEST_KEY}'::uuid);"

# Replay after Master version advance: the first committed write is created on an isolated source.
printf "BEGIN; %s %s COMMIT;" "$caller_prelude" "$create_call" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/created-id"
created_id="$(tail -n 3 "$tmp_dir/created-id" | head -n 1 | tr -d '[:space:]')"

# Advance via the existing caller-authenticated controlled save. This must make MASTER_VERSION_ID historical.
printf "BEGIN; %s SELECT * FROM public.save_master_specification_version('${SPECIFICATION_ID}'::uuid, '${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${ADVANCE_TITLE}', ${ADVANCE_EXPECTED_VERSION}, '${ADVANCE_SUMMARY}', '${ADVANCE_SPECIFICATION_DATA}'::jsonb); COMMIT;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null
printf "BEGIN; %s %s COMMIT;" "$caller_prelude" "$create_call" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/replayed-id"
replayed_id="$(tail -n 3 "$tmp_dir/replayed-id" | head -n 1 | tr -d '[:space:]')"
test "$created_id" = "$replayed_id" || { echo "Replay after Master version advance returned a different requirement" >&2; exit 1; }

# Changed-payload conflict must reject and leave the receipt result unchanged.
if printf "BEGIN; %s SELECT public.create_sales_bound_customer_requirement('${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${MASTER_VERSION_ID}'::uuid, 'Changed title', 'LOCK-ACCEPT', 'Acceptance-only summary.', '${REQUEST_KEY}'::uuid); ROLLBACK;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/conflict" 2>&1; then
  echo "Changed-payload conflict unexpectedly succeeded" >&2; exit 1
fi
grep -q "Request key conflicts with a different caller or payload" "$tmp_dir/conflict"

# Concurrent source update blocks: hold the same opportunity/specification locks in session A.
# This test performs no source mutation: B uses lock_timeout and only proves it cannot pass the lock.
printf "BEGIN; %s SELECT 1 FROM public.sales_opportunities WHERE id = '${OPPORTUNITY_ID}'::uuid FOR UPDATE; SELECT 1 FROM public.master_specifications WHERE opportunity_id = '${OPPORTUNITY_ID}'::uuid FOR UPDATE; SELECT pg_sleep(8); ROLLBACK;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/holder" 2>&1 &
holder_pid=$!
sleep 1

# Concurrent source update blocks: a source editor cannot update current_version while A holds the source locks.
printf "BEGIN; %s SET LOCAL lock_timeout = '5000ms'; SELECT pg_backend_pid(); UPDATE public.master_specifications SET current_version = current_version WHERE opportunity_id = '${OPPORTUNITY_ID}'::uuid; ROLLBACK;" "$caller_prelude" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/blocker" 2>&1 &
blocker_pid=$!
sleep 1
blocker_backend_pid="$(awk '/^[[:space:]]*[0-9]+[[:space:]]*$/ { gsub(/[[:space:]]/, ""); print; exit }' "$tmp_dir/blocker")"
test -n "$blocker_backend_pid" || { echo "Could not read the blocker backend PID" >&2; exit 1; }
if ! psql "$DATABASE_URL" -X -tAc "SELECT wait_event_type = 'Lock' FROM pg_stat_activity WHERE pid = ${blocker_backend_pid};" | grep -qx "t"; then
  echo "Concurrent source update did not expose the expected lock wait" >&2; exit 1
fi
if wait "$blocker_pid"; then
  echo "Concurrent source update blocks: expected lock timeout" >&2; exit 1
fi
grep -Eq "canceling statement due to lock timeout|Lock" "$tmp_dir/blocker"

wait "$holder_pid"

# Distinct request keys must allocate distinct nonblank business numbers without relying on a
# browser-callable numbering function. This also proves the protected insert does not cause a
# second trigger allocation when it supplies next_business_number itself.
second_key_call="SELECT public.create_sales_bound_customer_requirement('${OPPORTUNITY_ID}'::uuid, '${CUSTOMER_ID}'::uuid, '${MASTER_VERSION_ID}'::uuid, 'Concurrent number acceptance requirement', 'NUMBER-ACCEPT', 'Second acceptance-only summary.', '${REQUEST_KEY_B}'::uuid);"
printf "BEGIN; %s %s COMMIT;" "$caller_prelude" "$second_key_call" | psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$tmp_dir/second-id"
second_id="$(tail -n 3 "$tmp_dir/second-id" | head -n 1 | tr -d '[:space:]')"
test -n "$second_id" || { echo "Second request did not create a requirement" >&2; exit 1; }
numbers="$(psql "$DATABASE_URL" -X -Atc "SELECT requirement_number FROM public.customer_requirements WHERE id IN ('${created_id}'::uuid, '${second_id}'::uuid) ORDER BY id;")"
first_number="$(printf '%s\n' "$numbers" | sed -n '1p')"
second_number="$(printf '%s\n' "$numbers" | sed -n '2p')"
test -n "$first_number" && test -n "$second_number" && test "$first_number" != "$second_number" || { echo "Protected calls did not allocate two distinct nonblank requirement numbers" >&2; exit 1; }

echo "PASS: replay-after-version-advance, changed-payload conflict, concurrent source update blocking, and distinct protected business numbers"
```

## SQL acceptance case inventory

The following pending case inventory is copied verbatim from `supabase/pending/tests/sales_bound_requirement_creation_acceptance.sql`. It documents required database assertions; it has not been executed.

```sql
-- ISOLATED ACCEPTANCE ONLY. Source contract for the pending Sales-bound requirement proposal.
-- Use real caller-authenticated sessions and existing isolated records; never service-role impersonation.
-- Required variables: sales_manager_id, sales_manager_jwt, opportunity_id, customer_id,
-- master_specification_version_id, stale_master_specification_version_id, wrong_customer_id,
-- request_key. Every mutation case must ROLLBACK.
-- Execute sales_bound_requirement_creation_concurrency_acceptance.sh for the real
-- two-session replay-after-advance and source-lock cases; this psql file remains
-- intentionally single-session and never impersonates service_role.
\set ON_ERROR_STOP on

-- Preflight: only the protected routine may access receipts. Every direct table
-- privilege below must be false for PUBLIC, anon, and authenticated.
SELECT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'SELECT') AS no_public_receipt_read;
SELECT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'INSERT') AS no_public_receipt_insert;
SELECT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'SELECT') AS no_anon_receipt_read;
SELECT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'INSERT') AS no_anon_receipt_insert;
SELECT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'SELECT') AS no_authenticated_receipt_read;
SELECT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'INSERT') AS no_authenticated_receipt_insert;
SELECT has_function_privilege('authenticated', 'public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid)', 'EXECUTE') AS protected_create_callable;
SELECT has_function_privilege('authenticated', 'public.approve_requirement_baseline(uuid, text)', 'EXECUTE') AS protected_baseline_callable;
SELECT has_table_privilege('authenticated', 'public.customer_requirements', 'INSERT') AS no_authenticated_requirement_insert;
SELECT has_table_privilege('authenticated', 'public.customer_requirements', 'UPDATE') AS no_authenticated_requirement_update;
SELECT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'INSERT') AS no_authenticated_revision_insert;
SELECT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'UPDATE') AS no_authenticated_revision_update;

-- 1. Allowed caller: creates exactly one header, revision 1, audit, and receipt bound to
-- opportunity/customer/current Master Specification version and actor.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT public.create_sales_bound_customer_requirement(
  :'opportunity_id'::uuid, :'customer_id'::uuid, :'master_specification_version_id'::uuid,
  'Acceptance source-bound requirement', 'ACCEPT-REQ', 'Acceptance-only summary.', :'request_key'::uuid
);
ROLLBACK;

-- 2. Identical retry: two calls with the same request key and canonical payload return one ID;
-- counts remain one for header, revision 1, source_bound_created audit, and receipt.
BEGIN;
SET LOCAL request.jwt.claim.sub = :'sales_manager_id';
SET LOCAL role = authenticated;
SELECT public.create_sales_bound_customer_requirement(:'opportunity_id'::uuid, :'customer_id'::uuid, :'master_specification_version_id'::uuid, 'Retry exact payload', 'RETRY', 'Exact summary.', :'request_key'::uuid);
SELECT public.create_sales_bound_customer_requirement(:'opportunity_id'::uuid, :'customer_id'::uuid, :'master_specification_version_id'::uuid, 'Retry exact payload', 'RETRY', 'Exact summary.', :'request_key'::uuid);
ROLLBACK;

-- 3. Replay after Master version advance: commit an allowed creation, then use the existing
-- controlled Master Specification save path in a separate caller-authenticated transaction to
-- advance current_version. An exact retry with the original key/payload/version must return its
-- historical requirement ID; it must not revalidate the version as current or create another row.
-- Run this with a dedicated acceptance-only source tuple and roll back/clean it outside this script.

-- 4. Changed title, summary, customer, version, or actor with the same request key fails before new rows.
-- 5. Wrong opportunity/customer pair and stale/nonmatching Master version fail before header/revision/audit/receipt.
-- 6. Two concurrent authenticated sessions with the same caller/key/payload serialize on the advisory lock,
-- both return the same requirement ID, and commit one header/revision/audit/receipt only.
-- 7. Concurrent source update: session A calls this routine for a fresh key and pauses after its
-- opportunity/specification FOR UPDATE locks are acquired; session B, authenticated as an authorized
-- source editor, attempts either sales_opportunities.customer_id or master_specifications.current_version
-- update through its controlled source mutation. B must block until A commits/rolls back. If A commits,
-- its persisted receipt/audit source tuple must equal the locked tuple; B then proceeds and cannot alter
-- the already-persisted provenance. If A rolls back, B may proceed and A leaves no receipt/header/revision/audit.
-- 8. Force the source_bound_created audit insert to fail in isolated infrastructure; header, revision,
-- and receipt roll back together. Do not simulate with a service role.
-- 9. After compatible legacy redirect/removal is accepted, direct authenticated INSERT/UPDATE/DELETE on
-- customer_requirements and customer_requirement_revisions must fail, and the legacy multi-call facade
-- must not remain callable. Existing manual/approved rows, including the 24v tracker, remain unchanged.
-- 10. Baseline compatibility: with a caller-authenticated Sales manager and a separately
-- authorized commercial record, approve_requirement_baseline locks the requirement, writes one
-- baseline snapshot, updates the requirement to baselined, updates the linked opportunity, and
-- audits atomically. Force the audit insert to fail and prove all earlier baseline/header changes roll back.
-- Direct authenticated UPDATE on customer_requirements must fail outside this routine.
-- 11. Numbering compatibility: the protected Sales creation and external intake each omit an
-- externally chosen requirement number. Verify the trigger/function assigns nonblank unique numbers
-- from the same customer_requirement numbering rule; concurrent different request keys must produce
-- distinct values without a second allocation per insert.
```
