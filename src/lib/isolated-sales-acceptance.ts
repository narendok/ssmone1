import { z } from "zod";
import { deriveBackendRef } from "./lifecycle-deployment-observation";

export const ISOLATED_SALES_ACCEPTANCE_PROJECT_REF = "egjotuxqguifnvdnflan";
export const ORIGINAL_SALES_PROJECT_REF = "yyrvduosyyaluifqvwkr";

export const isolatedSalesAcceptancePreflightSchema = z.object({
  projectRef: z.string().trim().min(1),
});

export type IsolatedSalesAcceptancePreflight = {
  available: boolean;
  target: "isolated" | "original" | "unknown";
  caller: { transport: "authenticated-server-function"; identity: "unverified" };
  checks: Array<{ key: string; available: boolean; detail: string }>;
  blockedOperations: string[];
};

function classifyBackendRef(backendRef: string | null): IsolatedSalesAcceptancePreflight["target"] {
  return backendRef === ISOLATED_SALES_ACCEPTANCE_PROJECT_REF
    ? "isolated"
    : backendRef === ORIGINAL_SALES_PROJECT_REF ? "original" : "unknown";
}

/**
 * This is deliberately declarative and never queries deployment state. The server
 * facade supplies the configured backend URL; the caller-provided project reference
 * is used only as a fail-closed comparison and cannot certify the current backend.
 */
export function isolatedSalesAcceptancePreflight(
  requestedProjectRef: string,
  configuredBackendUrl: string | undefined,
): IsolatedSalesAcceptancePreflight {
  const configuredBackendRef = deriveBackendRef(configuredBackendUrl);
  const target = classifyBackendRef(configuredBackendRef);
  const requestedMatchesConfigured = configuredBackendRef !== null && requestedProjectRef === configuredBackendRef;
  const isApprovedIsolatedTarget = target === "isolated" && requestedMatchesConfigured;
  const targetDetail = configuredBackendRef === null
    ? "Configured backend identity is unavailable or malformed; no acceptance target is certified."
    : !requestedMatchesConfigured
      ? "Requested backend does not match the configured backend; no acceptance target is certified."
      : target === "isolated"
        ? "Configured isolated acceptance backend is allowlisted; deployed capabilities remain unverified."
        : "Configured backend is not the approved isolated acceptance backend.";

  return {
    available: false,
    target,
    caller: {
      transport: "authenticated-server-function",
      identity: "unverified",
    },
    checks: [
      { key: "target", available: isApprovedIsolatedTarget, detail: targetDetail },
      { key: "caller", available: false, detail: "Authenticated transport confirms only the current caller reached this read-only preflight; approved scoped caller and reviewer identities are unverified." },
      { key: "sales-caller", available: false, detail: "A non-admin Sales caller with sales.manage has not been observed through an approved isolated acceptance session." },
      { key: "reviewer-caller", available: false, detail: "A reviewer identity active in the required department has not been observed through an approved isolated acceptance session." },
      { key: "wrong-actor-caller", available: false, detail: "A separately approved wrong-actor or wrong-customer caller has not been observed for denial proof." },
      { key: "rpc", available: false, detail: "Protected Master save, source-bound requirement, feasibility, commercial-save, and baseline RPC availability is unverified because this preflight performs no probes." },
      { key: "transport", available: false, detail: "An approved authenticated application-RPC wrapper for the planned acceptance cases is unverified; service-role, direct SQL, and JWT-GUC impersonation are excluded." },
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