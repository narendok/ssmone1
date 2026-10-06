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
    // The RPC is deliberately absent from generated database types until its pending SQL is accepted.
    // Keeping the facade fail-closed prevents a source-only contract from becoming callable early.
    void data;
    void context;
    throw new Error("Source-bound requirement creation is unavailable until the protected database contract passes isolated acceptance.");
  });
