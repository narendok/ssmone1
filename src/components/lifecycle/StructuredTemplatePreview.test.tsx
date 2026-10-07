import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormattedPreview } from "./StructuredTemplatePreview";
import { mapMasterSpecificationSource, serializeLocalTableRows, structuredLifecycleTemplatePreviews } from "@/lib/lifecycle-structured-template-previews";

const source = mapMasterSpecificationSource({ opportunityId: "opportunity-id", opportunityNumber: "OPPORTUNITY-2026-0013", opportunityName: "Tracker", customerId: "customer-id", customerName: "SAMPLE ONLY", specificationId: "specification-id", specificationNumber: "MASTER-2026-0001", versionId: "version-id", versionNumber: 1, changeSummary: "Initial intake", savedAt: "2026-10-05T18:37:27.589Z", specificationData: {} });
const bomRows = serializeLocalTableRows([{ id: "bom-1", itemNumber: "1", mpn: "TBC", manufacturer: "TBC", description: "Local board", package: "TBC", quantity: "0", leadTime: "TBC", unitCost: "0", currency: "SEK", aecqEvidence: "TBC" }]);
const quoteRows = serializeLocalTableRows([{ id: "quote-1", line: "1", description: "Prototype <img src=x onerror=alert(1)>", quantity: "20", unitPrice: "0", currency: "SEK", leadTime: "TBC" }]);
const tierRows = serializeLocalTableRows([{ id: "tier-1", minQuantity: "1", maxQuantity: "20", unitPrice: "0" }]);

describe("formatted structured template preview", () => {
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
});