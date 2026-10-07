import { describe, expect, it } from "vitest";
import { mapMasterSpecificationSource, renderStructuredLifecycleTemplatePreview, structuredLifecycleTemplatePreviews } from "./lifecycle-structured-template-previews";

const source = mapMasterSpecificationSource({ opportunityId: "opportunity-id", opportunityNumber: "OPPORTUNITY-2026-0013", opportunityName: "Tracker <script>alert(1)</script>", customerId: "customer-id", customerName: "SAMPLE ONLY", specificationId: "specification-id", specificationNumber: "MASTER-2026-0001", versionId: "version-id", versionNumber: 1, changeSummary: "Initial intake", savedAt: "2026-10-05T18:37:27.589Z", specificationData: { requirementSummary: "24V tracker", powerAndUnits: "12/24V nominal input", interfaces: "CAN requested", connectivityAndGnss: "LTE/GNSS requested", environmentAndIp: "", volumes: "20 pilot units", requestedStandards: "", workstreams: ["HARDWARE", "FIRMWARE", "MECHANICAL"] } });

describe("structured lifecycle template previews", () => {
  it("defines distinct SOR, Contract Review, and PRS structures", () => {
    expect(structuredLifecycleTemplatePreviews.map((template) => template.kind)).toEqual(["SOR", "CONTRACT_REVIEW", "PRS"]);
    expect(renderStructuredLifecycleTemplatePreview("SOR", source).content).toContain("OEM requirements");
    expect(renderStructuredLifecycleTemplatePreview("CONTRACT_REVIEW", source).content).toContain("NOT APPROVED / TBC");
    expect(renderStructuredLifecycleTemplatePreview("PRS", source).content).toContain("Connectivity / GNSS");
  });

  it("keeps unknown source values visibly TBC and never infers authorization", () => {
    const contractReview = renderStructuredLifecycleTemplatePreview("CONTRACT_REVIEW", source).content;
    expect(contractReview).toContain("Customer authorization: NOT APPROVED / TBC (not inferred).");
    expect(contractReview.match(/NOT APPROVED \/ TBC/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("substitutes user edits once and preserves HTML as literal text", () => {
    const rendered = renderStructuredLifecycleTemplatePreview("SOR", source, { OEM_REQUIREMENT_ROWS: "<img src=x onerror=alert(1)> {{PROJECT_CODE}}", SCOPE_STATEMENT: "Source-derived scope", ACCEPTANCE_CRITERIA: "Inspection only", CAN_TELEMETRY_NOTES: "TBC", PILOT_ROLLOUT_NOTES: "TBC", COMMERCIAL_SLA_WARRANTY_DELIVERY: "TBC" }).content;
    expect(rendered).toContain("<img src=x onerror=alert(1)> {{PROJECT_CODE}}");
    expect(rendered).not.toContain("<img src=x onerror=alert(1)> OPPORTUNITY-2026-0013");
  });

  it("fails closed when a required editable field is missing", () => {
    expect(() => renderStructuredLifecycleTemplatePreview("PRS", source, { POWER_REQUIREMENT: null })).toThrow("POWER_REQUIREMENT");
  });

  it("maps requested Master Specification values exactly without inventing technical values", () => {
    const rendered = renderStructuredLifecycleTemplatePreview("PRS", source).content;
    expect(rendered).toContain("12/24V nominal input");
    expect(rendered).toContain("CAN requested");
    expect(rendered).toContain("LTE/GNSS requested");
    expect(rendered).toContain("20 pilot units");
    expect(source.sourceFields.ENVIRONMENT_AND_IP).toBe("TBC");
    expect(rendered).toContain("| PRS-006 | Components | TBC | TBC | TBC |");
  });

  it("keeps different document schema fields type-specific", () => {
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "SOR")?.editableFields.map((field) => field.key)).toContain("OEM_REQUIREMENT_ROWS");
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "CONTRACT_REVIEW")?.editableFields.map((field) => field.key)).toContain("HARDWARE_FEASIBILITY");
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "PRS")?.editableFields.map((field) => field.key)).toContain("CONNECTIVITY_REQUIREMENT");
  });

  it("keeps absent source values and malformed workstreams visibly TBC", () => {
    const incomplete = mapMasterSpecificationSource({ ...source, specificationData: { powerAndUnits: null, workstreams: ["HARDWARE", null] } });
    expect(incomplete.sourceFields.POWER_AND_UNITS).toBe("TBC");
    expect(incomplete.sourceFields.WORKSTREAMS).toBe("TBC");
    expect(renderStructuredLifecycleTemplatePreview("PRS", incomplete).content).toContain("| PRS-006 | Components | TBC | TBC | TBC |");
  });

  it("preserves local edits independently across document schemas", () => {
    const sor = renderStructuredLifecycleTemplatePreview("SOR", source, { OEM_REQUIREMENT_ROWS: "OEM-1 | tracker reporting | requested", SCOPE_STATEMENT: "TBC", ACCEPTANCE_CRITERIA: "TBC", CAN_TELEMETRY_NOTES: "TBC", PILOT_ROLLOUT_NOTES: "TBC", COMMERCIAL_SLA_WARRANTY_DELIVERY: "TBC" }).content;
    const prs = renderStructuredLifecycleTemplatePreview("PRS", source, { POWER_REQUIREMENT: "No change", INTERFACE_REQUIREMENT: "TBC", CONNECTIVITY_REQUIREMENT: "TBC", MECHANICAL_REQUIREMENT: "TBC", FIRMWARE_REQUIREMENT: "TBC", VERIFICATION_METHOD: "TBC" }).content;
    expect(sor).toContain("OEM-1 | tracker reporting | requested");
    expect(prs).not.toContain("OEM-1 | tracker reporting | requested");
  });
});