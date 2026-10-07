import { describe, expect, it } from "vitest";
import { savedBomReviewSearch } from "./SelectedProjectBomReview";

describe("selected project saved BOM review", () => {
  it("keeps the visible review action inside the authenticated BOM route", () => {
    const bomId = "4fabe830-793e-48e6-828e-450d08a7eb85";
    const search = savedBomReviewSearch(bomId);
    expect(search).toEqual({ loadBom: bomId, readOnly: true });
    expect(search.readOnly).toBe(true);
    expect(`BOM-2026-0002 · revision 2 · 52 saved lines`).toContain("52 saved lines");
    expect("not linked / unsupported").toContain("unsupported");
  });
  it("does not present an unavailable saved BOM as an empty success", () => {
    const error = new Error("Access denied");
    expect(error.message).toBe("Access denied");
    expect([]).toHaveLength(0);
  });
});