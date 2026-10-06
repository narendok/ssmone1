import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clientRequirementIntakeSchema, clientRequirementRequestKey, clientRequirementState, controlledRequirementAvailability, feasibilityResponseSchema, mayExposeClientRequirement, mayRecordFeasibility, protectedIntakeAvailability } from "./client-requirement-intake";

const pendingSql = readFileSync("supabase/pending/20261005_client_requirement_intake.sql", "utf8");
const acceptanceSql = readFileSync("supabase/pending/tests/client_requirement_intake_acceptance.sql", "utf8");
const salesBoundSql = readFileSync("supabase/pending/20261006_sales_bound_requirement_creation.sql", "utf8");
const salesBoundAcceptanceSql = readFileSync("supabase/pending/tests/sales_bound_requirement_creation_acceptance.sql", "utf8");
const salesBoundConcurrencyHarness = readFileSync("supabase/pending/tests/sales_bound_requirement_creation_concurrency_acceptance.sh", "utf8");

describe("client requirement intake contract", () => {
  it("requires bounded immutable submission content", () => {
    expect(clientRequirementIntakeSchema.safeParse({ opportunityId: "bad", customerId: "bad", requestKey: "bad", title: "", description: "short", customerReference: null }).success).toBe(false);
    expect(clientRequirementIntakeSchema.parse({ opportunityId: "b0c80d22-1007-4a60-b8cf-9c20a6c4f1a8", customerId: "dfd5f3f8-0caf-46cb-bf16-436a1c063650", requestKey: "9ce5a383-9ebf-430e-9bba-2e550c20fe3e", title: "Interface requirement", description: "The submitted requirement remains immutable after receipt.", customerReference: "OEM-REQ-7" })).toMatchObject({ title: "Interface requirement" });
  });

  it("treats expired and revoked portal access as unavailable", () => {
    expect(clientRequirementState({ isActive: true, revokedAt: null, expiresAt: "2026-10-05T18:00:00.000Z" }, new Date("2026-10-05T18:01:00.000Z"))).toBe("EXPIRED");
    expect(clientRequirementState({ isActive: false, revokedAt: null, expiresAt: null })).toBe("REVOKED");
    expect(clientRequirementState({ isActive: true, revokedAt: null, expiresAt: null })).toBe("ACTIVE");
  });

  it("permits only the active assigned engineering reviewer to submit an open response", () => {
    const assigned = { assignedTo: "reviewer", actorId: "reviewer", isEngineeringManager: true, isActiveDepartmentMember: true, status: "in_review" } as const;
    expect(mayRecordFeasibility(assigned)).toBe(true);
    expect(mayRecordFeasibility({ ...assigned, actorId: "manager" })).toBe(false);
    expect(mayRecordFeasibility({ ...assigned, isEngineeringManager: false })).toBe(false);
    expect(mayRecordFeasibility({ ...assigned, isActiveDepartmentMember: false })).toBe(false);
    expect(mayRecordFeasibility({ ...assigned, assignedTo: null })).toBe(false);
    expect(mayRecordFeasibility({ ...assigned, status: null })).toBe(false);
    expect(mayRecordFeasibility({ ...assigned, status: "feasible" })).toBe(false);
  });

  it("requires a concrete immutable feasibility response and explicit verdict", () => {
    expect(feasibilityResponseSchema.safeParse({ reviewId: "bad", verdict: "FEASIBLE", findings: "Looks good", assumptions: null, risks: null }).success).toBe(false);
    expect(feasibilityResponseSchema.parse({ reviewId: "b0c80d22-1007-4a60-b8cf-9c20a6c4f1a8", verdict: "feasible_with_conditions", findings: "CAN termination is required.", assumptions: null, risks: null }).verdict).toBe("feasible_with_conditions");
  });

  it("requires active, unrevoked, explicitly scoped client access", () => {
    const access = { isActive: true, revokedAt: null, expiresAt: "2026-10-06T19:00:00.000Z", accessScope: { opportunityIds: ["opportunity"], customerIds: ["customer"] }, opportunityId: "opportunity", customerId: "customer" };
    expect(mayExposeClientRequirement(access, new Date("2026-10-06T18:00:00.000Z"))).toBe(true);
    expect(mayExposeClientRequirement({ ...access, accessScope: { opportunityIds: ["other"], customerIds: ["customer"] } }, new Date("2026-10-06T18:00:00.000Z"))).toBe(false);
    expect(mayExposeClientRequirement({ ...access, revokedAt: "2026-10-06T17:00:00.000Z" }, new Date("2026-10-06T18:00:00.000Z"))).toBe(false);
  });

  it("keeps protected mutations unavailable before database acceptance", () => {
    expect(protectedIntakeAvailability.available).toBe(false);
    expect(protectedIntakeAvailability.reason).toContain("isolated acceptance");
    expect(controlledRequirementAvailability.available).toBe(false);
    expect(controlledRequirementAvailability.dependency).toContain("Master Specification version");
  });

  it("keeps the Sales requirement action source-bound and prevents the legacy direct save", () => {
    const lifecycleDialogs = readFileSync("src/components/sales/SalesLifecycleDialogs.tsx", "utf8");
    expect(lifecycleDialogs).toContain("Authoritative source");
    expect(lifecycleDialogs).toContain("Master Specification:");
    expect(lifecycleDialogs).toContain("Retry source load");
    expect(lifecycleDialogs).toContain("Create source-bound requirement");
    expect(lifecycleDialogs).toContain("controlledRequirementAvailability.reason");
    expect(lifecycleDialogs).not.toContain("useServerFn(createCustomerRequirement)");
  });

  it("pins one client request key for a retry and only renews it for a deliberate new draft", () => {
    const original = "9ce5a383-9ebf-430e-9bba-2e550c20fe3e";
    expect(clientRequirementRequestKey(original)).toBe(original);
    const renewed = clientRequirementRequestKey(null);
    expect(renewed).toMatch(/^[0-9a-f-]{36}$/i);
    expect(renewed).not.toBe(original);
  });

  it("keeps external intake behind a narrow definer transaction without widening direct table RLS", () => {
    expect(pendingSql).toContain("CREATE OR REPLACE FUNCTION public.submit_external_customer_requirement");
    expect(pendingSql).toMatch(/submit_external_customer_requirement\([\s\S]*?LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = public, pg_temp/);
    expect(pendingSql).toContain("v_actor_id uuid := auth.uid()");
    expect(pendingSql).toContain("public.external_current_contact_id(v_actor_id)");
    expect(pendingSql).toContain("public.external_current_party_id()");
    expect(pendingSql).toContain("public.external_requirement_scope_allows(p_opportunity_id, p_customer_id)");
    expect(pendingSql).toContain("p_request_key uuid");
    expect(pendingSql).toContain("DROP FUNCTION public.submit_external_customer_requirement(uuid,uuid,text,text,jsonb)");
    expect(pendingSql).toContain("REVOKE ALL ON FUNCTION public.submit_external_customer_requirement(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role");
    expect(pendingSql).toContain("CREATE TABLE IF NOT EXISTS public.external_requirement_submission_requests");
    expect(pendingSql).toContain("PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0))");
    expect(pendingSql).toContain("Request key conflicts with a different caller or payload");
    expect(pendingSql).toContain("RETURN v_prior.requirement_id");
    expect(pendingSql).toContain("party.id = v_party_id AND party.customer_id = p_customer_id");
    expect(pendingSql).toContain("opportunity.id = p_opportunity_id AND opportunity.customer_id = p_customer_id");
    expect(pendingSql).toContain("external_contact_id");
    expect(pendingSql).toContain("external_party_id");
    expect(pendingSql).not.toContain("CREATE POLICY external_customer_requirements");
    expect(pendingSql).not.toContain("GRANT INSERT ON public.customer_requirements TO authenticated");
  });

  it("binds an exact retry receipt to the caller, scope, and persisted canonical payload", () => {
    expect(pendingSql).toContain("request_key uuid PRIMARY KEY");
    expect(pendingSql).toContain("external_contact_id uuid NOT NULL");
    expect(pendingSql).toContain("opportunity_id uuid NOT NULL");
    expect(pendingSql).toContain("customer_id uuid NOT NULL");
    expect(pendingSql).toContain("requested_by uuid NOT NULL");
    expect(pendingSql).toContain("payload_hash text NOT NULL");
    expect(pendingSql).toContain("payload_canonical jsonb NOT NULL");
    expect(pendingSql).toContain("external_requirement_submission_requests_payload_canonical_check");
    expect(pendingSql).toContain("payload_canonical IS NULL OR jsonb_typeof(payload_canonical) = 'object'");
    expect(pendingSql).toContain("requirement_id uuid NOT NULL UNIQUE");
    expect(pendingSql).toContain("v_prior.requested_by = v_actor_id");
    expect(pendingSql).toContain("v_prior.external_contact_id = v_contact_id");
    expect(pendingSql).toContain("v_prior.payload_hash = v_payload_hash");
    expect(pendingSql).toContain("v_prior.payload_canonical = v_payload_canonical");
    expect(pendingSql).toContain("FROM public.external_requirement_submission_requests");
    expect(pendingSql).toContain("FOR UPDATE;");
    expect(pendingSql).toContain("external_requirement_submission_canonical_payload");
    expect(pendingSql).toContain("to_regprocedure('public.external_requirement_scope_allows(uuid,uuid,uuid)') IS NOT NULL");
    expect(pendingSql).toContain("DROP FUNCTION public.external_requirement_scope_allows(uuid,uuid,uuid)");
    expect(pendingSql).not.toContain("GRANT EXECUTE ON FUNCTION public.external_requirement_scope_allows");
  });

  it("keeps upgraded legacy null-payload receipts deliberately non-replayable", () => {
    expect(pendingSql).toContain("Existing NULL payloads remain deliberately non-replayable");
    expect(pendingSql).toContain("v_prior.payload_canonical IS NOT NULL");
    expect(pendingSql).toContain("Request key conflicts with a different caller or payload");
    expect(acceptanceSql).toContain("legacy replay fails closed");
  });

  it("uses protected assignment and response routines instead of a caller-settable reviewer marker", () => {
    expect(pendingSql).toContain("A clean installation has no former three-argument scope helper");
    expect(pendingSql).toContain("never use CASCADE here");
    expect(pendingSql).toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE public.requirement_feasibility_reviews FROM authenticated");
    expect(pendingSql).toContain('DROP POLICY IF EXISTS "Sales users manage feasibility reviews"');
    expect(pendingSql).toContain("CREATE OR REPLACE FUNCTION public.assign_requirement_feasibility_review");
    expect(pendingSql).toContain("A terminal review is immutable history; a new requirement revision is required for another feasibility review");
    expect(pendingSql).toContain("source_revision_id uuid REFERENCES public.customer_requirement_revisions(id) ON DELETE RESTRICT");
    expect(pendingSql).toContain("master_specification_version_id uuid REFERENCES public.master_specification_versions(id) ON DELETE RESTRICT");
    expect(pendingSql).toContain("Current immutable customer requirement revision is unavailable");
    expect(pendingSql).toContain("v_revision.requirement_data #>> '{source,master_specification_version_id}'");
    expect(pendingSql).toContain("legacy provenance is unavailable");
    expect(pendingSql).toContain("Master Specification workstreams are missing, null, non-string, unknown, or incomplete; applicability is TBC");
    expect(pendingSql).toContain("Open feasibility review is pinned to different immutable provenance");
    expect(pendingSql).toContain("Feasibility review lacks immutable provenance and cannot receive a protected response");
    expect(pendingSql).toContain("source_revision_id IS NOT NULL");
    expect(pendingSql).toContain("Only the assigned reviewer may submit this feasibility response");
    expect(pendingSql).not.toContain("PERFORM set_config('app.requirement_feasibility_response_rpc'");
    expect(pendingSql).not.toContain("current_setting('app.requirement_feasibility_response_rpc'");
    expect(pendingSql).toContain("'Engineering feasibility review assigned.'");
    expect(pendingSql).toContain("IF v_review.status NOT IN ('pending', 'in_review') THEN");
    expect(pendingSql).toContain("'requirement_id', v_review.requirement_id");
    expect(pendingSql).toContain("'opportunity_id', v_requirement.opportunity_id");
    expect(pendingSql).toContain("'customer_id', v_requirement.customer_id");
    expect(acceptanceSql).toContain("clean install");
    expect(acceptanceSql).toContain("Receipt upgrade");
    expect(acceptanceSql).toContain("direct review UPDATE");
    expect(acceptanceSql).toContain("marker-set direct UPDATE attempt");
    expect(acceptanceSql).toContain("source requirement replacement");
    expect(acceptanceSql).toContain("Reviewer rollback and provenance case");
    expect(acceptanceSql).toContain("no_direct_review_insert");
    expect(acceptanceSql).toContain("sales_write_policy_removed");
    expect(acceptanceSql).toContain("repeat assignment to the same reviewer");
  });

  it("keeps feasibility provenance server-pinned and unavailable to direct reassignment", () => {
    const salesRead = readFileSync("src/lib/sales.ts", "utf8");
    expect(pendingSql).toContain("WHERE source_revision_id = v_revision.id");
    expect(pendingSql).toContain("Open feasibility review is pinned to different immutable provenance");
    expect(pendingSql).toContain("UNIQUE (source_revision_id, department_id)");
    expect(pendingSql).toContain("customer_requirement_revisions_requirement_revision_key");
    expect(pendingSql).toContain("UNIQUE (requirement_id, revision_number)");
    expect(pendingSql).toContain("applicable_workstreams IS NOT NULL");
    expect(pendingSql).toContain("All protected routines lock source rows in this order: requirement, revision, review, version.");
    expect(pendingSql).toContain("Match assignment's order: requirement, revision, review, version.");
    expect(pendingSql).toContain("source_revision_id, source_revision_number,");
    expect(pendingSql).toContain("source_revision_id IS NULL");
    expect(salesRead).toContain("source_revision_id,source_revision_number,master_specification_version_id,master_specification_version_number,applicable_workstreams");
    expect(acceptanceSql).toContain("pinned provenance");
    expect(acceptanceSql).toContain("terminal review remains immutable history");
    expect(acceptanceSql).toContain("exact retry returns the existing review");
    expect(acceptanceSql).toContain("revision-scoped uniqueness");
    expect(acceptanceSql).toContain("missing/null/non-string/unknown");
  });

  it("keeps the legacy Sales feasibility save path from silently bypassing the pending protected contract", () => {
    const salesFunctions = readFileSync("src/lib/sales.functions.ts", "utf8");
    const lifecycleDialogs = readFileSync("src/components/sales/SalesLifecycleDialogs.tsx", "utf8");
    expect(salesFunctions).toContain('sb.rpc("assign_requirement_feasibility_review"');
    expect(salesFunctions).not.toContain('from("requirement_feasibility_reviews").upsert');
    expect(lifecycleDialogs).toContain("Protected assignment is pending database acceptance");
    expect(lifecycleDialogs).toContain("Assign reviewer</Button>");
    expect(lifecycleDialogs).not.toContain("Save review</Button>");
  });

  it("keeps Sales-bound requirement creation atomic, current-version-pinned, replay-safe, and compatible with controlled numbering", () => {
    expect(salesBoundSql).toContain("CREATE TABLE public.sales_requirement_creation_requests");
    expect(salesBoundSql).toContain("GRANT ALL ON TABLE public.sales_requirement_creation_requests TO service_role;");
    expect(salesBoundSql).toContain("REVOKE ALL ON TABLE public.sales_requirement_creation_requests FROM PUBLIC, anon, authenticated;");
    expect(salesBoundSql).toContain('CREATE POLICY "No direct receipt access"');
    expect(salesBoundSql).toContain("ALTER TABLE public.sales_requirement_creation_requests ENABLE ROW LEVEL SECURITY;");
    expect(salesBoundSql).toContain("CREATE OR REPLACE FUNCTION public.create_sales_bound_customer_requirement");
    expect(salesBoundSql).toMatch(/create_sales_bound_customer_requirement\([\s\S]*?LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = public, pg_temp/);
    expect(salesBoundSql).toContain("public.has_permission(v_actor_id, 'sales.manage')");
    expect(salesBoundSql).toContain("WHERE id = p_opportunity_id AND customer_id = p_customer_id");
    expect(salesBoundSql).toContain("version.version_number = specification.current_version");
    expect(salesBoundSql).toContain("Master Specification version is unavailable for this opportunity and customer");
    expect(salesBoundSql).toContain("PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0))");
    expect(salesBoundSql.indexOf("SELECT * INTO v_prior")).toBeLessThan(salesBoundSql.indexOf("FOR UPDATE OF specification"));
    expect(salesBoundSql).toContain("FOR UPDATE;");
    expect(salesBoundSql).toContain("FOR UPDATE OF specification;");
    expect(salesBoundSql).toContain("v_prior.payload_canonical = v_payload_canonical");
    expect(salesBoundSql).toContain("Request key conflicts with a different caller or payload");
    expect(salesBoundSql).toContain("public.next_business_number('customer_requirement', NULL, NULL)");
    expect(salesBoundSql).toContain("'master_specification_version_id', p_master_specification_version_id");
    expect(salesBoundSql).toContain("'source_bound_created'");
    expect(salesBoundSql).toContain("REVOKE ALL ON FUNCTION public.create_sales_bound_customer_requirement");
    expect(salesBoundSql).not.toContain("createCustomerRequirement(");
  });

  it("documents the boundary between structural checks and required real caller-transport acceptance", () => {
    const transportHarness = readFileSync("supabase/pending/tests/sales_bound_requirement_creation_caller_transport_acceptance.sh", "utf8");
    expect(salesBoundAcceptanceSql).toContain("STRUCTURAL-ONLY SOURCE CHECK");
    expect(salesBoundAcceptanceSql).toContain("This file is not caller-authenticated database");
    expect(salesBoundAcceptanceSql).toContain("exact replay after controlled Master-version advance");
    expect(salesBoundAcceptanceSql).toContain("fresh key using the now-stale Master version rejects");
    expect(salesBoundAcceptanceSql).toContain("protected create holds its source locks while a protected controlled source update");
    expect(salesBoundAcceptanceSql).toContain("source_bound_created audit");
    expect(salesBoundAcceptanceSql).toContain("no_public_receipt_read");
    expect(salesBoundAcceptanceSql).toContain("no_anon_receipt_read");
    expect(salesBoundAcceptanceSql).toContain("sales_bound_requirement_creation_caller_transport_acceptance.sh");
    expect(transportHarness).toContain("Refusing unapproved isolated target");
    expect(transportHarness).toContain("Refusing original target");
    expect(transportHarness).toContain("Fresh stale-version creation unexpectedly succeeded");
    expect(transportHarness).toContain("protected-create/source-update overlap");
  });

  it("keeps the pending Sales facade unavailable instead of falling back to legacy writes", () => {
    const facade = readFileSync("src/lib/sales-bound-requirement.functions.ts", "utf8");
    expect(facade).toContain("requireSupabaseAuth");
    expect(facade).toContain("Source-bound requirement creation is unavailable");
    expect(facade).not.toContain('from("customer_requirements").insert');
    expect(facade).not.toContain("createCustomerRequirement");
  });

  it("retires the legacy multi-call facade and fails baseline approval closed until revision-bound feasibility is available", () => {
    const salesFunctions = readFileSync("src/lib/sales.functions.ts", "utf8");
    const lifecycleDialogs = readFileSync("src/components/sales/SalesLifecycleDialogs.tsx", "utf8");
    expect(salesFunctions).toContain("Legacy customer requirement creation is retired");
    expect(salesFunctions).not.toContain('from("customer_requirements").insert');
    expect(salesFunctions).not.toContain('from("customer_requirement_revisions").insert');
    expect(salesFunctions).not.toContain('sb.rpc("approve_requirement_baseline"');
    expect(salesFunctions).toContain("Baseline approval is unavailable until revision-bound feasibility");
    expect(salesBoundSql).not.toContain("CREATE OR REPLACE FUNCTION public.approve_requirement_baseline");
    expect(salesBoundSql).not.toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE public.customer_requirements FROM PUBLIC, authenticated;");
    expect(salesBoundSql).toContain("requirement_baselines_assign_business_code");
    expect(salesBoundSql).toContain("Future protected approval must not accept a caller baseline number");
    expect(salesBoundSql).toContain("requirement-revision linkage plus applicability");
    expect(lifecycleDialogs).toContain("Baseline approval is unavailable until revision-bound feasibility");
    expect(lifecycleDialogs).toContain('type="submit" disabled>Create approved baseline');
  });

  it("labels direct psql simulation structural-only and requires a real caller transport target refusal", () => {
    const transportHarness = readFileSync("supabase/pending/tests/sales_bound_requirement_creation_caller_transport_acceptance.sh", "utf8");
    expect(salesBoundAcceptanceSql).toContain("STRUCTURAL-ONLY SOURCE CHECK");
    expect(salesBoundAcceptanceSql).toContain("This file is not caller-authenticated database");
    expect(salesBoundAcceptanceSql).toContain("SET LOCAL request.jwt.claim.sub can only model function branch shape");
    expect(salesBoundConcurrencyHarness).toContain("RETIRED STRUCTURAL HARNESS");
    expect(salesBoundConcurrencyHarness).not.toContain("pg_sleep");
    expect(transportHarness).toContain("Refusing unapproved isolated target");
    expect(transportHarness).toContain("Refusing original target");
    expect(transportHarness).toContain("request.jwt.claim.* and never connects");
    expect(transportHarness).toContain("never connects with a service-role credential");
    expect(transportHarness).toContain("Fresh stale-version creation unexpectedly succeeded");
    expect(transportHarness).toContain("protected-create/source-update overlap");
  });

  it("requires expiration, revocation, direct-table denial, rollback, and caller-RLS acceptance", () => {
    expect(acceptanceSql).toContain("expired, revoked, and unscoped");
    expect(acceptanceSql).toContain("wrong opportunity/customer pairing");
    expect(acceptanceSql).toContain("direct requirement/revision/audit reads and writes fail");
    expect(acceptanceSql).toContain("Forced audit rollback case");
    expect(acceptanceSql).toContain("cannot SELECT the new header/revision/audit directly through RLS");
    expect(acceptanceSql).toContain("concurrency");
    expect(acceptanceSql).toContain("same request key + identical payload replays the original requirement ID");
    expect(acceptanceSql).toContain("Request key conflicts with a different caller or payload");
    expect(acceptanceSql).toContain("external_requirement_submission_requests row, one customer_requirements row");
    expect(acceptanceSql).toContain("No five-argument overload may remain callable");
    expect(acceptanceSql).toContain("canonical payload");
  });
});
