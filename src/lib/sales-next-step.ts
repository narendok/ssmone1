export type SalesNextStepInput = {
  nextAction: string | null;
  masterSpecification: { specificationNumber: string; currentVersion: number } | null;
  linkedRequirement: { requirementNumber: string; status: string } | null;
  readError?: string | null;
  sourceContractAvailable: boolean;
};

export type SalesNextStepGuidance = {
  kind: "SUPPLIED" | "READ_UNAVAILABLE" | "MASTER_MISSING" | "REQUIREMENT_UNLINKED" | "REQUIREMENT_LINKED";
  message: string;
  sourceContractNote: string | null;
};

const pendingContractNote = "Requirement and baseline actions remain unavailable pending protected server-contract acceptance.";

/** Read-only Sales guidance. It never substitutes an operator's supplied next action. */
export function getSalesNextStepGuidance(input: SalesNextStepInput): SalesNextStepGuidance {
  const suppliedAction = input.nextAction?.trim();
  if (suppliedAction) return { kind: "SUPPLIED", message: suppliedAction, sourceContractNote: null };

  if (input.readError?.trim()) {
    return { kind: "READ_UNAVAILABLE", message: "Next-step records are unavailable because the Sales read could not be verified.", sourceContractNote: null };
  }

  if (!input.masterSpecification) {
    return { kind: "MASTER_MISSING", message: "No Master Specification is linked to this opportunity.", sourceContractNote: null };
  }

  const source = `Master Specification ${input.masterSpecification.specificationNumber} · rev ${input.masterSpecification.currentVersion}`;
  if (!input.linkedRequirement) {
    return {
      kind: "REQUIREMENT_UNLINKED",
      message: `Review ${source}; no controlled requirement is linked to this opportunity.`,
      sourceContractNote: input.sourceContractAvailable ? null : pendingContractNote,
    };
  }

  return {
    kind: "REQUIREMENT_LINKED",
    message: `Review linked controlled requirement ${input.linkedRequirement.requirementNumber} (${input.linkedRequirement.status.replaceAll("_", " ")}).`,
    sourceContractNote: input.sourceContractAvailable ? null : pendingContractNote,
  };
}