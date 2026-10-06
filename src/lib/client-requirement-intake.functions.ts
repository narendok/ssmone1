import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientRequirementIntakeSchema, feasibilityResponseSchema } from "./client-requirement-intake";

async function requireEngineeringManage(sb: any, userId: string) {
  const { data, error } = await sb.rpc("has_permission", { _user_id: userId, _permission_key: "engineering.manage" });
  if (error || !data) throw new Error("You do not have permission to manage engineering feasibility.");
}

export const submitClientRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientRequirementIntakeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: requirementId, error } = await (context.supabase as any).rpc("submit_external_customer_requirement", {
      p_opportunity_id: data.opportunityId,
      p_customer_id: data.customerId,
      p_title: data.title,
      p_customer_reference: data.customerReference,
      p_requirement_data: { description: data.description },
      p_request_key: data.requestKey,
    });
    if (error || typeof requirementId !== "string") throw new Error(error?.message ?? "Could not submit the requirement.");
    return { requirementId };
  });

export const recordAssignedFeasibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => feasibilityResponseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireEngineeringManage(sb, context.userId);
    const { data: review, error } = await sb.rpc("record_requirement_feasibility_response", {
      p_review_id: data.reviewId,
      p_status: data.verdict,
      p_findings: data.findings,
      p_assumptions: data.assumptions,
      p_risks: data.risks,
    });
    if (error || typeof review !== "string") throw new Error(error?.message ?? "Could not record the feasibility response.");
    return { reviewId: review };
  });