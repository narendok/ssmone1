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