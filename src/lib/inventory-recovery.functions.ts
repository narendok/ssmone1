import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const recoverySchema = z.object({
  componentId: z.string().uuid(),
  quantity: z.number().int().positive(),
  locationType: z.string().trim().min(1).max(50),
  locationLabel: z.string().trim().min(1).max(200),
  sourceNote: z.string().trim().min(3).max(1000),
  idempotencyKey: z.string().uuid(),
});

export const recoverHistoricalZeroStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => recoverySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Only Administrators can recover historical inventory.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("recover_historical_zero_stock_component", {
      _approved_by: context.userId,
      _component_id: data.componentId,
      _quantity: data.quantity,
      _location_type: data.locationType,
      _location_label: data.locationLabel,
      _source_note: data.sourceNote,
      _idempotency_key: data.idempotencyKey,
    });
    const locationQuantity = Number(result?.location_quantity);
    if (error || !result?.location_id || !result?.stock_event_id || !Number.isFinite(locationQuantity) || locationQuantity <= 0) {
      throw new Error(error?.message ?? "Recovery did not persist a positive bin quantity and stock-history event.");
    }
    return {
      locationId: result.location_id as string,
      locationLabel: String(result.location_label ?? data.locationLabel),
      locationQuantity,
      stockEventId: result.stock_event_id as string,
    };
  });