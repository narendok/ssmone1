import { z } from "zod";

export const ISOLATED_SALES_ACCEPTANCE_PROJECT_REF = "egjotuxqguifnvdnflan";
export const ORIGINAL_SALES_PROJECT_REF = "yyrvduosyyaluifqvwkr";

export const isolatedSalesAcceptancePreflightSchema = z.object({
  projectRef: z.string().trim().min(1),
});

export type IsolatedSalesAcceptancePreflight = {
  available: boolean;
  target: "isolated" | "original" | "unknown";
  caller: { transport: "authenticated-server-function"; identity: "verified" };
  checks: Array<{ key: string; available: boolean; detail: string }>;
  blockedOperations: string[];
};

export function isolatedSalesAcceptancePreflight(projectRef: string): IsolatedSalesAcceptancePreflight {
  const target = projectRef === ISOLATED_SALES_ACCEPTANCE_PROJECT_REF
    ? "isolated"
    : projectRef === ORIGINAL_SALES_PROJECT_REF ? "original" : "unknown";
  const isIsolated = target === "isolated";

  return {
    available: false,
    target,
    caller: {
      transport: "authenticated-server-function",
      identity: "verified",
    },
    checks: [
      { key: "target", available: isIsolated, detail: isIsolated ? "Isolated acceptance backend allowlisted." : "Runner refuses every backend except the isolated acceptance backend." },
      { key: "caller", available: false, detail: "The caller-authenticated server-function transport is verified, but no approved scoped external-contact or assigned-reviewer identity is available on the isolated backend." },
      { key: "sales-caller", available: false, detail: "No approved non-admin Sales caller with sales.manage is available for the isolated backend." },
      { key: "reviewer-caller", available: false, detail: "No approved non-admin reviewer identity is active in the required department on the isolated backend." },
      { key: "wrong-actor-caller", available: false, detail: "No separately approved wrong-actor/wrong-customer caller exists to prove denial without changing identities." },
      { key: "rpc", available: false, detail: "The isolated backend does not contain the pending protected Master save, source-bound requirement, feasibility, commercial-save, or baseline RPCs." },
      { key: "transport", available: false, detail: "No approved authenticated application-RPC wrapper supplies caller tokens without service-role, direct SQL, or JWT-GUC impersonation." },
      { key: "observability", available: false, detail: "No approved read-only assertion endpoint exposes persisted IDs, receipt/history/audit counts, or transaction rollback evidence to the authenticated test callers." },
      { key: "rollback", available: false, detail: "Audit-failure rollback requires an approved isolated failure-injection fixture boundary and post-failure read assertions." },
      { key: "concurrency", available: false, detail: "Two independent approved authenticated sessions plus a deterministic overlap barrier are required for real source, reviewer, commercial, and baseline races." },
    ],
    blockedOperations: [
      "No mutation runner is exposed until the read-only preflight has approved scoped caller identities and application-RPC execution.",
      "Non-admin caller-RLS proof remains blocked; service-role or sandbox bypass execution is not accepted as evidence.",
    ],
  };
}