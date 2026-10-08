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

export type BaselineReadinessState = "READY" | "BLOCKED" | "SOURCE_ERROR";

export type BaselineReadinessSnapshot = {
  state: BaselineReadinessState;
  blockers: string[];
  canApprove: boolean;
  message: string;
};

export type SalesSourceContractAvailability = {
  state: "AVAILABLE" | "UNAVAILABLE";
  blockers: string[];
  message: string;
};

/**
 * This is a deployed-read-model status only. It must never probe pending columns
 * from the aggregate Sales query or turn an unavailable contract into a passing gate.
 */
export function buildSalesSourceContractAvailability(input: {
  feasibilityProvenanceAvailable: boolean;
  feasibilityProvenanceError?: string | null;
}): SalesSourceContractAvailability {
  if (input.feasibilityProvenanceAvailable) {
    return { state: "AVAILABLE", blockers: [], message: "Immutable feasibility provenance is available for read-only planning." };
  }
  return {
    state: "UNAVAILABLE",
    blockers: [
      input.feasibilityProvenanceError?.trim() || "The deployed Sales read model does not expose immutable feasibility provenance.",
      "Protected source-bound requirement, reviewer decision, commercial save, and baseline approval contracts are pending isolated caller-authenticated acceptance.",
    ],
    message: "Source-bound readiness is unavailable. No feasibility verdict, commercial authorization, or baseline gate is treated as passing.",
  };
}

/**
 * Read-only baseline readiness composition. It never authorizes, persists, or
 * approves a baseline. Every applicable department must expose a matching,
 * pinned terminal feasibility review, commercial authorization must be present,
 * and unresolved conditions block readiness.
 */
export function buildBaselineReadinessSnapshot(input: {
  sourceError?: Error | null;
  planning: FeasibilityPlanningSnapshot[];
  requiredDepartments: string[];
  commercialStatus: string | null | undefined;
  customerAuthorizedAt: string | null | undefined;
  unresolvedConditions: Array<string | null | undefined>;
}): BaselineReadinessSnapshot {
  if (input.sourceError) {
    return { state: "SOURCE_ERROR", blockers: ["Read-only source records could not be verified."], canApprove: false, message: "Readiness is unavailable because source verification failed." };
  }

  const blockers: string[] = [];
  for (const department of input.requiredDepartments) {
    const matching = input.planning.find((item) => item.applicableWorkstreams?.includes(department));
    if (!matching) blockers.push(`${department} feasibility review is missing.`);
    else if (!matching.canSatisfyPlanningGate) blockers.push(`${department} feasibility is ${matching.state.replaceAll("_", " ").toLowerCase()}.`);
    else if (!matching.isTerminalVerdict) blockers.push(`${department} feasibility verdict is pending.`);
  }
  if (input.commercialStatus !== "customer_authorized" || !input.customerAuthorizedAt) {
    blockers.push("Customer commercial authorization is missing.");
  }
  for (const condition of input.unresolvedConditions) {
    if (condition?.trim()) blockers.push(`Unresolved condition: ${condition.trim()}`);
  }
  if (blockers.length) return { state: "BLOCKED", blockers, canApprove: false, message: "Baseline approval remains disabled until every listed blocker is resolved by an accepted protected contract." };
  return { state: "READY", blockers: [], canApprove: false, message: "Read-only readiness is complete, but baseline approval remains disabled until its protected contract passes caller-authenticated acceptance." };
}
