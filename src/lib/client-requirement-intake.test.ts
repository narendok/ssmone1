import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clientRequirementIntakeSchema, clientRequirementRequestKey, clientRequirementState, feasibilityResponseSchema, mayExposeClientRequirement, mayRecordFeasibility, protectedIntakeAvailability } from "./client-requirement-intake";

const pendingSql = readFileSync("supabase/pending/20261005_client_requirement_intake.sql", "utf8");
const acceptanceSql = readFileSync("supabase/pending/tests/client_requirement_intake_acceptance.sql", "utf8");

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

  it("uses protected assignment and response routines instead of a caller-settable reviewer marker", () => {
    expect(pendingSql).toContain("A clean installation has no former three-argument scope helper");
    expect(pendingSql).toContain("never use CASCADE here");
    expect(pendingSql).toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE public.requirement_feasibility_reviews FROM authenticated");
    expect(pendingSql).toContain('DROP POLICY IF EXISTS "Sales users manage feasibility reviews"');
    expect(pendingSql).toContain("CREATE OR REPLACE FUNCTION public.assign_requirement_feasibility_review");
    expect(pendingSql).toContain("Terminal feasibility reviews cannot be reassigned");
    expect(pendingSql).toContain("Feasibility source requirement is immutable after assignment");
    expect(pendingSql).toContain("Feasibility responses require the assigned active engineering reviewer");
    expect(pendingSql).not.toContain("PERFORM set_config('app.requirement_feasibility_response_rpc'");
    expect(pendingSql).toContain("'requirement_id', v_review.requirement_id");
    expect(pendingSql).toContain("'opportunity_id', v_requirement.opportunity_id");
    expect(pendingSql).toContain("'customer_id', v_requirement.customer_id");
    expect(acceptanceSql).toContain("clean install");
    expect(acceptanceSql).toContain("Receipt upgrade");
    expect(acceptanceSql).toContain("direct review UPDATE");
    expect(acceptanceSql).toContain("marker-set direct UPDATE attempt");
    expect(acceptanceSql).toContain("source requirement replacement");
    expect(acceptanceSql).toContain("Reviewer rollback and provenance case");
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
