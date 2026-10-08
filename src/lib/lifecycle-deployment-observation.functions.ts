import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND,
  ORIGINAL_LIFECYCLE_BACKEND,
  blockedLifecycleDeploymentObservation,
} from "./lifecycle-deployment-observation";

const requestSchema = z.object({ backendRef: z.string().trim().min(1) });

/**
 * Authenticated, read-only acceptance-observer boundary. It is intentionally
 * BLOCKED until a reviewed deployment adapter can independently inspect the
 * deployed RPC catalog, storage capability, and persisted readback evidence.
 */
export const getLifecycleDeploymentObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => requestSchema.parse(data))
  .handler(({ data, context }) => {
    if (!context.userId) throw new Error("Unauthorized");
    if (data.backendRef === ORIGINAL_LIFECYCLE_BACKEND) {
      throw new Error("Refusing the original backend.");
    }
    if (data.backendRef !== ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND) {
      throw new Error("Refusing a backend other than the approved isolated backend.");
    }
    return blockedLifecycleDeploymentObservation(data.backendRef);
  });