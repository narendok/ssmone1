import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormattedPreview } from "./StructuredTemplatePreview";
import { mapMasterSpecificationSource, serializeLocalTableRows, structuredLifecycleTemplatePreviews } from "@/lib/lifecycle-structured-template-previews";

const source = mapMasterSpecificationSource({ opportunityId: "opportunity-id", opportunityNumber: "OPPORTUNITY-2026-0013", opportunityName: "Tracker", customerId: "customer-id", customerName: "SAMPLE ONLY", specificationId: "specification-id", specificationNumber: "MASTER-2026-0001", versionId: "version-id", versionNumber: 1, changeSummary: "Initial intake", savedAt: "2026-10-05T18:37:27.589Z", project: null, specificationData: {} });
const bomRows = serializeLocalTableRows([{ id: "bom-1", itemNumber: "1", mpn: "TBC", manufacturer: "TBC", description: "Local board", package: "TBC", quantity: "0", leadTime: "TBC", unitCost: "0", currency: "SEK", aecqEvidence: "TBC" }]);
const quoteRows = serializeLocalTableRows([{ id: "quote-1", line: "1", description: "Prototype <img src=x onerror=alert(1)>", quantity: "20", unitPrice: "0", currency: "SEK", leadTime: "TBC" }]);
const tierRows = serializeLocalTableRows([{ id: "tier-1", minQuantity: "1", maxQuantity: "20", unitPrice: "0" }]);

