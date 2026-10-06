# Sales-Bound Requirement Creation — Full Pending Contract Export (2026-10-06 UTC)

**Status:** source-only and disabled. No migration, grant, identity, fixture, existing record, generation setting, or publication is changed by this export. No database query or acceptance execution occurred in this update.

## What changed in this review revision

The prior pending `approve_requirement_baseline(...)` compatibility routine has been removed rather than expanded on unsupported assumptions. The applied feasibility schema has no immutable requirement-revision binding or applicability model, so it cannot prove a terminal verdict belongs to the revision that would be baselined. The Sales façade and visible approval action now fail closed.

The prior psql/JWT-GUC harness is now explicitly **structural-only**. It is not evidence of caller authentication, JWT verification, transport, RLS, grants, non-admin behavior, concurrency, or rollback. A separate real-caller transport acceptance specification refuses unapproved/original targets, uses no JWT GUCs or service role, and requires two independent authenticated callers.

## Established facts reused without invention

- `requirement_baselines_assign_business_code` is the existing server-side number trigger. It calls `next_business_number('baseline', NULL, NULL)` only when the inserted baseline number is blank.
- `customer_requirements.current_revision` and the `customer_requirement_revisions` uniqueness rule identify the current revision, but `requirement_feasibility_reviews` contains no requirement-revision reference and no applicability field.
- `requirement_baselines` permits one row per requirement/revision today, but it has no replay receipt.
- `project_feedback_revisions` read policy requires its joined baseline to remain `active`; the existing direct handover status mutation is therefore a separate state-transition review item, not something this source-only proposal changes.
- Existing manual/approved records, including the 24v tracker, stay untouched. No source metadata is inferred or backfilled.

## Pending Sales-bound creation behavior

1. Derive the actor only from `auth.uid()` and require `sales.manage`.
2. Canonicalize the request; lock/read the receipt before current-source validation. Exact historical retries return their original requirement ID after a Master Specification advances. Changed caller, source, or payload rejects.
3. On first creation only, lock the opportunity and Master Specification with `FOR UPDATE`, then prove the supplied version is current for the locked opportunity/customer pair.
4. Create requirement, immutable revision 1, audit event, and receipt atomically. Any error rolls back all inserts.
5. Keep direct receipt access revoked from `PUBLIC`, `anon`, and `authenticated`.

## Baseline approval remains deliberately unavailable

Before a future protected baseline routine can exist, a separate reviewed contract must provide and accept all of the following:

- immutable requirement-revision linkage plus explicit applicability on each feasibility decision;
- exact expected revision validation and locked retrieval of that immutable revision;
- validation of applicable terminal decisions without treating stale/unpinned verdicts as ready;
- customer authorization locked at update strength so status/snapshot changes cannot race approval;
- server-only baseline number issuance through the existing trigger (no caller number parameter);
- a stable request key and receipt with exact replay vs. changed-payload rejection;
- protected direct-write denial for `requirement_baselines`, including review of its downstream status transitions and feedback-visibility dependency;
- real caller-authenticated isolated acceptance for allow/deny, rollback, replay, concurrency, and non-admin RLS.

No requirement status, opportunity status, handover state, or baseline row is changed while this dependency is unresolved.

## Full pending SQL

Copied verbatim from `supabase/pending/20261006_sales_bound_requirement_creation.sql`.

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

-- COMPATIBILITY GROUP — source-only and deliberately fail-closed. The applied
-- feasibility table has no immutable requirement-revision reference, so it cannot
-- prove that terminal feasibility decisions belong to the revision being approved.
-- Do not create a baseline approval RPC, receipt, or direct-write revocation until
-- a separately reviewed revision-bound feasibility contract exists and passes real
-- caller-authenticated isolated acceptance. This proposal preserves legacy/manual
-- records exactly and performs no source backfill for the existing 24v tracker.
--
-- The existing `requirement_baselines_assign_business_code` trigger remains the
-- authoritative server-side baseline-number issuer (`next_business_number('baseline', NULL, NULL)`).
-- Future protected approval must not accept a caller baseline number. It must lock
-- the requirement, the exact immutable revision, every applicable feasibility
-- decision, and the authorized commercial record with UPDATE-strength locks; bind
-- a stable request key to a replay receipt; reject changed replay payloads; snapshot
-- only the locked source state; and preserve active-baseline downstream visibility.
--
-- Required separate dependency: a reviewed schema/contract that records immutable
-- requirement-revision linkage plus applicability on feasibility decisions. Without
-- it, current `requirement_feasibility_reviews` rows are unsupported/unverified and
-- cannot gate baseline approval. The existing customer requirement status enum is
-- not treated as proof of that missing linkage.
```

## Full disabled Sales façade slice

Copied verbatim from `src/lib/sales.functions.ts`.

```ts
const baselineSchema = z.object({ requirementId: z.string().uuid() });
const portalSchema = z.object({ customerId: z.string().uuid(), contactId: z.string().uuid().nullable(), label: z.string().trim().min(2).max(160), expiresAt: z.string().min(10).nullable() });
const handoverSchema = z.object({ baselineId: z.string().uuid(), handoverNotes: nullable(4000) });

