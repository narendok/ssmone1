import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelectedProjectBomReview } from "./SelectedProjectBomReview";

const boms = [{ id: "4fabe830-793e-48e6-828e-450d08a7eb85", bom_number: "BOM-2026-0002", name: "Emulator V2.0 TCU Test Jig", source_filename: null, revision: "2", notes: null, line_count: 52, total_cost: null, created_at: "2026-09-28T01:41:43.991Z", source_drive_node_id: null, source_drive_revision_id: null }];

describe("selected project saved BOM review", () => {
  it("shows the exact saved BOM and its read-only detail route", () => {
    const markup = renderToStaticMarkup(<SelectedProjectBomReview projectName="Emulator_V2.0 TCU Test Jig" boms={boms} loading={false} error={null} />);
    expect(markup).toContain("BOM-2026-0002"); expect(markup).toContain("52 saved lines"); expect(markup).toContain("not linked / unsupported"); expect(markup).toContain("/bom?loadBom=4fabe830-793e-48e6-828e-450d08a7eb85%26readOnly=true"); expect(markup).toContain("Review saved BOM");
  });
  it("does not present an unavailable saved BOM as an empty success", () => {
    const markup = renderToStaticMarkup(<SelectedProjectBomReview projectName="Emulator_V2.0 TCU Test Jig" boms={[]} loading={false} error={new Error("Access denied")} />);
    expect(markup).toContain("could not be read: Access denied"); expect(markup).not.toContain("Review saved BOM");
  });
});