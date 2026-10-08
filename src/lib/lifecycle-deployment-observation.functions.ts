import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  blockedLifecycleDeploymentObservation,
  deriveBackendRef,
  observeScopedLifecycleReadback,
  type ScopedLifecycleReadClient,
  validateLifecycleTarget,
} from "./lifecycle-deployment-observation";
import { classifyConfiguredLifecycleBackend } from "./lifecycle-acceptance-diagnostics-state";

const requestSchema = z.object({
  backendRef: z.string().trim().min(1),
  projectId: z.string().uuid(),
  requestKey: z.string().uuid(),
  expectedSource: z.object({
    templateId: z.string().uuid(),
    templateDocumentRevisionId: z.string().uuid(),
    sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
  }).optional(),
});

/**
 * Returns only the server-derived diagnostics availability. The browser never
 * supplies or selects a backend target, and no database or storage read occurs.
 */
export const getLifecycleDeploymentConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context.userId) throw new Error("Unauthorized");
    return classifyConfiguredLifecycleBackend(deriveBackendRef(process.env.SUPABASE_URL));
  });

/**
 * Authenticated, read-only acceptance-observer boundary. It is intentionally
 * It only reads a caller-RLS-scoped project/request receipt and its linked
 * governed records. RPC catalog, physical storage, and audit evidence remain
 * BLOCKED because no safe read-only contract exists for those capabilities.
 */
export const getLifecycleDeploymentObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => requestSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!context.userId) throw new Error("Unauthorized");

    // Strictly validate the target before any database or further logic.
    // We use the environment's SUPABASE_URL to derive the current backend identity.
    const validation = validateLifecycleTarget(
      data.backendRef,
      process.env.SUPABASE_URL
    );

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const report = blockedLifecycleDeploymentObservation(data.backendRef);
    const readback = await observeScopedLifecycleReadback(
      context.supabase as unknown as ScopedLifecycleReadClient,
      data,
    );
    const complete = readback.receipt.status === "OBSERVED"
      && readback.source.status === "OBSERVED"
      && readback.generatedNode.status === "OBSERVED"
      && readback.generatedRevision.status === "OBSERVED"
      && readback.controlledRegister.status === "OBSERVED"
      && readback.storageMetadata.status === "OBSERVED";
    return {
      ...report,
      missingContract: "physical_storage_and_audit_readback_contract",
      capabilities: {
        ...report.capabilities,
        observabilityReadback: complete
          ? { status: "OBSERVED" as const }
          : { status: "BLOCKED" as const, reason: "scoped_governed_readback_incomplete" },
      },
      readback,
    };
  });