async function requireSales(sb: any, userId: string) { const { data, error } = await sb.rpc("has_permission", { _user_id: userId, _permission_key: "sales.manage" }); if (error || !data) throw new Error("You do not have permission to manage sales records."); }
async function logSalesActivity(sb: any, userId: string, entityType: string, entityId: string, action: string, summary: string) { const { error } = await sb.from("activity_log").insert({ actor_user_id: userId, module_key: "sales", entity_type: entityType, entity_id: entityId, action, summary }); if (error) throw new Error(error.message); }

export const createCustomer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => customerSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const normalizedName = data.legalName.replace(/\s+/g, " ").trim(); const { data: nameMatches, error: nameError } = await sb.from("customers").select("id,customer_code,legal_name,primary_email,primary_phone").neq("status", "archived").ilike("legal_name", normalizedName).limit(5); const { data: emailMatches, error: emailError } = data.primaryEmail ? await sb.from("customers").select("id,customer_code,legal_name,primary_email,primary_phone").neq("status", "archived").eq("primary_email", data.primaryEmail).limit(5) : { data: [], error: null }; const { data: phoneMatches, error: phoneError } = data.primaryPhone ? await sb.from("customers").select("id,customer_code,legal_name,primary_email,primary_phone").neq("status", "archived").eq("primary_phone", data.primaryPhone).limit(5) : { data: [], error: null }; if (nameError || emailError || phoneError) throw new Error("Could not check existing customers."); const matches = [...new Map([...(nameMatches ?? []), ...(emailMatches ?? []), ...(phoneMatches ?? [])].map((item: any) => [item.id, item])).values()]; if (matches.length && !data.createAnywayReason) throw new Error(`Possible existing customer: ${(matches ?? []).map((item: any) => `${item.customer_code} — ${item.legal_name}`).join("; ")}. Use the existing customer or confirm why a new record is needed.`); const { data: customer, error } = await sb.from("customers").insert({ legal_name: normalizedName, display_name: data.displayName, customer_type: data.customerType, industry: data.industry, primary_email: data.primaryEmail, primary_phone: data.primaryPhone, account_owner_user_id: data.accountOwnerUserId, created_by: context.userId }).select("id,customer_code").single(); if (error || !customer) throw new Error(error?.message ?? "Could not create customer."); await logSalesActivity(sb, context.userId, "customer", customer.id, "created", `Created customer: ${customer.customer_code} — ${normalizedName}`); if (data.createAnywayReason) await logSalesActivity(sb, context.userId, "customer", customer.id, "duplicate_override", data.createAnywayReason); return { id: customer.id, customerCode: customer.customer_code }; });
export const createCustomerContact = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => contactSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: contact, error } = await sb.from("customer_contacts").insert({ customer_id: data.customerId, full_name: data.fullName, job_title: data.jobTitle, email: data.email, phone: data.phone, mobile: data.mobile, is_primary: data.isPrimary, created_by: context.userId }).select("id").single(); if (error || !contact) throw new Error(error?.message ?? "Could not create customer contact."); await logSalesActivity(sb, context.userId, "customer_contact", contact.id, "created", `Created customer contact: ${data.fullName}`); return { id: contact.id }; });
export const createSalesEnquiry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => enquirySchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: enquiry, error } = await sb.from("sales_enquiries").insert({ enquiry_number: data.enquiryNumber, customer_id: data.customerId, contact_id: data.contactId, source: data.source, enquiry_date: data.enquiryDate, requirement_summary: data.requirementSummary, application: data.application, product_type: data.productType, estimated_volume: data.estimatedVolume, expected_timeline: data.expectedTimeline, priority: data.priority, sales_owner_user_id: data.salesOwnerUserId, next_action: data.nextAction, next_action_date: data.nextActionDate, created_by: context.userId }).select("id,enquiry_number").single(); if (error || !enquiry) throw new Error(error?.message ?? "Could not create enquiry."); await logSalesActivity(sb, context.userId, "sales_enquiry", enquiry.id, "created", `Created enquiry: ${enquiry.enquiry_number ?? "auto-numbered"}`); return { id: enquiry.id, enquiryNumber: enquiry.enquiry_number }; });
export const createSalesOpportunity = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => opportunitySchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: opportunity, error } = await sb.from("sales_opportunities").insert({ opportunity_number: data.opportunityNumber, customer_id: data.customerId, primary_contact_id: data.contactId, enquiry_id: data.enquiryId, name: data.name, application: data.application, product_type: data.productType, primary_sales_owner_user_id: data.primarySalesOwnerUserId, nda_required: data.ndaRequired, estimated_volume: data.estimatedVolume, target_timeline: data.targetTimeline, priority: data.priority, next_action: data.nextAction, next_action_date: data.nextActionDate, created_by: context.userId }).select("id,opportunity_number").single(); if (error || !opportunity) throw new Error(error?.message ?? "Could not create opportunity."); await logSalesActivity(sb, context.userId, "sales_opportunity", opportunity.id, "created", `Created opportunity: ${data.name}`); return { id: opportunity.id, opportunityNumber: opportunity.opportunity_number }; });
export const saveNdaRecord = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => ndaSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const signedAt = data.status === "signed" ? new Date().toISOString() : null; const { data: record, error } = await sb.from("sales_nda_records").upsert({ opportunity_id: data.opportunityId, status: data.status, signed_by_name: data.signedByName, signed_by_email: data.signedByEmail, signed_at: signedAt, expiry_date: data.expiryDate, notes: data.notes, created_by: context.userId }, { onConflict: "opportunity_id" }).select("id").single(); if (error || !record) throw new Error(error?.message ?? "Could not save the NDA record."); await sb.from("sales_opportunities").update({ stage: data.status === "signed" || data.status === "not_required" ? "requirement_pending" : "nda_pending" }).eq("id", data.opportunityId); await logSalesActivity(sb, context.userId, "sales_nda_record", record.id, "saved", `Updated NDA status: ${data.status}`); return { id: record.id }; });
/**
 * Intentionally unavailable: the accepted compatibility migration removes this
 * legacy multi-call path instead of redirecting it to an unaccepted RPC. New
 * requirement creation stays exclusively behind createSalesBoundCustomerRequirement.
 */
