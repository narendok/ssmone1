import { describe, expect, it } from "vitest";
import { buildFeasibilityPlanningSnapshot, displayPlanningValue } from "./feasibility-planning";

const requirement = { id: "requirement-1", opportunity_id: "opportunity-1", current_revision: 2 };
const revision = { id: "revision-2", requirement_id: "requirement-1", revision_number: 2, source_master_specification_version_id: "master-version-3" };
const specification = { id: "master-1", opportunity_id: "opportunity-1", current_version: 3 };
const pinnedReview = { id: "review-1", requirement_id: requirement.id, status: "feasible", source_revision_id: revision.id, source_revision_number: 2, master_specification_version_id: "master-version-3", master_specification_version_number: 3, applicable_workstreams: ["HARDWARE"] };

describe("buildFeasibilityPlanningSnapshot", () => {
  it("does not treat an unpinned terminal verdict as ready", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: { id: "review-1", requirement_id: requirement.id, status: "feasible" }, requirements: [requirement], revisions: [revision], masterSpecifications: [specification] });
    expect(state).toMatchObject({ state: "UNSUPPORTED_UNVERIFIED", canSatisfyPlanningGate: false });
  });

  it("does not let a stale terminal verdict satisfy planning", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: { ...pinnedReview, source_revision_id: "revision-1" }, requirements: [requirement], revisions: [revision], masterSpecifications: [specification] });
    expect(state).toMatchObject({ state: "STALE", canSatisfyPlanningGate: false });
  });

  it("retains a terminal decision when the mutable Master header advances after its immutable revision was pinned", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: pinnedReview, requirements: [requirement], revisions: [revision], masterSpecifications: [{ ...specification, current_version: 4 }] });
    expect(state).toMatchObject({ state: "READY", canSatisfyPlanningGate: true });
  });

  it("blocks readiness when verified workstream applicability is unknown", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: { ...pinnedReview, applicable_workstreams: ["UNKNOWN"] }, requirements: [requirement], revisions: [revision], masterSpecifications: [specification] });
    expect(state).toMatchObject({ state: "APPLICABILITY_TBC", canSatisfyPlanningGate: false });
  });

  it("treats only an exact pinned terminal decision as ready", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: pinnedReview, requirements: [requirement], revisions: [revision], masterSpecifications: [specification] });
    expect(state).toMatchObject({ state: "READY", canSatisfyPlanningGate: true, applicableWorkstreams: ["HARDWARE"] });
  });

  it("does not turn a failed source query into empty success", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: { id: "review-1", requirement_id: requirement.id, status: "feasible", source_revision_id: revision.id }, requirements: [requirement], revisions: [], masterSpecifications: [], sourceError: new Error("RLS read denied") });
    expect(state).toMatchObject({ state: "SOURCE_ERROR", canSatisfyPlanningGate: false });
  });

  it("keeps a terminal decision stale when its pinned Master version differs from the revision source", () => {
    const state = buildFeasibilityPlanningSnapshot({ review: { ...pinnedReview, master_specification_version_id: "master-version-2" }, requirements: [requirement], revisions: [revision], masterSpecifications: [specification] });
    expect(state).toMatchObject({ state: "STALE", canSatisfyPlanningGate: false });
  });

  it("does not accept missing, null, or non-string workstreams as verified applicability", () => {
    for (const applicable_workstreams of [null, [null], ["HARDWARE", 1]]) {
      const state = buildFeasibilityPlanningSnapshot({ review: { ...pinnedReview, applicable_workstreams }, requirements: [requirement], revisions: [revision], masterSpecifications: [specification] });
      expect(state).toMatchObject({ state: "APPLICABILITY_TBC", canSatisfyPlanningGate: false });
    }
  });

  it("retains unknown human fields as TBC", () => {
    expect(displayPlanningValue(null)).toBe("TBC");
    expect(displayPlanningValue(" ")).toBe("TBC");
    expect(displayPlanningValue("CAN bus")).toBe("CAN bus");
  });
});