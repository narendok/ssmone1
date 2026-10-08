import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ISOLATED_SALES_ACCEPTANCE_PROJECT_REF,
  ORIGINAL_SALES_PROJECT_REF,
  isolatedSalesAcceptancePreflight,
} from "./isolated-sales-acceptance";

const isolatedUrl = `https://${ISOLATED_SALES_ACCEPTANCE_PROJECT_REF}.supabase.co`;
const originalUrl = `https://${ORIGINAL_SALES_PROJECT_REF}.supabase.co`;

describe("isolated Sales acceptance runner boundary", () => {
  it("allows only a configured, matching isolated backend and exposes no live mutation path", () => {
    const isolated = isolatedSalesAcceptancePreflight(ISOLATED_SALES_ACCEPTANCE_PROJECT_REF, isolatedUrl);
    expect(isolated.target).toBe("isolated");
    expect(isolated.available).toBe(false);
    expect(isolated.checks.find((check) => check.key === "target")?.available).toBe(true);
    expect(isolated.blockedOperations.join(" ")).toContain("service-role");

    const original = isolatedSalesAcceptancePreflight(ORIGINAL_SALES_PROJECT_REF, originalUrl);
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
    expect(facade).toContain('process.env["SUPABASE_URL"]');
  });

  it("does not certify identity or RPC availability from a configured isolated target", () => {
    const report = isolatedSalesAcceptancePreflight(ISOLATED_SALES_ACCEPTANCE_PROJECT_REF, isolatedUrl);
    expect(report.caller).toEqual({ transport: "authenticated-server-function", identity: "unverified" });
    expect(report.checks.find((check) => check.key === "rpc")?.detail).toContain("unverified");
  });

  it("lists every missing caller-transport prerequisite without offering a mutation path", () => {
    const report = isolatedSalesAcceptancePreflight(ISOLATED_SALES_ACCEPTANCE_PROJECT_REF, isolatedUrl);
    for (const key of ["sales-caller", "reviewer-caller", "wrong-actor-caller", "rpc", "transport", "observability", "rollback", "concurrency"]) {
      expect(report.checks.find((check) => check.key === key)?.available).toBe(false);
    }
    expect(report.blockedOperations.join(" ")).toContain("No mutation runner");
  });

  it("refuses an isolated claim when the configured backend is original", () => {
    const report = isolatedSalesAcceptancePreflight(ISOLATED_SALES_ACCEPTANCE_PROJECT_REF, originalUrl);
    expect(report.target).toBe("original");
    expect(report.checks.find((check) => check.key === "target")?.available).toBe(false);
    expect(report.checks.find((check) => check.key === "target")?.detail).toContain("does not match");
  });

  it("blocks malformed configured backend identity without certifying the caller request", () => {
    const report = isolatedSalesAcceptancePreflight(ISOLATED_SALES_ACCEPTANCE_PROJECT_REF, "https://not-a-project.example.test");
    expect(report.target).toBe("unknown");
    expect(report.checks.find((check) => check.key === "target")?.available).toBe(false);
    expect(report.checks.find((check) => check.key === "target")?.detail).toContain("malformed");
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