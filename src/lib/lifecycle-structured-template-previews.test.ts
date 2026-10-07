import { describe, expect, it } from "vitest";
import { renderStructuredLifecycleTemplatePreview, structuredLifecycleTemplatePreviews } from "./lifecycle-structured-template-previews";

describe("structured lifecycle template previews", () => {
  it("defines distinct SOR, Contract Review, and PRS structures", () => {
    expect(structuredLifecycleTemplatePreviews.map((template) => template.kind)).toEqual(["SOR", "CONTRACT_REVIEW", "PRS"]);
    expect(renderStructuredLifecycleTemplatePreview("SOR").content).toContain("1. Scope");
    expect(renderStructuredLifecycleTemplatePreview("CONTRACT_REVIEW").content).toContain("| Review item | Source value | Review disposition |");
    expect(renderStructuredLifecycleTemplatePreview("PRS").content).toContain("| ID | Requirement | Source | Verification | Status |");
  });

  it("keeps unknown source values visibly TBC and never infers authorization", () => {
    const contractReview = renderStructuredLifecycleTemplatePreview("CONTRACT_REVIEW").content;
    expect(contractReview).toContain("TBC");
    expect(contractReview).toContain("No customer authorization is inferred");
  });

  it("substitutes user edits once and preserves HTML as literal text", () => {
    const rendered = renderStructuredLifecycleTemplatePreview("SOR", {
      SCOPE_STATEMENT: "<img src=x onerror=alert(1)> {{PROJECT_CODE}}",
      ACCEPTANCE_CRITERIA: "Inspection only",
    }).content;
    expect(rendered).toContain("<img src=x onerror=alert(1)> {{PROJECT_CODE}}");
    expect(rendered).not.toContain("<img src=x onerror=alert(1)> TBC");
  });

  it("fails closed when a required editable field is missing", () => {
    expect(() => renderStructuredLifecycleTemplatePreview("PRS", { FUNCTIONAL_REQUIREMENT: null })).toThrow("FUNCTIONAL_REQUIREMENT");
  });
});