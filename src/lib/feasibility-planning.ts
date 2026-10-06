export type FeasibilityPlanningReview = {
  id: string;
  requirement_id: string;
  status: string;
  source_revision_id?: string | null;
};

export type FeasibilityPlanningRequirement = {
  id: string;
  opportunity_id: string;
  current_revision: number;
};

export type FeasibilityPlanningRevision = {
  id: string;
  requirement_id: string;
  revision_number: number;
};

export type FeasibilityPlanningSpecification = {
  id: string;
  opportunity_id: string;
  current_version: number;
};

export type FeasibilityPlanningState = "PENDING" | "READY" | "STALE" | "MISSING_SOURCE" | "SOURCE_ERROR" | "UNSUPPORTED_UNVERIFIED";

export type FeasibilityPlanningSnapshot = {
  state: FeasibilityPlanningState;
  requirementRevision: FeasibilityPlanningRevision | null;
  masterSpecification: FeasibilityPlanningSpecification | null;
  isTerminalVerdict: boolean;
  canSatisfyPlanningGate: boolean;
  message: string;
};

const terminalVerdicts = new Set(["feasible", "feasible_with_conditions", "not_feasible"]);

/**
 * Read-only source composition. A terminal verdict is usable only when the
 * feasibility record pins the same immutable customer-requirement revision.
 * Current deployed reviews do not carry that column, so they fail closed.
 */
export function buildFeasibilityPlanningSnapshot(input: {
  review: FeasibilityPlanningReview;
  requirements: FeasibilityPlanningRequirement[];
  revisions: FeasibilityPlanningRevision[];
  masterSpecifications: FeasibilityPlanningSpecification[];
  sourceError?: Error | null;
}): FeasibilityPlanningSnapshot {
  const isTerminalVerdict = terminalVerdicts.has(input.review.status);
  if (input.sourceError) {
    return { state: "SOURCE_ERROR", requirementRevision: null, masterSpecification: null, isTerminalVerdict, canSatisfyPlanningGate: false, message: "Source records could not be verified. No feasibility verdict is treated as ready." };
  }

  const requirement = input.requirements.find((item) => item.id === input.review.requirement_id);
  if (!requirement) {
    return { state: "MISSING_SOURCE", requirementRevision: null, masterSpecification: null, isTerminalVerdict, canSatisfyPlanningGate: false, message: "The linked customer requirement is unavailable." };
  }

  const requirementRevision = input.revisions.find((item) => item.requirement_id === requirement.id && item.revision_number === requirement.current_revision) ?? null;
  const masterSpecification = input.masterSpecifications.find((item) => item.opportunity_id === requirement.opportunity_id) ?? null;
  if (!requirementRevision || !masterSpecification) {
    return { state: "MISSING_SOURCE", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: !requirementRevision ? "The current immutable customer-requirement revision is unavailable." : "The current Master Specification is unavailable for this opportunity." };
  }

  if (!input.review.source_revision_id) {
    return { state: "UNSUPPORTED_UNVERIFIED", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: "This feasibility record is not bound to an immutable customer-requirement revision. Its verdict is unverified and cannot satisfy planning." };
  }

  if (input.review.source_revision_id !== requirementRevision.id) {
    return { state: "STALE", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: "The customer requirement changed after this review was sourced. A stale verdict cannot satisfy planning." };
  }

  if (!isTerminalVerdict) {
    return { state: "PENDING", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: "An assigned feasibility verdict is still pending." };
  }

  return { state: "READY", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: true, message: "The review is bound to the current immutable requirement revision for read-only planning." };
}

export function displayPlanningValue(value: string | null | undefined): string {
  return value?.trim() || "TBC";
}