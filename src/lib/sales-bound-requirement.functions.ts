import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const salesBoundRequirementSchema = z.object({
  opportunityId: z.string().uuid(),
  customerId: z.string().uuid(),
  masterSpecificationVersionId: z.string().uuid(),
  title: z.string().trim().min(3).max(240),
  customerReference: z.string().trim().max(160).nullable(),
  summary: z.string().trim().max(8000).nullable(),
  requestKey: z.string().uuid(),
});

/** Disabled by the UI until the pending database contract completes isolated acceptance. */
export const createSalesBoundCustomerRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => salesBoundRequirementSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: requirementId, error } = await context.supabase.rpc("create_sales_bound_customer_requirement", {
      p_opportunity_id: data.opportunityId,
      p_customer_id: data.customerId,
      p_master_specification_version_id: data.masterSpecificationVersionId,
      p_title: data.title,
      p_customer_reference: data.customerReference,
      p_summary: data.summary,
      p_request_key: data.requestKey,
    });
    if (error || typeof requirementId !== "string") {
      throw new Error(error?.message ?? "Could not create the source-bound requirement.");
    }
    return { id: requirementId };
  });
