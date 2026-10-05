import { describe, expect, it } from "vitest";
import { clientRequirementIntakeSchema, clientRequirementState, feasibilityResponseSchema, mayRecordFeasibility } from "./client-requirement-intake";

describe("client requirement intake contract", () => {
  it("requires bounded immutable submission content", () => {
    expect(clientRequirementIntakeSchema.safeParse({ title: "", description: "short", customerReference: null }).success).toBe(false);
    expect(clientRequirementIntakeSchema.parse({ title: "Interface requirement", description: "The submitted requirement remains immutable after receipt.", customerReference: "OEM-REQ-7" })).toMatchObject({ title: "Interface requirement" });
  });

  it("treats expired and revoked portal access as unavailable", () => {
    expect(clientRequirementState({ isActive: true, revokedAt: null, expiresAt: "2026-10-05T18:00:00.000Z" }, new Date("2026-10-05T18:01:00.000Z"))).toBe("EXPIRED");
    expect(clientRequirementState({ isActive: false, revokedAt: null, expiresAt: null })).toBe("REVOKED");
    expect(clientRequirementState({ isActive: true, revokedAt: null, expiresAt: null })).toBe("ACTIVE");
  });

  it("permits feasibility responses only for the assigned reviewer or engineering manager before response", () => {
    expect(mayRecordFeasibility({ assignedTo: "reviewer", actorId: "reviewer", isEngineeringManager: false, status: "IN_PROGRESS" })).toBe(true);
    expect(mayRecordFeasibility({ assignedTo: "reviewer", actorId: "other", isEngineeringManager: false, status: "IN_PROGRESS" })).toBe(false);
    expect(mayRecordFeasibility({ assignedTo: "reviewer", actorId: "manager", isEngineeringManager: true, status: "IN_PROGRESS" })).toBe(true);
    expect(mayRecordFeasibility({ assignedTo: "reviewer", actorId: "reviewer", isEngineeringManager: false, status: "RESPONDED" })).toBe(false);
  });

  it("requires a concrete immutable feasibility response and explicit verdict", () => {
    expect(feasibilityResponseSchema.safeParse({ reviewId: "bad", verdict: "FEASIBLE", response: "Looks good" }).success).toBe(false);
    expect(feasibilityResponseSchema.parse({ reviewId: "b0c80d22-1007-4a60-b8cf-9c20a6c4f1a8", verdict: "FEASIBLE_WITH_CHANGES", response: "CAN termination is required." }).verdict).toBe("FEASIBLE_WITH_CHANGES");
  });
});