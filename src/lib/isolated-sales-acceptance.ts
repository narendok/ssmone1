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
      { key: "rpc", available: false, detail: "The existing caller-authenticated transport is available to this preflight; the isolated backend is missing the pending application RPCs, so no accepted caller-RPC case can run there." },
      { key: "rollback", available: false, detail: "Audit-failure rollback requires a disposable caller-authenticated fixture boundary." },
      { key: "concurrency", available: false, detail: "Two independent approved caller sessions are required for concurrent replay and expected-version races." },
    ],
    blockedOperations: [
      "No mutation runner is exposed until the read-only preflight has approved scoped caller identities and application-RPC execution.",
      "Non-admin caller-RLS proof remains blocked; service-role or sandbox bypass execution is not accepted as evidence.",
    ],
  };
}