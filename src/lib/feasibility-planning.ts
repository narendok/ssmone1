export type FeasibilityPlanningReview = {
  id: string;
  requirement_id: string;
  status: string;
  source_revision_id?: string | null;
  source_revision_number?: number | null;
  master_specification_version_id?: string | null;
  master_specification_version_number?: number | null;
  applicable_workstreams?: unknown;
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
  source_master_specification_version_id?: string | null;
};

export type FeasibilityPlanningSpecification = {
  id: string;
  opportunity_id: string;
  customer_id?: string;
  current_version: number;
};

export type FeasibilityPlanningState = "PENDING" | "READY" | "STALE" | "MISSING_SOURCE" | "SOURCE_ERROR" | "UNSUPPORTED_UNVERIFIED" | "APPLICABILITY_TBC";

export type FeasibilityPlanningSnapshot = {
  state: FeasibilityPlanningState;
  requirementRevision: FeasibilityPlanningRevision | null;
  masterSpecification: FeasibilityPlanningSpecification | null;
  applicableWorkstreams: string[] | null;
  isTerminalVerdict: boolean;
  canSatisfyPlanningGate: boolean;
  message: string;
};

const terminalVerdicts = new Set(["feasible", "feasible_with_conditions", "not_feasible"]);
const knownWorkstreams = new Set(["HARDWARE", "FIRMWARE", "MECHANICAL", "TEST", "MANUFACTURING"]);

function planningSnapshot(input: Omit<FeasibilityPlanningSnapshot, "applicableWorkstreams"> & { applicableWorkstreams?: string[] | null }): FeasibilityPlanningSnapshot {
  return { ...input, applicableWorkstreams: input.applicableWorkstreams ?? null };
}

function readWorkstreams(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !knownWorkstreams.has(item))) return null;
  return [...value];
}

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
    return planningSnapshot({ state: "SOURCE_ERROR", requirementRevision: null, masterSpecification: null, isTerminalVerdict, canSatisfyPlanningGate: false, message: "Source records could not be verified. No feasibility verdict is treated as ready." });
  }

  const requirement = input.requirements.find((item) => item.id === input.review.requirement_id);
  if (!requirement) {
    return planningSnapshot({ state: "MISSING_SOURCE", requirementRevision: null, masterSpecification: null, isTerminalVerdict, canSatisfyPlanningGate: false, message: "The linked customer requirement is unavailable." });
  }

  const requirementRevision = input.revisions.find((item) => item.requirement_id === requirement.id && item.revision_number === requirement.current_revision) ?? null;
  const masterSpecification = input.masterSpecifications.find((item) => item.opportunity_id === requirement.opportunity_id) ?? null;
  if (!requirementRevision || !masterSpecification) {
    return planningSnapshot({ state: "MISSING_SOURCE", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: !requirementRevision ? "The current immutable customer-requirement revision is unavailable." : "The current Master Specification is unavailable for this opportunity." });
  }

  if (!input.review.source_revision_id || !input.review.master_specification_version_id || input.review.source_revision_number == null || input.review.master_specification_version_number == null) {
    return planningSnapshot({ state: "UNSUPPORTED_UNVERIFIED", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: "This feasibility record is not bound to immutable requirement and Master Specification revisions. Its verdict is unverified and cannot satisfy planning." });
  }

  if (!requirementRevision.source_master_specification_version_id) {
    return planningSnapshot({ state: "UNSUPPORTED_UNVERIFIED", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: "The current requirement revision does not expose immutable Master Specification provenance. Its feasibility verdict is unverified and cannot satisfy planning." });
  }

  if (input.review.source_revision_id !== requirementRevision.id
    || input.review.source_revision_number !== requirementRevision.revision_number
    || input.review.master_specification_version_id !== requirementRevision.source_master_specification_version_id) {
    return planningSnapshot({ state: "STALE", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: "The immutable requirement source changed after this review was assigned. A stale verdict cannot satisfy planning." });
  }

  const applicableWorkstreams = readWorkstreams(input.review.applicable_workstreams);
  if (!applicableWorkstreams) {
    return planningSnapshot({ state: "APPLICABILITY_TBC", requirementRevision, masterSpecification, isTerminalVerdict, canSatisfyPlanningGate: false, message: "Verified Master Specification workstreams are missing or unknown. Applicability remains TBC and planning is blocked." });
  }

  if (!isTerminalVerdict) {
    return planningSnapshot({ state: "PENDING", requirementRevision, masterSpecification, applicableWorkstreams, isTerminalVerdict, canSatisfyPlanningGate: false, message: "An assigned feasibility verdict is still pending." });
  }

  return planningSnapshot({ state: "READY", requirementRevision, masterSpecification, applicableWorkstreams, isTerminalVerdict, canSatisfyPlanningGate: true, message: "The review is bound to the current immutable requirement and Master Specification revisions for read-only planning." });
}

export function displayPlanningValue(value: string | null | undefined): string {
  return value?.trim() || "TBC";
}