export const createCustomerRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(() => {
    throw new Error("Legacy customer requirement creation is retired. Use the protected source-bound requirement flow after database acceptance.");
  });
export const assignFeasibilityReview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => feasibilityAssignmentSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: reviewId, error } = await sb.rpc("assign_requirement_feasibility_review", { p_requirement_id: data.requirementId, p_department_id: data.departmentId, p_reviewer_user_id: data.reviewerUserId }); if (error || typeof reviewId !== "string") throw new Error(error?.message ?? "Could not assign feasibility review."); return { id: reviewId }; });
export const saveCommercialRecord = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => commercialSchema.parse(data)).handler(async ({ data, context }) => { const sb = context.supabase as any; await requireSales(sb, context.userId); const { data: record, error } = await sb.from("sales_commercial_records").upsert({ requirement_id: data.requirementId, quotation_reference: data.quotationReference, currency: data.currency, quoted_amount: data.quotedAmount, status: data.status, authorization_reference: data.authorizationReference, customer_authorized_at: data.status === "customer_authorized" ? new Date().toISOString() : null, notes: data.notes, created_by: context.userId }, { onConflict: "requirement_id" }).select("id").single(); if (error || !record) throw new Error(error?.message ?? "Could not save commercial record."); await logSalesActivity(sb, context.userId, "sales_commercial_record", record.id, "saved", `Commercial status: ${data.status}`); return { id: record.id }; });
/**
 * Deliberately fail-closed: the applied feasibility table cannot bind a terminal
 * verdict to an immutable requirement revision, and no replay-safe baseline
 * receipt exists. A baseline must not be created until that separate contract
 * is accepted through real caller-authenticated isolated evidence.
 */
