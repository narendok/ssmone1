import { describe, expect, it } from "vitest";
import { withUnavailableFeasibilityProvenance } from "./sales";

const deployedReview = { id: "review-1", requirement_id: "requirement-1", department_id: "department-1", reviewer_user_id: "reviewer-1", status: "feasible", findings: null, assumptions: null, risks: null, reviewed_at: null, created_at: "2026-10-06T00:00:00.000Z" };

describe("Sales deployed feasibility read compatibility", () => {
  it("preserves review rows when pending provenance columns are unavailable", () => {
    const result = withUnavailableFeasibilityProvenance([deployedReview], "column source_revision_id does not exist");
    expect(result.reviews).toEqual([expect.objectContaining({ id: "review-1", status: "feasible", source_revision_id: null, applicable_workstreams: null })]);
    expect(result.provenance).toEqual({ available: false, error: "column source_revision_id does not exist" });
  });
  it("reports provenance unavailable rather than an empty or passing result", () => {
    const result = withUnavailableFeasibilityProvenance([deployedReview]);
    expect(result.reviews).toHaveLength(1);
    expect(result.provenance.available).toBe(false);
    expect(result.provenance.error).toContain("readiness is blocked");
  });
});