import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isolatedSalesAcceptancePreflight, isolatedSalesAcceptancePreflightSchema } from "./isolated-sales-acceptance";

/** Read-only by design: it never opens a database transaction or invokes an application RPC. */
export const getIsolatedSalesAcceptancePreflight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => isolatedSalesAcceptancePreflightSchema.parse(data))
  .handler(({ data }) => isolatedSalesAcceptancePreflight(data.projectRef));