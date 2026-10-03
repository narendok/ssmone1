import { describe, expect, it } from "vitest";
import type { CanonicalDepartment } from "./tasks";
import { workspaceForDepartment } from "./department-workspace-navigation";

describe("canonical department workspaces", () => {
  it("maps the real department fields without requiring a retired department_type column", () => {
    const department: CanonicalDepartment = {
      id: "hardware-id",
      name: "Hardware & R&D",
      code: "RND",
      aliases: [],
    };

    expect(workspaceForDepartment(department)?.id).toBe("rnd");
  });
});