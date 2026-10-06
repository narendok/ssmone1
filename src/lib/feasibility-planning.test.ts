import { describe, expect, it } from "vitest";
import { buildFeasibilityPlanningSnapshot, displayPlanningValue } from "./feasibility-planning";

const requirement = { id: "requirement-1", opportunity_id: "opportunity-1", current_revision: 2 };
const revision = { id: "revision-2", requirement_id: "requirement-1", revision_number: 2 };
const specification = { id: "master-1", opportunity_id: "opportunity-1", current_version: 3 };

describe("buildFeasibilityPlanningSnapshot", () => {
  it("does not treat an unpinned terminal verdict as ready", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: { id: "review-1", requirement_id: requirement.id, status: "feasible" }, requirements: [requirement], revisions: [revision], masterSpecifications: [specification] });
    expect(state).toMatchObject({ state: "UNSUPPORTED_UNVERIFIED", canSatisfyPlanningGate: false });
  });

  it("does not let a stale terminal verdict satisfy planning", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: { id: "review-1", requirement_id: requirement.id, status: "feasible", source_revision_id: "revision-1" }, requirements: [requirement], revisions: [revision], masterSpecifications: [specification] });
    expect(state).toMatchObject({ state: "STALE", canSatisfyPlanningGate: false });
  });

  it("does not turn a failed source query into empty success", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: { id: "review-1", requirement_id: requirement.id, status: "feasible", source_revision_id: revision.id }, requirements: [requirement], revisions: [], masterSpecifications: [], sourceError: new Error("RLS read denied") });
    expect(state).toMatchObject({ state: "SOURCE_ERROR", canSatisfyPlanningGate: false });
  });

  it("retains unknown human fields as TBC", () => {
    expect(displayPlanningValue(null)).toBe("TBC");
    expect(displayPlanningValue(" ")).toBe("TBC");
    expect(displayPlanningValue("CAN bus")).toBe("CAN bus");
  });
});