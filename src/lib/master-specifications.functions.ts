import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { masterSpecificationSaveSchema, masterSpecificationTitle } from "./master-specification";

async function requireSalesManage(sb: any, userId: string) { const { data, error } = await sb.rpc("has_permission", { _user_id: userId, _permission_key: "sales.manage" }); if (error || !data) throw new Error("You do not have permission to manage sales records."); }

export const saveMasterSpecification = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => masterSpecificationSaveSchema.parse(data)).handler(async ({ data, context }) => {
  const sb = context.supabase as any; await requireSalesManage(sb, context.userId);
  const { data: opportunity, error: opportunityError } = await sb.from("sales_opportunities").select("id,customer_id").eq("id", data.opportunityId).maybeSingle();
  if (opportunityError || !opportunity) throw new Error("The proposed project is unavailable.");
  const { data: result, error } = await sb.rpc("save_master_specification_version", { p_specification_id: data.specificationId, p_opportunity_id: opportunity.id, p_customer_id: opportunity.customer_id, p_title: masterSpecificationTitle(data.draft), p_expected_version: data.expectedVersion, p_change_summary: data.changeSummary, p_specification_data: data.draft });
  if (error || !result) throw new Error(error?.message ?? "Could not save the Master Specification.");
  const receipt = Array.isArray(result) ? result[0] : result;
  if (!receipt || typeof receipt.specification_id !== "string" || typeof receipt.version_id !== "string" || typeof receipt.version_number !== "number" || typeof receipt.specification_number !== "string") throw new Error("The Master Specification save receipt was incomplete.");
  return { specificationId: receipt.specification_id, versionId: receipt.version_id, versionNumber: receipt.version_number, specificationNumber: receipt.specification_number };
});