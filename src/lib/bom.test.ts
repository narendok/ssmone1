import { describe, expect, it } from "vitest";
import { calculatedLineCost, guessMapping, hasTotalCostMismatch, parseCost, toLines } from "./bom";

const headers = [
  "Comment(value)", "Manufacturer-Part-Number", "Manufacturer", "Description", "Designator",
  "Footprint", "Quantity", "Remark", "Unit-Cost", "Total-Cost",
];

describe("project BOM import", () => {
  it("maps the standard header without confusing manufacturer and MPN", () => {
    expect(guessMapping(headers)).toEqual({
      value: "Comment(value)", mpn: "Manufacturer-Part-Number", manufacturer: "Manufacturer",
      description: "Description", refs: "Designator", footprint: "Footprint", quantity: "Quantity",
      remark: "Remark", unitCost: "Unit-Cost", totalCost: "Total-Cost",
    });
  });

  it("parses currency values and preserves blank costs", () => {
    expect(parseCost("₹1,234.50")).toBe(1234.5);
    expect(parseCost("$ 0.08")).toBe(0.08);
    expect(parseCost(12.5)).toBe(12.5);
    expect(parseCost("")).toBeNull();
  });

  it("keeps project quantity, remarks, and costs distinct", () => {
    const mapping = guessMapping(headers);
    const [line] = toLines([{
      "Comment(value)": "10k", "Manufacturer-Part-Number": "RC0603", Manufacturer: "Yageo",
      Description: "Resistor", Designator: "R1,R2,R3", Footprint: "0603", Quantity: "3",
      Remark: "Production", "Unit-Cost": "₹0.08", "Total-Cost": "0.24",
    }], mapping);
    expect(line).toMatchObject({ quantity: 3, value: "10k", refs: "R1,R2,R3", remark: "Production", unitCost: 0.08, totalCost: 0.24 });
    expect(calculatedLineCost(line)).toBe(0.24);
    expect(hasTotalCostMismatch(line)).toBe(false);
    expect(hasTotalCostMismatch({ ...line, totalCost: 0.3 })).toBe(true);
  });
});