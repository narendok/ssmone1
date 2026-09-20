import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireProductionAccess(context: { supabase: any; userId: string }, permission: "production.edit" | "production.approve") {
  const { data: admin } = await context.supabase.rpc("has_role", { _uid: context.userId, _role_name: "admin" });
  if (admin) return;
  const { data: allowed, error } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission_key: permission });
  if (error || !allowed) throw new Error("You do not have permission to perform this production action.");
}

export const createPhase7WorkOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId?: string | null; bomId: string; routeId?: string | null; productName: string; productVariant?: string | null; quantityPlanned: number; plannedStartDate?: string | null; plannedCompletionDate?: string | null; priority: string; notes?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await requireProductionAccess(context, "production.edit");
    if (!data.bomId || !data.productName.trim() || !Number.isFinite(data.quantityPlanned) || data.quantityPlanned <= 0) throw new Error("Select a BOM and enter a product name with a positive planned quantity.");
    const { data: id, error } = await context.supabase.rpc("create_phase7_work_order", {
      _project_id: data.projectId ?? "", _bom_id: data.bomId, _route_id: data.routeId ?? "",
      _product_name: data.productName.trim(), _product_variant: data.productVariant?.trim() || "",
      _quantity_planned: data.quantityPlanned, _planned_start_date: data.plannedStartDate ?? "",
      _planned_completion_date: data.plannedCompletionDate ?? "", _priority: data.priority, _notes: data.notes?.trim() || "",
    });
    if (error || !id) throw new Error(error?.message || "Could not create the work order.");
    return id as string;
  });

export const transitionPhase7WorkOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workOrderId: string; status: string; notes?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await requireProductionAccess(context, ["RELEASED", "COMPLETED"].includes(data.status) ? "production.approve" : "production.edit");
    const { error } = await context.supabase.rpc("transition_phase7_work_order", { _work_order_id: data.workOrderId, _status: data.status, _notes: data.notes?.trim() || undefined });
    if (error) throw new Error(error.message || "Could not update the work order.");
  });
