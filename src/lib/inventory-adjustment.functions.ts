import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const adjustmentSchema = z.object({
  componentId: z.string().uuid(),
  locationId: z.string().uuid(),
  delta: z.number().int().refine((value) => value !== 0, "Quantity change is required"),
  reason: z.string().trim().min(1).max(1000),
  idempotencyKey: z.string().uuid(),
});

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => adjustmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: permissionError } = await context.supabase.rpc("has_any_permission", {
      _user_id: context.userId,
      _permission_keys: ["inventory.manage", "procurement.manage"],
    });
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (permissionError || adminError || (!allowed && !isAdmin)) {
      throw new Error("You do not have permission to adjust stock.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("post_stock_adjustment", {
      _approved_by: context.userId,
      _component_id: data.componentId,
      _location_id: data.locationId,
      _delta: data.delta,
      _reason: data.reason,
      _idempotency_key: data.idempotencyKey,
    });
    if (error || !result?.adjustment_number) {
      throw new Error(error?.message ?? "Stock adjustment was not saved.");
    }
    return { adjustmentNumber: result.adjustment_number as string };
  });