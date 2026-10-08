import { describe, expect, it, vi } from "vitest";
import {
  ISOLATED_BACKEND_REF,
  ORIGINAL_BACKEND_REF,
  assessReadiness,
  assertIsolatedTarget,
  runWithDriver,
  validateMutationEvidence,
} from "./lifecycle_document_draft_isolated_acceptance_runner.mjs";

const receipt = {
  requestKey: "00000000-0000-0000-0000-000000000001",
  nodeId: "00000000-0000-0000-0000-000000000002",
  revisionId: "00000000-0000-0000-0000-000000000003",
  registerId: "00000000-0000-0000-0000-000000000004",
  auditEventId: "00000000-0000-0000-0000-000000000005",
  sourceFingerprint: "a".repeat(64),
};

const readiness = {
  backendRef: ISOLATED_BACKEND_REF,
  authenticatedApplicationTransport: true,
  authorizeLifecycleDocumentDraft: true,
  registerLifecycleDocumentStorageAttempt: true,
  findLifecycleDocumentDraftReceipt: true,
  commitLifecycleDocumentDraft: true,
  canDiscardLifecycleDocumentObject: true,
  projectDriveUploadDownload: true,
  observabilityReadback: true,
  deployed: {
    applicationTransport: "authenticated-server-action",
    actorGateway: "execute_lifecycle_document_action",
    serverOperations: [
      "authorize_lifecycle_document_draft",
      "register_lifecycle_document_storage_attempt",
      "find_lifecycle_document_draft_receipt",
      "commit_lifecycle_document_draft",
      "can_discard_lifecycle_document_object",
    ],
    storageBucket: "project-drive",
    storageUploadDownload: true,
    schemaReadback: true,
    observabilityReadback: true,
  },
};

function evidence() {
  return {
    backendRef: ISOLATED_BACKEND_REF,
    firstSave: {
      receipt,
      fileBytesSha256: "b".repeat(64),
      storedBytesSha256: "b".repeat(64),
      metadata: { node: 1, revision: 1, register: 1, audit: 1, receipt: 1 },
    },
    exactReplay: { receipt: { ...receipt }, additionalCanonicalRows: 0 },
    requestConflict: { denied: true, additionalCanonicalRows: 0 },
    manualEditConflict: { denied: true, additionalCanonicalRows: 0 },
    sourceOrTemplateAdvance: { denied: true, additionalCanonicalRows: 0 },
    outsiderDenied: { denied: true, disclosedReceipt: false, additionalCanonicalRows: 0 },
    directTransportDenied: { denied: true, disclosedReceipt: false, additionalCanonicalRows: 0 },
    uploadOrCommitFailure: { compensated: true, cleanupVerified: true },
    concurrentSameRequest: { receipt: { ...receipt }, canonicalReceiptCount: 1, loserCleanupVerified: true },
  };
}

describe("isolated lifecycle acceptance runner", () => {
  it("accepts only the approved isolated backend and explicitly refuses the original", () => {
    expect(() => assertIsolatedTarget(ORIGINAL_BACKEND_REF)).toThrow("original backend");
    expect(() => assertIsolatedTarget("another-backend")).toThrow("approved isolated");
    expect(() => assertIsolatedTarget(ISOLATED_BACKEND_REF)).not.toThrow();
  });

  it("reports incomplete readiness as UNEXECUTED without attempting application transport", () => {
    expect(assessReadiness({ backendRef: ISOLATED_BACKEND_REF })).toEqual(expect.objectContaining({
      mode: "READ_ONLY", status: "UNEXECUTED",
    }));
  });

  it("fails closed when readiness supplies declarations instead of deployed gateway, schema, and storage evidence", () => {
    const declaredOnly = { ...readiness };
    delete declaredOnly.deployed;
    expect(assessReadiness(declaredOnly)).toEqual(expect.objectContaining({
      status: "UNEXECUTED",
      missing: expect.arrayContaining(["deployedReadinessEvidence"]),
    }));

    const incompleteDeployment = { ...readiness, deployed: { ...readiness.deployed, storageUploadDownload: false } };
    expect(assessReadiness(incompleteDeployment)).toEqual(expect.objectContaining({
      status: "UNEXECUTED",
      missing: expect.arrayContaining(["deployedProjectDriveStorage"]),
    }));
  });

  it("runs only read-only readiness by default and never invokes mutation cases", async () => {
    const driver = { inspectReadiness: vi.fn(async () => readiness), runMutationCases: vi.fn() };
    await expect(runWithDriver({ env: { ACCEPTANCE_BACKEND_REF: ISOLATED_BACKEND_REF }, driver })).resolves.toEqual({
      mode: "READ_ONLY", status: "READY_FOR_OPT_IN_MUTATION", missing: [],
    });
    expect(driver.runMutationCases).not.toHaveBeenCalled();
  });

  it("requires the explicit mutation opt-in before it can pass opaque sessions to a driver", async () => {
    const driver = { inspectReadiness: vi.fn(async () => readiness), runMutationCases: vi.fn() };
    await expect(runWithDriver({ mode: "MUTATING", env: { ACCEPTANCE_BACKEND_REF: ISOLATED_BACKEND_REF }, driver })).rejects.toThrow("LIFECYCLE_ACCEPTANCE_MUTATE=YES");
    expect(driver.runMutationCases).not.toHaveBeenCalled();
  });

  it("validates all required observed outcomes without returning sessions", async () => {
    const driver = {
      inspectReadiness: vi.fn(async () => readiness),
      runMutationCases: vi.fn(async (sessions) => {
        expect(sessions).toEqual({ managerSession: "manager-secret", outsiderSession: "outsider-secret" });
        return evidence();
      }),
    };
    await expect(runWithDriver({
      mode: "MUTATING",
      env: {
        ACCEPTANCE_BACKEND_REF: ISOLATED_BACKEND_REF,
        LIFECYCLE_ACCEPTANCE_MUTATE: "YES",
        LIFECYCLE_MANAGER_SESSION: "manager-secret",
        LIFECYCLE_OUTSIDER_SESSION: "outsider-secret",
      },
      driver,
    })).resolves.toEqual({ mode: "MUTATING", status: "OBSERVED", liveChecks: "UNEXECUTED_UNTIL_OPERATOR_RUN" });
  });

  it("fails closed when replay, denial, compensation, or concurrency evidence changes", () => {
    const changedReplay = evidence();
    changedReplay.exactReplay.receipt.nodeId = "different";
    expect(() => validateMutationEvidence(changedReplay)).toThrow("idempotent");

    const disclosedOutsider = evidence();
    disclosedOutsider.outsiderDenied.disclosedReceipt = true;
    expect(() => validateMutationEvidence(disclosedOutsider)).toThrow("protected receipt");

    const retainedFailure = evidence();
    retainedFailure.uploadOrCommitFailure.cleanupVerified = false;
    expect(() => validateMutationEvidence(retainedFailure)).toThrow("compensation");

    const duplicateReceipt = evidence();
    duplicateReceipt.concurrentSameRequest.canonicalReceiptCount = 2;
    expect(() => validateMutationEvidence(duplicateReceipt)).toThrow("one canonical receipt");
  });
});