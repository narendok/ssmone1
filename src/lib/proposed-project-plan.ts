export type EngineeringWorkstream = "HARDWARE" | "FIRMWARE" | "MECHANICAL" | "TEST" | "MANUFACTURING";

export type ProposedProjectSpecification = {
  proposedName: string;
  customerOrInternalOwner: string;
  industryApplication: string;
  productFamily: string;
  developmentScope: string;
  workstreams: EngineeringWorkstream[];
  requirementSummary: string;
  optional: {
    powerAndUnits: string;
    interfaces: string;
    connectivityAndGnss: string;
    environmentAndIp: string;
    volumes: string;
    schedule: string;
    requestedStandards: string;
    exclusions: string;
  };
};

export type ProposedLifecycleStage = {
  key: string;
  title: string;
  state: "READY_FOR_CONFIGURATION" | "PRELIMINARY" | "NOT_APPLICABLE";
  responsibility: string;
  prerequisites: string[];
  suggestedDocuments: string[];
  exclusionRationale: string | null;
};

const isKnown = (value: string) => value.trim() && value.trim().toLowerCase() !== "unknown" && value.trim().toLowerCase() !== "to be confirmed";

/**
 * Pure planning only. This never creates stages, documents, tasks, approvals,
 * test results, certificates, or signatures.
 */
export function createProposedProjectPlan(specification: ProposedProjectSpecification): ProposedLifecycleStage[] {
  const hasHardware = specification.workstreams.includes("HARDWARE");
  const hasFirmware = specification.workstreams.includes("FIRMWARE");
  const hasMechanical = specification.workstreams.includes("MECHANICAL");
  const hasTest = specification.workstreams.includes("TEST");
  const hasManufacturing = specification.workstreams.includes("MANUFACTURING");
  const isProductionExcluded = isKnown(specification.optional.volumes) && ["none", "0", "zero", "n/a"].includes(specification.optional.volumes.toLowerCase().trim());
  const hasProductionScope = hasManufacturing || !isProductionExcluded;
  const hasInterfaces = Boolean(isKnown(specification.optional.interfaces) || isKnown(specification.optional.connectivityAndGnss));
  const unknowns = Object.values(specification.optional).filter((value) => !isKnown(value)).length;
  const applicable = (condition: boolean, rationale: string): Pick<ProposedLifecycleStage, "state" | "exclusionRationale"> => condition
    ? { state: unknowns ? "PRELIMINARY" : "READY_FOR_CONFIGURATION", exclusionRationale: null }
    : { state: "NOT_APPLICABLE", exclusionRationale: rationale };

  return [
    { key: "intake", title: "Intake", responsibility: "Sales", prerequisites: ["Proposed name", "Customer or internal owner", "Requirement summary"], suggestedDocuments: ["Enquiry record", "Master Specification draft"], ...applicable(true, "") },
    { key: "feasibility", title: "Feasibility", responsibility: "Sales with affected engineering leads", prerequisites: ["Scope", "Affected workstreams", "Unknowns recorded"], suggestedDocuments: ["Feasibility review"], ...applicable(true, "") },
    { key: "baseline", title: "Baseline", responsibility: "Sales and requirement owner", prerequisites: ["Customer requirement revision", "Human approval"], suggestedDocuments: ["Requirement baseline"], ...applicable(true, "") },
    { key: "poc", title: "POC", responsibility: "Engineering lead", prerequisites: ["Baseline", "Applicable workstream"], suggestedDocuments: ["POC plan", "Architecture note"], ...applicable(hasHardware || hasFirmware || hasMechanical, "No engineering workstream is selected.") },
    { key: "pilot", title: "Pilot", responsibility: "Engineering and operations", prerequisites: ["Applicable prototype scope", "Build inputs"], suggestedDocuments: ["Pilot build plan", "Pilot review"], ...applicable(hasHardware || hasMechanical || hasFirmware, "No product development workstream is selected.") },
    { key: "validation", title: "Validation & precompliance", responsibility: "Test / Quality", prerequisites: ["Applicable requirements", "Test scope"], suggestedDocuments: ["Validation plan", "Precompliance plan"], ...applicable(hasTest || hasHardware || hasMechanical || hasInterfaces, "No validation-relevant workstream or interface is selected.") },
    { key: "final-release", title: "Final release", responsibility: "Engineering and Quality", prerequisites: ["Controlled evidence", "Human release decision"], suggestedDocuments: ["Release checklist", "Controlled release record"], ...applicable(hasHardware || hasFirmware || hasMechanical, "No engineering release is in scope.") },
    { key: "readiness", title: "Readiness", responsibility: "Operations, Procurement and Production", prerequisites: ["Verified production scope", "Revision-linked sources"], suggestedDocuments: ["Readiness review", "Sourcing plan"], ...applicable(hasProductionScope, "Production scope is not yet confirmed.") },
    { key: "production-service", title: "Production, dispatch & service", responsibility: "Production, Operations and Service", prerequisites: ["Verified production scope", "Human authorization", "Released controlled records"], suggestedDocuments: ["Dispatch plan", "Service handover"], ...applicable(hasProductionScope, "Production scope is not yet confirmed.") },
  ];
}

export function hasCompleteProposedProjectCore(specification: ProposedProjectSpecification) {
  return Boolean(
    specification.proposedName.trim()
    && specification.customerOrInternalOwner.trim()
    && specification.industryApplication.trim()
    && specification.productFamily.trim()
    && specification.developmentScope.trim()
    && specification.workstreams.length
    && specification.requirementSummary.trim(),
  );
}
