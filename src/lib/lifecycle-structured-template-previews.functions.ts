import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapMasterSpecificationSource } from "@/lib/lifecycle-structured-template-previews";

type ReadInput = { opportunityNumber: string; specificationNumber: string; versionNumber: number };
function validate(input: ReadInput) { if (!/^OPPORTUNITY-\d{4}-\d{4}$/.test(input.opportunityNumber) || !/^MASTER-\d{4}-\d{4}$/.test(input.specificationNumber) || !Number.isInteger(input.versionNumber) || input.versionNumber < 1) throw new Error("A valid pinned opportunity, Master Specification, and revision are required."); return input; }
export const fetchStructuredTemplatePreviewSource = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(validate).handler(async ({ data, context }) => {
  const { data: opportunity, error: opportunityError } = await context.supabase.from("sales_opportunities").select("id,opportunity_number,name,customer_id,customer:customers(id,legal_name)").eq("opportunity_number", data.opportunityNumber).maybeSingle();
  if (opportunityError) throw new Error("The opportunity source could not be read with your current access.");
  if (!opportunity) throw new Error("The requested opportunity is unavailable with your current access.");
  const customer = opportunity.customer as unknown as { id: string; legal_name: string } | null;
  if (!customer || customer.id !== opportunity.customer_id) throw new Error("The opportunity customer source is incomplete.");
  const { data: specification, error: specificationError } = await context.supabase.from("master_specifications").select("id,specification_number,opportunity_id,customer_id,current_version").eq("opportunity_id", opportunity.id).eq("customer_id", opportunity.customer_id).eq("specification_number", data.specificationNumber).maybeSingle();
  if (specificationError) throw new Error("The Master Specification source could not be read with your current access.");
  if (!specification || specification.current_version < data.versionNumber) throw new Error("The requested Master Specification revision is unavailable.");
  const { data: version, error: versionError } = await context.supabase.from("master_specification_versions").select("id,specification_id,version_number,change_summary,created_at,specification_data").eq("specification_id", specification.id).eq("version_number", data.versionNumber).maybeSingle();
  if (versionError) throw new Error("The pinned Master Specification revision could not be read with your current access.");
  if (!version || version.specification_id !== specification.id) throw new Error("The pinned Master Specification revision is unavailable.");
  const { data: project, error: projectError } = await context.supabase.from("projects").select("id,name,code,opportunity_id").eq("opportunity_id", opportunity.id).maybeSingle();
  if (projectError) throw new Error("The linked project source could not be read with your current access.");
  if (project && project.opportunity_id !== opportunity.id) throw new Error("The linked project source is inconsistent.");
  return mapMasterSpecificationSource({ opportunityId: opportunity.id, opportunityNumber: opportunity.opportunity_number ?? data.opportunityNumber, opportunityName: opportunity.name, customerId: customer.id, customerName: customer.legal_name, specificationId: specification.id, specificationNumber: specification.specification_number, versionId: version.id, versionNumber: version.version_number, changeSummary: version.change_summary, savedAt: version.created_at, project, specificationData: version.specification_data });
});