export const createRequirementBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => baselineSchema.parse(data))
  .handler(async ({ data, context }) => {
    void data;
    void context;
    throw new Error("Baseline approval is unavailable until revision-bound feasibility and replay-safe baseline contracts pass isolated caller-authenticated acceptance.");
  });
```

## Full structural-only source check

Copied verbatim from `supabase/pending/tests/sales_bound_requirement_creation_acceptance.sql`.

```sql
-- STRUCTURAL-ONLY SOURCE CHECK. This file is not caller-authenticated database
-- acceptance. SET LOCAL request.jwt.claim.sub can only model function branch shape
-- from a privileged psql connection; it cannot prove JWT verification, transport,
-- RLS, grants, or non-admin caller behavior. Do not run it as evidence of acceptance.
--
-- Real caller transport acceptance is specified in
-- sales_bound_requirement_creation_caller_transport_acceptance.sh and must use two
-- independently authenticated non-service callers against an explicitly approved
-- isolated target. No target is selected by this source file.
\set ON_ERROR_STOP on

-- This preflight is structural only: all values must be false except the protected
-- function execute privilege. A real caller transport runner repeats these checks
-- through authenticated application transport and asserts the returned booleans.
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'SELECT') AS no_public_receipt_read;
SELECT NOT has_table_privilege('PUBLIC', 'public.sales_requirement_creation_requests', 'INSERT') AS no_public_receipt_insert;
SELECT NOT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'SELECT') AS no_anon_receipt_read;
SELECT NOT has_table_privilege('anon', 'public.sales_requirement_creation_requests', 'INSERT') AS no_anon_receipt_insert;
SELECT NOT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'SELECT') AS no_authenticated_receipt_read;
SELECT NOT has_table_privilege('authenticated', 'public.sales_requirement_creation_requests', 'INSERT') AS no_authenticated_receipt_insert;
SELECT has_function_privilege('authenticated', 'public.create_sales_bound_customer_requirement(uuid, uuid, uuid, text, text, text, uuid)', 'EXECUTE') AS protected_create_callable;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirements', 'INSERT') AS no_authenticated_requirement_insert;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirements', 'UPDATE') AS no_authenticated_requirement_update;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'INSERT') AS no_authenticated_revision_insert;
SELECT NOT has_table_privilege('authenticated', 'public.customer_requirement_revisions', 'UPDATE') AS no_authenticated_revision_update;

-- No baseline approval privilege or direct baseline-write assertion appears here:
-- this revision deliberately exports no baseline RPC while revision-bound feasibility
-- and replay requirements remain unsupported/unverified.

-- Required executable assertions in the real caller transport runner:
-- 1. approved isolated target refusal before any request is sent;
-- 2. real authenticated Sales creation produces exactly one requirement, revision 1,
--    source_bound_created audit, and receipt; all are rolled back in an audit-failure case;
-- 3. identical retry returns the same ID and exact counts stay one;
-- 4. changed title, summary, customer, version, or caller under the same key rejects;
-- 5. an exact replay after controlled Master-version advance returns the historical ID,
--    while a fresh key using the now-stale Master version rejects;
-- 6. two real authenticated sessions with one key converge to one persisted result;
-- 7. a protected create holds its source locks while a protected controlled source update
--    blocks, then resolves without changing the first create's persisted provenance;
-- 8. direct receipt/requirement/revision writes are denied to each real caller.
```

## Full real caller-transport acceptance specification

Copied verbatim from `supabase/pending/tests/sales_bound_requirement_creation_caller_transport_acceptance.sh`.

```bash
#!/usr/bin/env bash
# REAL CALLER-TRANSPORT ACCEPTANCE SPECIFICATION — intentionally non-executable until
# an approved isolated target and two independently authenticated non-service callers
# are supplied. This script refuses every unspecified/original target; it never sets
# request.jwt.claim.* and never connects with a service-role credential.
set -euo pipefail

: "${ISOLATED_TARGET_NAME:?Name the approved isolated target}"
: "${APPROVED_ISOLATED_TARGET_NAME:?Expected approved isolated target name}"
: "${SALES_CALLER_TRANSPORT:?Executable that sends one authenticated Sales RPC call}"
: "${SOURCE_EDITOR_TRANSPORT:?Executable that sends one authenticated controlled source-save call}"
: "${OPPORTUNITY_ID:?}" "${CUSTOMER_ID:?}" "${MASTER_VERSION_ID:?}" "${SPECIFICATION_ID:?}"
: "${REQUEST_KEY:?}" "${REQUEST_KEY_B:?}" "${EXPECTED_VERSION:?}"

