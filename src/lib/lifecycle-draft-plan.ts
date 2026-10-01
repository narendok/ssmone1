export type LifecycleDraftInput = {
  projectId: string;
  departmentId: string | null;
  requirementBaselineId: string | null;
  projectDriveNodeId: string | null;
  tasks: Array<{ id: string; status: string }>;
  processRecords: Array<{ id: string; status: string; linked_task_id?: string | null }>;
  designInputCount: number;
  researchCount: number;
  linkedBomCount: number;
};

export type DraftLifecyclePlan = {
  state: "DRAFT";
  projectId: string;
  requiredInputs: Array<{
    name: string;
    provenance: string;
    status: "LINKED" | "MISSING";
  }>;
  missingInputs: string[];
  proposedActions: Array<{
    key: "CREATE_STAGE_PLAN" | "CREATE_HANDOFF_TASKS" | "REQUEST_FEEDBACK_REVISION";
    title: string;
    state: "DRAFT";
    reason: string;
  }>;
  canGenerate: false;
  autofillState: "ABSENT";
  governanceNotice: string;
};

/**
 * Produces a read-only plan from governed records. This deliberately never
 * creates templates, project stages, feedback revisions, tasks, or notices.
 */
export function createLifecycleDraftPlan(input: LifecycleDraftInput): DraftLifecyclePlan {
  const missingInputs: string[] = [];
  if (!input.departmentId) missingInputs.push("Owning department");
  if (!input.requirementBaselineId) missingInputs.push("Approved requirement baseline");
  if (!input.projectDriveNodeId) missingInputs.push("Project Drive root");
  if (input.designInputCount === 0) missingInputs.push("Provenance-linked design input");
  if (input.linkedBomCount === 0) missingInputs.push("Revision-linked BOM source");

  const requiredInputs: DraftLifecyclePlan["requiredInputs"] = [
    {
      name: "Owning department",
      provenance: "Project organizational master data",
      status: input.departmentId ? "LINKED" : "MISSING",
    },
    {
      name: "Approved requirement baseline",
      provenance: "Sales & Engineering frozen requirement snapshot",
      status: input.requirementBaselineId ? "LINKED" : "MISSING",
    },
    {
      name: "Project Drive root",
      provenance: "Governed document control tree",
      status: input.projectDriveNodeId ? "LINKED" : "MISSING",
    },
    {
      name: "Provenance-linked design input",
      provenance: "Shared Product Requirement Specification (PRS)",
      status: input.designInputCount > 0 ? "LINKED" : "MISSING",
    },
    {
      name: "Revision-linked BOM source",
      provenance: "Production-ready engineering bill of materials",
      status: input.linkedBomCount > 0 ? "LINKED" : "MISSING",
    },
  ];

  const proposedActions: DraftLifecyclePlan["proposedActions"] = [
    {
      key: "CREATE_STAGE_PLAN",
      title: "Materialize versioned department stage plan",
      state: "DRAFT",
      reason: missingInputs.length
        ? "Blocked until the missing governed inputs are supplied."
        : "Requires an approved template version and an authorized server action.",
    },
    {
      key: "CREATE_HANDOFF_TASKS",
      title: "Create deduplicated handoff tasks and notices",
      state: "DRAFT",
      reason: input.processRecords.some((record) => !record.linked_task_id)
        ? "Stage records without linked tasks were found; no task was created."
        : "Requires an authorized idempotent server action.",
    },
    {
      key: "REQUEST_FEEDBACK_REVISION",
      title: "Capture a revisioned client feedback draft",
      state: "DRAFT",
      reason: input.requirementBaselineId
        ? "A baseline is linked; feedback still needs a governed author and revision flow."
        : "No approved baseline is linked to anchor the feedback revision.",
    },
  ];

  return {
    state: "DRAFT",
    projectId: input.projectId,
    requiredInputs,
    missingInputs,
    proposedActions,
    canGenerate: false,
    autofillState: "ABSENT",
    governanceNotice: "Governed notifications and client feedback are explicitly absent in this DRAFT plan to maintain audit integrity.",
  };
}
