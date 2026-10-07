import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthoritativeBomPanel, FormattedPreview } from "./StructuredTemplatePreview";
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

  it("shows the committed-project BOM with its exact revision, unknown costs, and zero preserved", () => {
    const markup = renderToStaticMarkup(<AuthoritativeBomPanel project={null} projectId="emulator-project" boms={[authoritativeBom]} loading={false} error={null} selectedBomId={authoritativeBom.id} onSelect={() => undefined} detail={{ header: { ...authoritativeBom, project_id: "emulator-project" }, items: [{ id: "line-1", bom_id: authoritativeBom.id, line_index: 1, mpn: "CC0603KRX7R9BB104", manufacturer: "Yageo", value: "0.1uF", description: "Capacitor", refs: "C1", footprint: "C0603", quantity: 5, remark: null, unit_cost: null, total_cost: 0, matched_component_id: null, match_status: "missing", shortage: 5, matched_part_number: null, matched_name: null }] }} detailLoading={false} detailError={null} />);
    expect(markup).toContain("BOM-2026-0002");
    expect(markup).toContain("rev 2");
    expect(markup).toContain("CC0603KRX7R9BB104");
    expect(markup).toContain("TBC");
    expect(markup).toContain(">0.00<");
    expect(markup).toContain("not linked / unsupported");
  });

  it("keeps proposals unassociated and renders a guarded foreign-BOM read failure", () => {
    const proposalMarkup = renderToStaticMarkup(<AuthoritativeBomPanel project={null} projectId={undefined} boms={[]} loading={false} error={null} selectedBomId={null} onSelect={() => undefined} detail={null} detailLoading={false} detailError={null} />);
    expect(proposalMarkup).toContain("No project-linked BOM yet");
    const denialMarkup = renderToStaticMarkup(<AuthoritativeBomPanel project={null} projectId="emulator-project" boms={[authoritativeBom]} loading={false} error={null} selectedBomId={authoritativeBom.id} onSelect={() => undefined} detail={null} detailLoading={false} detailError={new Error("This saved BOM does not belong to the selected project.")} />);
    expect(denialMarkup).toContain("does not belong to the selected project");
    expect(denialMarkup).toContain("stock remain unavailable");
  });

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