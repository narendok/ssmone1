import { describe, expect, it } from "vitest";
import { guessInventoryMapping, isInventoryDraftValid, refreshInventoryDraftWarnings, toInventoryDraftRows } from "./inventory-csv-import";

const categories = [{ id: "category-resistors", label: "Passive > Resistors" }];
const parts = [{
  id: "component-1", name: "10k resistor", part_number: "RC0603FR-0710KL", manufacturer: "Yageo", footprint: "0603", package_case: "0603", value: null,
  supplier_url: null, datasheet_url: null, low_stock_threshold: 5, total_quantity: 2,
}];

describe("inventory CSV review", () => {
  it("maps flexible inventory headers with confidence", () => {
    const result = guessInventoryMapping(["Stock number", "Description", "Qty", "Bin", "Minimum qty", "Datasheet URL"]);
    expect(result.mapping).toMatchObject({ partNumber: "Stock number", name: "Description", quantity: "Qty", location: "Bin", lowStockThreshold: "Minimum qty", datasheetUrl: "Datasheet URL" });
    expect(result.confidence.partNumber).toBe("high");
  });

  it("builds an editable existing-stock draft row", () => {
    const { mapping } = guessInventoryMapping(["MPN", "Name", "Manufacturer", "Category", "On hand", "Store", "Low stock threshold"]);
    const [row] = toInventoryDraftRows([{
      MPN: "RC0603FR-0710KL", Name: "10k resistor", Manufacturer: "Yageo", Category: "Resistors", "On hand": "25", Store: "Rack B3", "Low stock threshold": "5",
    }], mapping, parts, categories);
    expect(row).toMatchObject({ existingComponentId: "component-1", quantity: 25, locationType: "bin", locationLabel: "Rack B3", categoryId: "category-resistors" });
    expect(isInventoryDraftValid(row)).toBe(true);
  });

  it("blocks incomplete and duplicate rows from approval", () => {
    const { mapping } = guessInventoryMapping(["Part number", "Name", "Qty", "Bin"]);
    const rows = toInventoryDraftRows([
      { "Part number": "NEW-1", Name: "New part", Qty: "", Bin: "A1" },
      { "Part number": "NEW-1", Name: "New part", Qty: "2", Bin: "A1" },
    ], mapping, [], categories);
    expect(isInventoryDraftValid(rows[0])).toBe(false);
    expect(rows[1].warnings).toContain("Duplicate part number in this file");
    expect(isInventoryDraftValid(rows[1])).toBe(false);
  });

  it("keeps duplicate protection when a reviewer edits a row", () => {
    const { mapping } = guessInventoryMapping(["Part number", "Name", "Qty", "Bin"]);
    const rows = toInventoryDraftRows([
      { "Part number": "A-1", Name: "Part A", Qty: "2", Bin: "A1" },
      { "Part number": "B-1", Name: "Part B", Qty: "2", Bin: "A1" },
    ], mapping, [], categories);
    const revised = refreshInventoryDraftWarnings(rows.map((row) => row.key === 1 ? { ...row, partNumber: "A-1" } : row));
    expect(revised.every((row) => !isInventoryDraftValid(row))).toBe(true);
  });

  it("requires a category before a new component can be approved", () => {
    const { mapping } = guessInventoryMapping(["Part number", "Name", "Qty", "Bin"]);
    const [row] = toInventoryDraftRows([{ "Part number": "NEW-2", Name: "New part", Qty: "3", Bin: "A1" }], mapping, [], categories);
    expect(row.warnings).toContain("Category is required");
    expect(isInventoryDraftValid(row)).toBe(false);
  });
});