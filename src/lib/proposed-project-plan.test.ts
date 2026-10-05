import { describe, expect, it } from "vitest";
import { createProposedProjectPlan, hasCompleteProposedProjectCore, type ProposedProjectSpecification } from "./proposed-project-plan";

const base: ProposedProjectSpecification = {
  proposedName: "Tracker",
  customerOrInternalOwner: "Customer A",
  industryApplication: "Fleet monitoring",
  productFamily: "Vehicle tracker",
  developmentScope: "New hardware product",
  workstreams: ["HARDWARE", "TEST"],
  requirementSummary: "Track vehicle location and status.",
  optional: { powerAndUnits: "To be confirmed", interfaces: "Unknown", connectivityAndGnss: "GNSS", environmentAndIp: "Unknown", volumes: "Unknown", schedule: "Unknown", requestedStandards: "Unknown", exclusions: "Unknown" },
};

describe("createProposedProjectPlan", () => {
  it("keeps software out of a hardware-only plan", () => {
    const plan = createProposedProjectPlan(base);
    expect(plan).toHaveLength(9);
    expect(plan.find((stage) => stage.key === "poc")?.state).toBe("PRELIMINARY");
    expect(plan.every((stage) => !stage.suggestedDocuments.some((document) => /software/i.test(document)))).toBe(true);
  });

  it("marks production stages out of scope without manufacturing", () => {
    const plan = createProposedProjectPlan(base);
    expect(plan.find((stage) => stage.key === "production-service")).toMatchObject({ state: "NOT_APPLICABLE", exclusionRationale: expect.stringContaining("Manufacturing") });
  });

  it("keeps mixed tracker interfaces in the preliminary validation plan", () => {
    const plan = createProposedProjectPlan({ ...base, workstreams: ["HARDWARE", "FIRMWARE", "TEST"], optional: { ...base.optional, interfaces: "CAN", connectivityAndGnss: "GNSS/LTE" } });
    expect(plan.find((stage) => stage.key === "validation")?.state).toBe("PRELIMINARY");
  });

  it("requires the shared core before a specification may be persisted", () => {
    expect(hasCompleteProposedProjectCore(base)).toBe(true);
    expect(hasCompleteProposedProjectCore({ ...base, productFamily: "" })).toBe(false);
  });
});