import { describe, expect, it } from "vitest";
import { canPresentProjectBoms, shouldRequestProjectBoms } from "./drive-presentation-policy";

const department = (code: string | null) => ({ code });

describe("Drive BOM presentation policy", () => {
  it("shows BOM browsing only for the authorized engineering, procurement, and production departments", () => {
    expect(canPresentProjectBoms(department("RND"))).toBe(true);
    expect(canPresentProjectBoms(department("PROC"))).toBe(true);
    expect(canPresentProjectBoms(department("PROD"))).toBe(true);
  });

  it("excludes Finance, HR, Facility/security, Sales, Operations, and unknown departments", () => {
    for (const code of ["FIN", "HR", "FAC", "SAL", "OPS", "HR_PRIVATE", null]) expect(canPresentProjectBoms(department(code))).toBe(false);
  });

  it("does not make BOM queries outside an authorized workspace, even when a project is selected", () => {
    for (const code of ["FIN", "HR", "FAC", "SAL", "OPS", "HR_PRIVATE", null]) {
      expect(shouldRequestProjectBoms({ filter: "boms", department: department(code) })).toBe(false);
    }
    expect(shouldRequestProjectBoms({ filter: "boms", department: department("RND") })).toBe(true);
    expect(shouldRequestProjectBoms({ filter: "boms", department: department("PROC") })).toBe(true);
    expect(shouldRequestProjectBoms({ filter: "boms", department: department("PROD") })).toBe(true);
    expect(shouldRequestProjectBoms({ filter: "all", department: department("RND") })).toBe(false);
  });
});