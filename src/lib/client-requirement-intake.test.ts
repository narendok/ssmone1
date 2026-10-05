import { describe, expect, it } from "vitest";
import { clientRequirementIntakeSchema, clientRequirementState, feasibilityResponseSchema, mayExposeClientRequirement, mayRecordFeasibility } from "./client-requirement-intake";

describe("client requirement intake contract", () => {
  it("requires bounded immutable submission content", () => {
    expect(clientRequirementIntakeSchema.safeParse({ opportunityId: "bad", customerId: "bad", title: "", description: "short", customerReference: null }).success).toBe(false);
    expect(clientRequirementIntakeSchema.parse({ opportunityId: "b0c80d22-1007-4a60-b8cf-9c20a6c4f1a8", customerId: "dfd5f3f8-0caf-46cb-bf16-436a1c063650", title: "Interface requirement", description: "The submitted requirement remains immutable after receipt.", customerReference: "OEM-REQ-7" })).toMatchObject({ title: "Interface requirement" });
  });

  it("treats expired and revoked portal access as unavailable", () => {
    expect(clientRequirementState({ isActive: true, revokedAt: null, expiresAt: "2026-10-05T18:00:00.000Z" }, new Date("2026-10-05T18:01:00.000Z"))).toBe("EXPIRED");
    expect(clientRequirementState({ isActive: false, revokedAt: null, expiresAt: null })).toBe("REVOKED");
    expect(clientRequirementState({ isActive: true, revokedAt: null, expiresAt: null })).toBe("ACTIVE");
  });

  it("permits feasibility responses only for the assigned reviewer or engineering manager before response", () => {
    expect(mayRecordFeasibility({ assignedTo: "reviewer", actorId: "reviewer", isEngineeringManager: false, status: "in_review" })).toBe(true);
    expect(mayRecordFeasibility({ assignedTo: "reviewer", actorId: "other", isEngineeringManager: false, status: "in_review" })).toBe(false);
    expect(mayRecordFeasibility({ assignedTo: "reviewer", actorId: "manager", isEngineeringManager: true, status: "in_review" })).toBe(true);
    expect(mayRecordFeasibility({ assignedTo: "reviewer", actorId: "reviewer", isEngineeringManager: false, status: "feasible" })).toBe(false);
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
});