describe("formatted structured template preview", () => {
  const authoritativeBom = {
    id: "bom-2026-0002-id",
    bom_number: "BOM-2026-0002",
    name: "BOM_Emulator_V2.0 for procurement",
    source_filename: null,
    revision: "2",
    notes: null,
    line_count: 52,
    total_cost: 0,
    created_at: "2026-09-28T01:41:43.991Z",
    source_drive_node_id: null,
    source_drive_revision_id: null,
  };

  it("renders every typed table through the actual formatted-preview component", () => {
    const bomItem = structuredLifecycleTemplatePreviews.find((item) => item.kind === "BOM_COST_TRACKER");
    const quoteItem = structuredLifecycleTemplatePreviews.find((item) => item.kind === "COMMERCIAL_QUOTATION");
    if (!bomItem || !quoteItem) throw new Error("Expected table preview definitions.");
    const bomPreview = renderToStaticMarkup(<FormattedPreview item={bomItem} source={source} userEdits={{ "BOM_COST_TRACKER:BOM_COST_ROWS": bomRows, "BOM_COST_TRACKER:LOCAL_COST_TOTAL": "999", "BOM_COST_TRACKER:COST_RISK_NOTES": "TBC" }} error={null} controlledText="TBC" />);
    expect(bomPreview).toContain("BOM cost rows · local review only");
    expect(bomPreview).toContain("Local board");
    expect(bomPreview).toContain(">0<");
    expect(bomPreview).toContain("manual / unverified");
    const quotePreview = renderToStaticMarkup(<FormattedPreview item={quoteItem} source={source} userEdits={{ "COMMERCIAL_QUOTATION:QUOTE_LINE_ROWS": quoteRows, "COMMERCIAL_QUOTATION:VOLUME_TIER_ROWS": tierRows, "COMMERCIAL_QUOTATION:NRE_AMOUNT": "TBC", "COMMERCIAL_QUOTATION:TOOLING_AMOUNT": "TBC", "COMMERCIAL_QUOTATION:PAYMENT_TERMS": "TBC", "COMMERCIAL_QUOTATION:LEAD_TIME": "TBC" }} error={null} controlledText="TBC" />);
    expect(quotePreview).toContain("Prototype &lt;img src=x onerror=alert(1)&gt;");
    expect(quotePreview).toContain("Volume tiers · provisional");
    expect(quotePreview).toContain(">0<");
  });

  it("renders row-level errors and removes them after recovery", () => {
    const bomItem = structuredLifecycleTemplatePreviews.find((item) => item.kind === "BOM_COST_TRACKER");
    if (!bomItem) throw new Error("Expected BOM preview definition.");
    const invalidRows = serializeLocalTableRows([{ id: "bad", itemNumber: "2", mpn: "TBC", manufacturer: "TBC", description: "Bad row", package: "TBC", quantity: "-1", leadTime: "TBC", unitCost: "0", currency: "SEK", aecqEvidence: "TBC" }]);
    const invalidPreview = renderToStaticMarkup(<FormattedPreview item={bomItem} source={source} userEdits={{ "BOM_COST_TRACKER:BOM_COST_ROWS": invalidRows, "BOM_COST_TRACKER:LOCAL_COST_TOTAL": "TBC", "BOM_COST_TRACKER:COST_RISK_NOTES": "TBC" }} error={null} controlledText="TBC" />);
    expect(invalidPreview).toContain("Invalid input");
    expect(invalidPreview).toContain("Quantity must be a non-negative finite number or TBC.");
    const recoveredPreview = renderToStaticMarkup(<FormattedPreview item={bomItem} source={source} userEdits={{ "BOM_COST_TRACKER:BOM_COST_ROWS": bomRows, "BOM_COST_TRACKER:LOCAL_COST_TOTAL": "TBC", "BOM_COST_TRACKER:COST_RISK_NOTES": "TBC" }} error={null} controlledText="TBC" />);
    expect(recoveredPreview).not.toContain("Quantity must be a non-negative finite number or TBC.");
  });

  it("renders DFMEA, control-plan, and DVP&R typed local tables with TBC and safe literal output", () => {
    const dfmeaItem = structuredLifecycleTemplatePreviews.find((item) => item.kind === "DFMEA");
    const controlItem = structuredLifecycleTemplatePreviews.find((item) => item.kind === "MANUFACTURING_CONTROL_PLAN");
    const dvprItem = structuredLifecycleTemplatePreviews.find((item) => item.kind === "DVPR");
    if (!dfmeaItem || !controlItem || !dvprItem) throw new Error("Expected new preview definitions.");
    const dfmea = serializeLocalTableRows([{ id: "risk", function: "Power <img src=x>", failureMode: "TBC", effect: "TBC", cause: "TBC", preventionControl: "TBC", detectionControl: "TBC", severity: "10", occurrence: "2", detection: "3", owner: "TBC", action: "TBC" }]);
    const control = serializeLocalTableRows([{ id: "control", processStep: "Assembly", characteristic: "TBC", specification: "TBC", method: "TBC", equipment: "TBC", sampleFrequency: "TBC", reactionPlan: "TBC", owner: "TBC" }]);
    const dvpr = serializeLocalTableRows([{ id: "dvpr", test: "CAN verification", applicability: "TBC", sampleCount: "TBC", acceptanceCriteria: "TBC", result: "TBC", evidence: "TBC", standardsReference: "Customer-requested reference only" }]);
    expect(renderToStaticMarkup(<FormattedPreview item={dfmeaItem} source={source} userEdits={{ "DFMEA:DFMEA_ROWS": dfmea, "DFMEA:DFMEA_REVIEW_NOTE": "TBC" }} error={null} controlledText="TBC" />)).toContain("Power &lt;img src=x&gt;");
    expect(renderToStaticMarkup(<FormattedPreview item={controlItem} source={source} userEdits={{ "MANUFACTURING_CONTROL_PLAN:CONTROL_PLAN_ROWS": control, "MANUFACTURING_CONTROL_PLAN:CONTROL_PLAN_NOTE": "TBC" }} error={null} controlledText="TBC" />)).toContain("Control-plan rows");
    expect(renderToStaticMarkup(<FormattedPreview item={dvprItem} source={source} userEdits={{ "DVPR:DVPR_ROWS": dvpr, "DVPR:DVPR_REVIEW_NOTE": "TBC" }} error={null} controlledText="TBC" />)).toContain("Customer-requested reference only");
  });
});