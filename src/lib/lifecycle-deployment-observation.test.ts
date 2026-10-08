import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND,
  ORIGINAL_LIFECYCLE_BACKEND,
  blockedLifecycleDeploymentObservation,
  lifecycleDocumentServerOperations,
} from "./lifecycle-deployment-observation";

describe("lifecycle deployment observation boundary", () => {
  it("keeps all deployment-specific evidence blocked until a reviewed observer exists", () => {
    expect(blockedLifecycleDeploymentObservation(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND)).toEqual({
      status: "BLOCKED",
      missingContract: "reviewed_read_only_deployment_observation_adapter",
      backendRef: ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND,
      capabilities: {
        authenticatedApplicationTransport: "OBSERVED",
        actorGateway: "BLOCKED",
        rpcSchema: "BLOCKED",
        projectDriveStorage: "BLOCKED",
        observabilityReadback: "BLOCKED",
      },
    });
  });

  it("preserves the exact pending actor-operation contract without treating it as deployed", () => {
    expect(lifecycleDocumentServerOperations).toEqual([
      "authorize_lifecycle_document_draft",
      "register_lifecycle_document_storage_attempt",
      "find_lifecycle_document_draft_receipt",
      "commit_lifecycle_document_draft",
      "can_discard_lifecycle_document_object",
    ]);
  });

  it("keeps the server facade authenticated, read-only, and original-target denying", () => {
    const facade = readFileSync("src/lib/lifecycle-deployment-observation.functions.ts", "utf8");
    expect(facade).toContain("requireSupabaseAuth");
    expect(facade).toContain("ORIGINAL_LIFECYCLE_BACKEND");
    expect(facade).toContain("Refusing the original backend.");
    expect(facade).not.toContain("client.server");
    expect(facade).not.toContain(".rpc(");
    expect(facade).not.toContain(".insert(");
    expect(facade).not.toContain(".update(");
    expect(ORIGINAL_LIFECYCLE_BACKEND).not.toBe(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND);
  });
});