import { describe, expect, it } from "vitest";
import { buildDepartmentDriveTaxonomy, isAllowedDepartmentDriveRoot } from "./department-drive-navigation";

const categories = [
  { id: "common", placement: "COMMON", is_active: true },
  { id: "internal", placement: "INTERNAL_PROJECT", is_active: true },
  { id: "client", placement: "CLIENT_PROJECT", is_active: true },
  { id: "inactive", placement: "COMMON", is_active: false },
] as any;

describe("department Drive final taxonomy", () => {
  it("maps the final three categories without treating project class as a category", () => {
    const result = buildDepartmentDriveTaxonomy([
      { id: "standards", folder_kind: "DEPARTMENT_STANDARDS" },
      { id: "internal-root", folder_kind: "INTERNAL_PROJECTS" },
      { id: "client-root", folder_kind: "CLIENT_PROJECTS" },
    ], categories);
    expect(result.map((entry) => entry.label)).toEqual([
      "Common Controlled Documents",
      "Periodic and Conditional Reviews",
      "Project Deliverables",
    ]);
    expect(result[2]).toMatchObject({ mappedFolderId: "internal-root", categoryIds: ["internal", "client"] });
  });

  it("reports missing authoritative roots instead of guessing or moving historical folders", () => {
    const result = buildDepartmentDriveTaxonomy([], categories);
    expect(result.every((entry) => entry.mappingState === "unmapped")).toBe(true);
  });

  it("allows only the verified department/project root keys", () => {
    expect(isAllowedDepartmentDriveRoot("DEPARTMENT_STANDARDS")).toBe(true);
    expect(isAllowedDepartmentDriveRoot("CLIENT_PROJECTS")).toBe(true);
    expect(isAllowedDepartmentDriveRoot("HR_PRIVATE")).toBe(false);
  });
});
