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
    expect(facade).toContain("context.userId");
  });

  it("distinguishes verified caller transport from the unavailable isolated contract", () => {
    const report = isolatedSalesAcceptancePreflight(ISOLATED_SALES_ACCEPTANCE_PROJECT_REF);
    expect(report.caller).toEqual({ transport: "authenticated-server-function", identity: "verified" });
    expect(report.checks.find((check) => check.key === "rpc")?.detail).toContain("pending application RPCs");
  });

  it("uses a connection-target allowlist before the shell runner can do any work", () => {
    const runner = readFileSync("supabase/pending/tests/run_client_requirement_intake_isolated_acceptance.sh", "utf8");
    expect(runner).toContain('ISOLATED_DATABASE_URL');
    expect(runner).toContain('"$ISOLATED_DATABASE_URL" == *"$ORIGINAL_PROJECT_REF"*');
    expect(runner).toContain('"$ISOLATED_DATABASE_URL" != *"$ISOLATED_PROJECT_REF"*');
    expect(runner).not.toContain("service_role");
    expect(runner).not.toContain("request.jwt.claim");
    expect(runner).not.toContain("psql ");
  });
});