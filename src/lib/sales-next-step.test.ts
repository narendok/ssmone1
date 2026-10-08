import { describe, expect, it } from "vitest";
import { getSalesNextStepGuidance } from "./sales-next-step";

const master = { specificationNumber: "MASTER-2026-0001", currentVersion: 1 };

describe("Sales next-step guidance", () => {
  it("reports a missing Master Specification without inventing a next step", () => {
    expect(getSalesNextStepGuidance({ nextAction: null, masterSpecification: null, linkedRequirement: null, sourceContractAvailable: false })).toEqual({
      kind: "MASTER_MISSING", message: "No Master Specification is linked to this opportunity.", sourceContractNote: null,
    });
  });

  it("directs review of a pinned Master Specification when the controlled requirement is absent", () => {
    const result = getSalesNextStepGuidance({ nextAction: null, masterSpecification: master, linkedRequirement: null, sourceContractAvailable: false });
    expect(result.kind).toBe("REQUIREMENT_UNLINKED");
    expect(result.message).toContain("MASTER-2026-0001 · rev 1");
    expect(result.message).toContain("no controlled requirement is linked");
    expect(result.sourceContractNote).toContain("pending protected server-contract acceptance");
  });

  it("identifies an explicitly linked controlled requirement without treating it as approval", () => {
    const result = getSalesNextStepGuidance({ nextAction: null, masterSpecification: master, linkedRequirement: { requirementNumber: "REQ-2026-0001", status: "in_review" }, sourceContractAvailable: true });
    expect(result).toEqual({
      kind: "REQUIREMENT_LINKED", message: "Review linked controlled requirement REQ-2026-0001 (in review).", sourceContractNote: null,
    });
  });

  it("surfaces an unavailable Sales read without inferring any gate state", () => {
    expect(getSalesNextStepGuidance({ nextAction: null, masterSpecification: master, linkedRequirement: null, sourceContractAvailable: false, readError: "RLS read denied" })).toEqual({
      kind: "READ_UNAVAILABLE", message: "Next-step records are unavailable because the Sales read could not be verified.", sourceContractNote: null,
    });
  });

  it("preserves an operator-supplied next action", () => {
    expect(getSalesNextStepGuidance({ nextAction: "Call customer Thursday", masterSpecification: master, linkedRequirement: null, sourceContractAvailable: false })).toEqual({
      kind: "SUPPLIED", message: "Call customer Thursday", sourceContractNote: null,
    });
  });
});