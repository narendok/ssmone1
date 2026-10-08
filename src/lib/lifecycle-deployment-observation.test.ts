import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND,
  ORIGINAL_LIFECYCLE_BACKEND,
  blockedLifecycleDeploymentObservation,
  lifecycleDocumentServerOperations,
  deriveBackendRef,
  validateLifecycleTarget,
} from "./lifecycle-deployment-observation";

describe("lifecycle deployment observation boundary", () => {
  describe("backend identity derivation", () => {
    it("extracts project ref from standard Supabase URLs", () => {
      expect(deriveBackendRef("https://egjotuxqguifnvdnflan.supabase.co")).toBe("egjotuxqguifnvdnflan");
      expect(deriveBackendRef("https://yyrvduosyyaluifqvwkr.supabase.co")).toBe("yyrvduosyyaluifqvwkr");
    });

    it.each([
      undefined,
      "",
      "not-a-url",
      "https://example.com",
      "https://supabase.co",
      "https://egjotuxqguifnvdnflan.extra.supabase.co",
      "https://egjotuxqguifnvdnflan.supabase.co.attacker.test",
      "http://egjotuxqguifnvdnflan.supabase.co",
      "https://user:password@egjotuxqguifnvdnflan.supabase.co",
      "https://egjotuxqguifnvdnflan.supabase.co:8443",
      "https://egjotuxqguifnvdnflan.supabase.co/path",
      "https://egjotuxqguifnvdnflan.supabase.co?probe=true",
      "https://egjotuxqguifnvdnflan.supabase.co#fragment",
    ])("returns null for a non-canonical target: %s", (url) => {
      expect(deriveBackendRef(undefined)).toBeNull();
      expect(deriveBackendRef(url)).toBeNull();
    });
  });

  describe("strict target validation", () => {
    const isolatedUrl = "https://egjotuxqguifnvdnflan.supabase.co";
    const originalUrl = "https://yyrvduosyyaluifqvwkr.supabase.co";

    it("refuses the original backend even if it matches the current environment", () => {
      const result = validateLifecycleTarget(ORIGINAL_LIFECYCLE_BACKEND, originalUrl);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Refusing the original backend.");
      }
    });

    it("refuses mismatches between target and environment", () => {
      const result = validateLifecycleTarget(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, originalUrl);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Backend mismatch: target does not match current environment.");
      }
    });

    it("refuses a canonical unknown backend even if it matches the environment", () => {
      const unknownRef = "unknownbackendref0000";
      const unknownUrl = `https://${unknownRef}.supabase.co`;
      const result = validateLifecycleTarget(unknownRef, unknownUrl);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Refusing a backend other than the approved isolated backend.");
      }
    });

    it("accepts the isolated backend when it matches the environment", () => {
      const result = validateLifecycleTarget(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, isolatedUrl);
      expect(result.valid).toBe(true);
    });

    it("fails safely if environment URL is missing", () => {
      const result = validateLifecycleTarget(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, undefined);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Unable to derive current backend identity.");
      }
    });
  });

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

  it("keeps the server facade authenticated and uses strict validation", () => {
    const facade = readFileSync("src/lib/lifecycle-deployment-observation.functions.ts", "utf8");
    expect(facade).toContain("requireSupabaseAuth");
    expect(facade).toContain("validateLifecycleTarget");
    expect(facade).toContain("process.env.SUPABASE_URL");
    // Ensure it doesn't do database calls
    expect(facade).not.toContain("supabase.from(");
    expect(facade).not.toContain("supabase.rpc(");
  });
});
