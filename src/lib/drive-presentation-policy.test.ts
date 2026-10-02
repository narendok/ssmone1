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

  it("does not make BOM queries for an unrelated department but preserves scoped project browsing", () => {
    expect(shouldRequestProjectBoms({ filter: "boms", department: department("FIN"), projectId: null })).toBe(false);
    expect(shouldRequestProjectBoms({ filter: "boms", department: department("FAC"), projectId: null })).toBe(false);
    expect(shouldRequestProjectBoms({ filter: "boms", department: department("RND"), projectId: null })).toBe(true);
    expect(shouldRequestProjectBoms({ filter: "boms", department: department("FIN"), projectId: "project-a" })).toBe(true);
    expect(shouldRequestProjectBoms({ filter: "all", department: department("RND"), projectId: null })).toBe(false);
  });
});