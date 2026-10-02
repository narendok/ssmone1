import { describe, expect, it } from "vitest";
import { buildDepartmentDriveNavigation } from "./department-drive-navigation";

describe("department Drive navigation", () => {
  it("always returns the three governed category placements", () => {
    const entries = buildDepartmentDriveNavigation([{ id: "common", department_id: "dept", placement: "COMMON", label: "Standards", slug: "standards", linked_work_area: null, sort_order: 1, is_active: true, created_at: "", updated_at: "" }]);
    expect(entries.map((entry) => entry.placement)).toEqual(["COMMON", "INTERNAL_PROJECT", "CLIENT_PROJECT"]);
    expect(entries[0]?.categoryIds).toEqual(["common"]);
    expect(entries[1]?.categoryCount).toBe(0);
  });

  it("does not expose inactive metadata in read navigation", () => {
    const entries = buildDepartmentDriveNavigation([{ id: "archived", department_id: "dept", placement: "CLIENT_PROJECT", label: "Archived", slug: "archived", linked_work_area: null, sort_order: 1, is_active: false, created_at: "", updated_at: "" }]);
    expect(entries[2]?.categoryCount).toBe(0);
  });
});