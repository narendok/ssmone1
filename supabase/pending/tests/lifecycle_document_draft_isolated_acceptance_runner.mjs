#!/usr/bin/env node
/**
 * Isolated-only lifecycle SaveDraft acceptance runner.
 *
 * The runner owns target guards and result validation. An operator-supplied
 * application driver owns the normal signed-in browser transport; this file
 * deliberately never invokes database RPCs or server-function HTTP URLs.
 */
import { pathToFileURL } from "node:url";

export const ISOLATED_BACKEND_REF = "egjotuxqguifnvdnflan";
export const ORIGINAL_BACKEND_REF = "yyrvduosyyaluifqvwkr";

const requiredReadiness = [
  "authenticatedApplicationTransport",
  "authorizeLifecycleDocumentDraft",
  "registerLifecycleDocumentStorageAttempt",
  "findLifecycleDocumentDraftReceipt",
  "commitLifecycleDocumentDraft",
  "canDiscardLifecycleDocumentObject",
  "projectDriveUploadDownload",
  "observabilityReadback",
];

const requiredServerOperations = [
  "authorize_lifecycle_document_draft",
  "register_lifecycle_document_storage_attempt",
  "find_lifecycle_document_draft_receipt",
  "commit_lifecycle_document_draft",
  "can_discard_lifecycle_document_object",
];

const requiredReceiptKeys = [
  "requestKey",
  "nodeId",
  "revisionId",
  "registerId",
  "auditEventId",
  "sourceFingerprint",
];

export function assertIsolatedTarget(backendRef) {
  if (backendRef === ORIGINAL_BACKEND_REF) {
    throw new Error("Refusing the original backend.");
  }
  if (backendRef !== ISOLATED_BACKEND_REF) {
    throw new Error("Refusing a backend other than the approved isolated remix.");
  }
}

export function assessReadiness(observation) {
  assertIsolatedTarget(observation?.backendRef);
  const missing = requiredReadiness.filter((key) => observation?.[key] !== true);
  const deployed = observation?.deployed;
  if (!deployed || typeof deployed !== "object") {
    missing.push("deployedReadinessEvidence");
  } else {
    if (deployed.applicationTransport !== "authenticated-server-action") missing.push("deployedApplicationTransport");
    if (deployed.actorGateway !== "execute_lifecycle_document_action") missing.push("deployedActorGateway");
    if (!Array.isArray(deployed.serverOperations) ||
        requiredServerOperations.some((operation) => !deployed.serverOperations.includes(operation))) {
      missing.push("deployedRpcOperations");
    }
    if (deployed.storageBucket !== "project-drive" || deployed.storageUploadDownload !== true) {
      missing.push("deployedProjectDriveStorage");
    }
    if (deployed.schemaReadback !== true || deployed.observabilityReadback !== true) {
      missing.push("deployedSchemaAndObservabilityReadback");
    }
  }
  return {
    mode: "READ_ONLY",
    status: missing.length ? "UNEXECUTED" : "READY_FOR_OPT_IN_MUTATION",
    missing,
  };
}

function assertReceipt(receipt, label) {
  if (!receipt || typeof receipt !== "object") throw new Error(`${label} requires a receipt.`);
  for (const key of requiredReceiptKeys) {
    if (typeof receipt[key] !== "string" || !receipt[key].trim()) {
      throw new Error(`${label} receipt is missing ${key}.`);
    }
  }
}

function sameReceipt(left, right) {
  return requiredReceiptKeys.every((key) => left[key] === right[key]);
}

/**
 * Validates observations from a real application-transport driver. The driver
 * receives opaque sessions only at invocation time and must not log them.
 */
