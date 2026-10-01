import { describe, expect, it } from "vitest";
import { createLifecycleDraftPlan } from "./lifecycle-draft-plan";

describe("lifecycle draft planner", () => {
  it("keeps a complete source set as a non-executable draft with provenance", () => {
    const plan = createLifecycleDraftPlan({
      projectId: "project-1",
      departmentId: "department-1",
      requirementBaselineId: "baseline-1",
      projectDriveNodeId: "drive-1",
      tasks: [],
      processRecords: [{ id: "stage-1", status: "NOT_STARTED", linked_task_id: null }],
      designInputCount: 1,
      researchCount: 0,
      linkedBomCount: 1,
    });

    expect(plan).toMatchObject({
      state: "DRAFT",
      canGenerate: false,
      missingInputs: [],
      autofillState: "ABSENT",
    });
    
    expect(plan.governanceNotice).toContain("notifications and client feedback are explicitly absent");
    expect(plan.requiredInputs.find(i => i.name === "Owning department")?.provenance).toBe("Project organizational master data");
    expect(plan.proposedActions.find((action) => action.key === "CREATE_HANDOFF_TASKS")?.reason).toContain("no task was created");
    expect(plan.unavailableGovernedOutputs).toEqual([
      "Template document auto-fill is not implemented",
      "Governed notification creation is not implemented",
      "Revisioned client feedback creation is not implemented",
    ]);
  });

  it("reports missing authoritative provenance instead of inferring it", () => {
    const plan = createLifecycleDraftPlan({
      projectId: "project-1",
      departmentId: null,
      requirementBaselineId: null,
      projectDriveNodeId: null,
      tasks: [],
      processRecords: [],
      designInputCount: 0,
      researchCount: 0,
      linkedBomCount: 0,
    });

    expect(plan.missingInputs).toEqual([
      "Owning department",
      "Approved requirement baseline",
      "Project Drive root",
      "Provenance-linked design input",
      "Revision-linked BOM source",
    ]);
    
    const missingItems = plan.requiredInputs.filter(i => i.status === "MISSING");
    expect(missingItems.length).toBe(5);
    expect(missingItems.map(i => i.name)).toEqual(plan.missingInputs);
    expect(plan.proposedActions.every((action) => action.state === "DRAFT")).toBe(true);
  });
});
