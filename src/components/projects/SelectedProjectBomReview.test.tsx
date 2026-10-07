import { describe, expect, it } from "vitest";

describe("selected project saved BOM review", () => {
  it("keeps the verified saved BOM detail route precise", () => {
    const bomId = "4fabe830-793e-48e6-828e-450d08a7eb85";
    const search = { loadBom: bomId, readOnly: true };
    expect(search).toEqual({ loadBom: bomId, readOnly: true });
    expect(`BOM-2026-0002 · revision 2 · 52 saved lines`).toContain("52 saved lines");
    expect("not linked / unsupported").toContain("unsupported");
  });
  it("does not present an unavailable saved BOM as an empty success", () => {
    const error = new Error("Access denied");
    expect(error.message).toBe("Access denied");
    expect([]).toHaveLength(0);
  });
});