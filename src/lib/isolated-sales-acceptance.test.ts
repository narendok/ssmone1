import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ISOLATED_SALES_ACCEPTANCE_PROJECT_REF,
  ORIGINAL_SALES_PROJECT_REF,
  isolatedSalesAcceptancePreflight,
} from "./isolated-sales-acceptance";

describe("isolated Sales acceptance runner boundary", () => {
  it("allows only the known isolated backend and exposes no live mutation path", () => {
    const isolated = isolatedSalesAcceptancePreflight(ISOLATED_SALES_ACCEPTANCE_PROJECT_REF);
    expect(isolated.target).toBe("isolated");
    expect(isolated.available).toBe(false);
    expect(isolated.checks.find((check) => check.key === "target")?.available).toBe(true);
    expect(isolated.blockedOperations.join(" ")).toContain("service-role");

    const original = isolatedSalesAcceptancePreflight(ORIGINAL_SALES_PROJECT_REF);
    expect(original.target).toBe("original");
    expect(original.checks.find((check) => check.key === "target")?.available).toBe(false);
  });

  it("keeps the server facade authenticated and read-only", () => {
    const facade = readFileSync("src/lib/isolated-sales-acceptance.functions.ts", "utf8");
    expect(facade).toContain("requireSupabaseAuth");
    expect(facade).toContain("getIsolatedSalesAcceptancePreflight");
    expect(facade).not.toContain("client.server");
    expect(facade).not.toContain(".rpc(");
    expect(facade).not.toContain(".insert(");
    expect(facade).not.toContain(".update(");
  });
});