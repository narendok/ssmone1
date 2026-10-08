import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  blockedLifecycleDeploymentObservation,
  validateLifecycleTarget,
} from "./lifecycle-deployment-observation";

const requestSchema = z.object({ backendRef: z.string().trim().min(1) });

/**
 * Authenticated, read-only acceptance-observer boundary. It is intentionally
 * BLOCKED until a reviewed deployment adapter can independently inspect the
 * deployed RPC catalog, storage capability, and persisted readback evidence.
 * 
 * Strict configured-target validation ensures we never accidentally expose
 * production data or treat the original backend as an isolated acceptance target.
 */
export const getLifecycleDeploymentObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => requestSchema.parse(data))
  .handler(({ data, context }) => {
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

    return blockedLifecycleDeploymentObservation(data.backendRef);
  });