export function validateMutationEvidence(evidence) {
  assertIsolatedTarget(evidence?.backendRef);
  assertReceipt(evidence?.firstSave?.receipt, "First save");
  if (evidence.firstSave.fileBytesSha256 !== evidence.firstSave.storedBytesSha256) {
    throw new Error("First save file-byte hash did not match the stored object.");
  }
  if (evidence.firstSave.metadata?.node !== 1 || evidence.firstSave.metadata?.revision !== 1 ||
      evidence.firstSave.metadata?.register !== 1 || evidence.firstSave.metadata?.audit !== 1 ||
      evidence.firstSave.metadata?.receipt !== 1) {
    throw new Error("First save did not produce exactly one canonical metadata set.");
  }

  assertReceipt(evidence?.exactReplay?.receipt, "Exact replay");
  if (!sameReceipt(evidence.firstSave.receipt, evidence.exactReplay.receipt) ||
      evidence.exactReplay.additionalCanonicalRows !== 0) {
    throw new Error("Exact replay was not idempotent.");
  }

  for (const name of ["requestConflict", "manualEditConflict", "sourceOrTemplateAdvance", "outsiderDenied", "directTransportDenied"]) {
    if (evidence?.[name]?.denied !== true || evidence[name].additionalCanonicalRows !== 0) {
      throw new Error(`${name} did not fail closed.`);
    }
  }
  if (evidence.outsiderDenied.disclosedReceipt !== false || evidence.directTransportDenied.disclosedReceipt !== false) {
    throw new Error("A denied caller received protected receipt metadata.");
  }

  if (evidence?.uploadOrCommitFailure?.compensated !== true || evidence.uploadOrCommitFailure.cleanupVerified !== true) {
    throw new Error("Upload or commit compensation was not proven.");
  }

  assertReceipt(evidence?.concurrentSameRequest?.receipt, "Concurrent same request");
  if (!sameReceipt(evidence.firstSave.receipt, evidence.concurrentSameRequest.receipt) ||
      evidence.concurrentSameRequest.canonicalReceiptCount !== 1 ||
      evidence.concurrentSameRequest.loserCleanupVerified !== true) {
    throw new Error("Concurrent same request did not retain one canonical receipt.");
  }

  return { mode: "MUTATING", status: "OBSERVED", liveChecks: "UNEXECUTED_UNTIL_OPERATOR_RUN" };
}

export async function runWithDriver({ mode = "READ_ONLY", env = process.env, driver }) {
  assertIsolatedTarget(env.ACCEPTANCE_BACKEND_REF);
  if (!driver || typeof driver.inspectReadiness !== "function") {
    return assessReadiness({ backendRef: env.ACCEPTANCE_BACKEND_REF });
  }
  const readiness = assessReadiness(await driver.inspectReadiness());
  if (mode !== "MUTATING") return readiness;
  if (env.LIFECYCLE_ACCEPTANCE_MUTATE !== "YES") {
    throw new Error("Mutating acceptance requires LIFECYCLE_ACCEPTANCE_MUTATE=YES.");
  }
  if (readiness.status !== "READY_FOR_OPT_IN_MUTATION" || typeof driver.runMutationCases !== "function") {
    throw new Error("Mutating acceptance requires verified read-only readiness and an application driver.");
  }
  // Opaque session values are passed only to the local driver and are never
  // included in return values, exceptions, or console output.
  const evidence = await driver.runMutationCases({
    managerSession: env.LIFECYCLE_MANAGER_SESSION,
    outsiderSession: env.LIFECYCLE_OUTSIDER_SESSION,
  });
  return validateMutationEvidence(evidence);
}

async function main() {
  const mode = process.argv.includes("--mutate") ? "MUTATING" : "READ_ONLY";
  if (mode === "MUTATING" && process.env.LIFECYCLE_ACCEPTANCE_MUTATE !== "YES") {
    throw new Error("Refusing mutation mode without LIFECYCLE_ACCEPTANCE_MUTATE=YES.");
  }
  const driverPath = process.env.LIFECYCLE_ACCEPTANCE_DRIVER;
  const driverModule = driverPath ? await import(pathToFileURL(driverPath).href) : undefined;
  const driver = driverModule?.createDriver
    ? driverModule.createDriver({
        backendRef: process.env.ACCEPTANCE_BACKEND_REF,
        origin: process.env.ACCEPTANCE_APPLICATION_ORIGIN,
      })
    : driverModule;
  const result = await runWithDriver({ mode, driver });
  // Results contain statuses/counts only. They never contain session values.
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Acceptance runner failed.");
    process.exitCode = 1;
  });
}