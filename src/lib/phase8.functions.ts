import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const permissions = {
  facility_locations: "facility.edit", asset_categories: "assets.edit", assets: "assets.edit", asset_assignments: "assets.edit",
  maintenance_plans: "maintenance.edit", maintenance_work_orders: "maintenance.edit", imte_instruments: "calibration.edit",
  calibration_records: "calibration.edit", workstations: "workplace.edit", workstation_allocations: "workplace.edit",
  visitor_visits: "security.edit", vehicle_entries: "security.edit", material_gate_passes: "security.edit", security_incidents: "security.edit",
} as const;

type Phase8Table = keyof typeof permissions;

export const savePhase8Record = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: Phase8Table; id?: string; payload: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const { data: allowed, error: permissionError } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission_key: permissions[data.table] });
    if (permissionError || !allowed) throw new Error("You do not have permission to manage this record.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const query = data.id ? (supabaseAdmin.from(data.table) as any).update(data.payload).eq("id", data.id) : (supabaseAdmin.from(data.table) as any).insert({ ...data.payload, created_by: context.userId });
    const { data: saved, error } = await query.select("id").single();
    if (error || !saved) throw new Error(error?.message ?? "Could not save the record.");
    return saved as { id: string };
  });
