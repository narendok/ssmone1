export const ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND = "egjotuxqguifnvdnflan";
export const ORIGINAL_LIFECYCLE_BACKEND = "yyrvduosyyaluifqvwkr";

export const lifecycleDocumentServerOperations = [
  "authorize_lifecycle_document_draft",
  "register_lifecycle_document_storage_attempt",
  "find_lifecycle_document_draft_receipt",
  "commit_lifecycle_document_draft",
  "can_discard_lifecycle_document_object",
] as const;

export type LifecycleDeploymentObservation = {
  backendRef: string;
  verified: boolean;
  actorGateway?: string;
  serverOperations?: string[];
  storage?: { bucket?: string; uploadDownloadObserved?: boolean };
  observability?: { readbackObserved?: boolean };
};

export type LifecycleDeploymentObservationReport = {
  status: "BLOCKED";
  missingContract: "reviewed_read_only_deployment_observation_adapter";
  backendRef: string;
  capabilities: {
    authenticatedApplicationTransport: "OBSERVED";
    actorGateway: "BLOCKED";
    rpcSchema: "BLOCKED";
    projectDriveStorage: "BLOCKED";
    observabilityReadback: "BLOCKED";
  };
};

/**
 * Derives a project reference only from the exact canonical project endpoint.
 * Lifecycle acceptance cannot use custom domains or nested subdomains.
 */
export function deriveBackendRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) return null;

    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Strictly validates that the target backend reference matches the current environment
 * and is not the original production backend.
 */
export function validateLifecycleTarget(
  targetBackendRef: string,
  currentBackendUrl: string | undefined,
): { valid: true } | { valid: false; reason: string } {
  if (targetBackendRef === ORIGINAL_LIFECYCLE_BACKEND) {
    return { valid: false, reason: "Refusing the original backend." };
  }

  const currentRef = deriveBackendRef(currentBackendUrl);
  if (!currentRef) {
    return { valid: false, reason: "Unable to derive current backend identity." };
  }

  if (targetBackendRef !== currentRef) {
    return { valid: false, reason: "Backend mismatch: target does not match current environment." };
  }

  if (targetBackendRef !== ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND) {
    return { valid: false, reason: "Refusing a backend other than the approved isolated backend." };
  }

  return { valid: true };
}

/**
 * Conservative source-level contract for the isolated acceptance observer.
 * No deployed read-only query contract exists yet, so this never treats local
 * declarations as evidence and deliberately makes no database or storage call.
 */
export function blockedLifecycleDeploymentObservation(
  backendRef: string,
): LifecycleDeploymentObservationReport {
  return {
    status: "BLOCKED",
    missingContract: "reviewed_read_only_deployment_observation_adapter",
    backendRef,
    capabilities: {
      authenticatedApplicationTransport: "OBSERVED",
      actorGateway: "BLOCKED",
      rpcSchema: "BLOCKED",
      projectDriveStorage: "BLOCKED",
      observabilityReadback: "BLOCKED",
    },
  };
}
