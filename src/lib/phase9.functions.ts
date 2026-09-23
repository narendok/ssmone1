import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const permissions = {
  qms_quality_objectives: "qms.edit", qms_kpis: "qms.edit", qms_kpi_formula_versions: "qms.edit", qms_kpi_snapshots: "qms.edit", qms_risks: "qms.edit", qms_contingency_plans: "qms.edit", qms_contingency_tests: "qms.edit", qms_audits: "qms.edit", qms_audit_findings: "qms.edit", qms_capas: "qms.edit", qms_improvements: "qms.edit", qms_lessons_learned: "qms.edit", qms_management_reviews: "qms.edit", qms_retention_policies: "qms.edit",
  customer_complaints: "customer_service.edit", customer_warranty_claims: "customer_service.edit", customer_returns: "customer_service.edit", customer_field_failures: "customer_service.edit", customer_satisfaction_surveys: "customer_service.edit",
} as const;

type Phase9Table = keyof typeof permissions;

export const savePhase9Record = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: Phase9Table; id?: string; payload: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission_key: permissions[data.table] });
    if (accessError || !allowed) throw new Error("You do not have permission to manage this record.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const query = data.id
      ? (supabaseAdmin.from(data.table) as any).update(data.payload).eq("id", data.id)
      : (supabaseAdmin.from(data.table) as any).insert({ ...data.payload, created_by: context.userId });
    const { data: saved, error } = await query.select("id").single();
    if (error || !saved) throw new Error(error?.message ?? "Could not save the record.");
    return saved as { id: string };
  });
