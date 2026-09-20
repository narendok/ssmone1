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

export const recordPhase7UnitExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workOrderId: string; unitId: string; routeStepId?: string | null; status: "STARTED" | "COMPLETED" | "HOLD" | "REWORK"; notes?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await requireProductionAccess(context, "production.edit");
    const { data: id, error } = await context.supabase.rpc("record_phase7_unit_execution", {
      _work_order_id: data.workOrderId, _production_unit_id: data.unitId, _route_step_id: data.routeStepId ?? "",
      _status: data.status, _notes: data.notes?.trim() || undefined,
    });
    if (error || !id) throw new Error(error?.message || "Could not record shop-floor execution.");
    return id as string;
  });

export const recordPhase7UnitInspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workOrderId: string; unitId: string; routeStepId?: string | null; result: "PASS" | "HOLD" | "FAIL" | "REWORK"; findings?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await requireProductionAccess(context, "production.edit");
    const { data: id, error } = await context.supabase.rpc("record_phase7_unit_inspection", {
      _work_order_id: data.workOrderId, _production_unit_id: data.unitId, _route_step_id: data.routeStepId ?? "",
      _result: data.result, _findings: data.findings?.trim() || undefined,
    });
    if (error || !id) throw new Error(error?.message || "Could not record the in-process inspection.");
    return id as string;
  });

export const recordPhase7UnitTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workOrderId: string; unitId: string; testType: string; result: "PASS" | "FAIL" | "INCONCLUSIVE"; notes?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await requireProductionAccess(context, "production.edit");
    if (!data.testType.trim()) throw new Error("Enter the test type.");
    const { data: id, error } = await context.supabase.rpc("record_phase7_unit_test", {
      _work_order_id: data.workOrderId, _production_unit_id: data.unitId, _test_type: data.testType.trim(),
      _result: data.result, _notes: data.notes?.trim() || undefined,
    });
    if (error || !id) throw new Error(error?.message || "Could not record the production test.");
    return id as string;
  });

export const dispositionPhase7Ncr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ncrId: string; status: "UNDER_REVIEW" | "REWORK" | "SCRAP" | "CLOSED"; notes?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await requireProductionAccess(context, "production.approve");
    const { error } = await context.supabase.rpc("disposition_phase7_ncr", { _ncr_id: data.ncrId, _status: data.status, _notes: data.notes?.trim() || undefined });
    if (error) throw new Error(error.message || "Could not disposition the production NCR.");
  });