if [[ "$ISOLATED_TARGET_NAME" != "$APPROVED_ISOLATED_TARGET_NAME" ]]; then
  echo "Refusing unapproved isolated target" >&2
  exit 64
fi
if [[ "${ORIGINAL_TARGET_NAME:-}" == "$ISOLATED_TARGET_NAME" ]]; then
  echo "Refusing original target" >&2
  exit 64
fi

# Transport wrappers must take JSON on stdin, return JSON on stdout, and use their
# caller's own authenticated application/session transport. They must not interpolate
# SQL, set JWT GUCs, use database superuser credentials, or use service_role.
call_sales() { "$SALES_CALLER_TRANSPORT"; }
call_editor() { "$SOURCE_EDITOR_TRANSPORT"; }

create_payload() {
  local key="$1" version="$2" title="$3"
  jq -cn --arg opportunityId "$OPPORTUNITY_ID" --arg customerId "$CUSTOMER_ID" \
    --arg masterSpecificationVersionId "$version" --arg requestKey "$key" --arg title "$title" \
    '{opportunityId:$opportunityId,customerId:$customerId,masterSpecificationVersionId:$masterSpecificationVersionId,requestKey:$requestKey,title:$title,customerReference:"TRANSPORT-ACCEPT",summary:"Isolated acceptance only."}'
}

first="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
first_id="$(jq -er '.id' <<<"$first")"
retry="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
test "$first_id" = "$(jq -er '.id' <<<"$retry")"

# Changed payload must fail; the wrapper's nonzero status is asserted without SQL text.
if create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Changed title" | call_sales >/dev/null 2>&1; then
  echo "Changed-payload replay unexpectedly succeeded" >&2; exit 1
fi

# The controlled editor advances the source with the current expected version.
# A fresh key intentionally reuses the historical MASTER_VERSION_ID and must fail.
jq -cn --arg specificationId "$SPECIFICATION_ID" --arg opportunityId "$OPPORTUNITY_ID" \
  --arg customerId "$CUSTOMER_ID" --argjson expectedVersion "$EXPECTED_VERSION" \
  '{specificationId:$specificationId,opportunityId:$opportunityId,customerId:$customerId,expectedVersion:$expectedVersion}' | call_editor >/dev/null
replay="$(create_payload "$REQUEST_KEY" "$MASTER_VERSION_ID" "Transport acceptance requirement" | call_sales)"
test "$first_id" = "$(jq -er '.id' <<<"$replay")"
if create_payload "$REQUEST_KEY_B" "$MASTER_VERSION_ID" "Fresh stale version" | call_sales >/dev/null 2>&1; then
  echo "Fresh stale-version creation unexpectedly succeeded" >&2; exit 1
fi

# The approved runner must additionally perform exact count/rollback assertions and
# overlap two wrapper invocations: protected create first, protected source update
# second. Capture timestamps plus returned IDs and prove the update waits for the
# create instead of reproducing locks with direct SQL.
echo "MANUAL RUNNER STEP REQUIRED: assert audited counts, forced-audit rollback, and protected-create/source-update overlap through caller transport."
```

## Retired structural concurrency harness

Copied verbatim from `supabase/pending/tests/sales_bound_requirement_creation_concurrency_acceptance.sh`.

```bash
#!/usr/bin/env bash
# RETIRED STRUCTURAL HARNESS. Direct psql/JWT-GUC simulation cannot demonstrate real
# authenticated caller transport, and direct SQL locks cannot prove protected routine
# behavior. Use sales_bound_requirement_creation_caller_transport_acceptance.sh only
# after an approved isolated caller-transport runner supplies exact count, rollback,
# concurrency, and source-lock assertions.
set -euo pipefail
echo "Refusing structural simulation. Run the approved real caller-transport harness instead." >&2
exit 64
```

## Evidence boundary

The source tests below prove only that the exported source carries the stated fail-closed boundaries and acceptance specification. They do not execute SQL or establish any database, transport, lock, rollback, or caller-RLS evidence. That evidence remains pending an approved isolated target and authenticated caller transport.
