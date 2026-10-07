import { describe, expect, it } from "vitest";
import { mapMasterSpecificationSource, renderStructuredLifecycleTemplatePreview, structuredLifecycleTemplatePreviews } from "./lifecycle-structured-template-previews";

const source = mapMasterSpecificationSource({ opportunityId: "opportunity-id", opportunityNumber: "OPPORTUNITY-2026-0013", opportunityName: "Tracker <script>alert(1)</script>", customerId: "customer-id", customerName: "SAMPLE ONLY", specificationId: "specification-id", specificationNumber: "MASTER-2026-0001", versionId: "version-id", versionNumber: 1, changeSummary: "Initial intake", savedAt: "2026-10-05T18:37:27.589Z", specificationData: { requirementSummary: "24V tracker", powerAndUnits: "12/24V nominal input", interfaces: "CAN requested", environmentAndIp: "" } });

describe("structured lifecycle template previews", () => {
  it("defines distinct SOR, Contract Review, and PRS structures", () => {
    expect(structuredLifecycleTemplatePreviews.map((template) => template.kind)).toEqual(["SOR", "CONTRACT_REVIEW", "PRS"]);
    expect(renderStructuredLifecycleTemplatePreview("SOR", source).content).toContain("2. Scope");
    expect(renderStructuredLifecycleTemplatePreview("CONTRACT_REVIEW", source).content).toContain("| Review item | Verified source | Local review |");
    expect(renderStructuredLifecycleTemplatePreview("PRS", source).content).toContain("| ID | Requirement | Source / constraint | Verification | Status |");
  });

  it("keeps unknown source values visibly TBC and never infers authorization", () => {
    const contractReview = renderStructuredLifecycleTemplatePreview("CONTRACT_REVIEW", source).content;
    expect(contractReview).toContain("TBC");
    expect(contractReview).toContain("Customer authorization: TBC (not inferred).");
  });

  it("substitutes user edits once and preserves HTML as literal text", () => {
    const rendered = renderStructuredLifecycleTemplatePreview("SOR", source, {
      SCOPE_STATEMENT: "<img src=x onerror=alert(1)> {{PROJECT_CODE}}",
      ACCEPTANCE_CRITERIA: "Inspection only",
    }).content;
    expect(rendered).toContain("<img src=x onerror=alert(1)> {{PROJECT_CODE}}");
    expect(rendered).not.toContain("<img src=x onerror=alert(1)> TBC");
  });

  it("fails closed when a required editable field is missing", () => {
    expect(() => renderStructuredLifecycleTemplatePreview("PRS", source, { FUNCTIONAL_REQUIREMENT: null })).toThrow("FUNCTIONAL_REQUIREMENT");
  });

  it("maps the exact pinned Master Specification source and preserves literal injected text", () => {
    const rendered = renderStructuredLifecycleTemplatePreview("SOR", source).content;
    expect(rendered).toContain("OPPORTUNITY-2026-0013");
    expect(rendered).toContain("MASTER-2026-0001 rev 1");
    expect(rendered).toContain("Tracker <script>alert(1)</script>");
    expect(source.sourceFields.ENVIRONMENT_AND_IP).toBe("TBC");
  });

  it("keeps different document schema fields type-specific", () => {
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "SOR")?.editableFields.map((field) => field.key)).toEqual(["SCOPE_STATEMENT", "ACCEPTANCE_CRITERIA"]);
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "CONTRACT_REVIEW")?.editableFields.map((field) => field.key)).toEqual(["COMMITMENT_SUMMARY", "EXCEPTIONS_AND_ACTIONS"]);
    expect(structuredLifecycleTemplatePreviews.find((item) => item.kind === "PRS")?.editableFields.map((field) => field.key)).toEqual(["FUNCTIONAL_REQUIREMENT", "VERIFICATION_METHOD"]);
  });
});