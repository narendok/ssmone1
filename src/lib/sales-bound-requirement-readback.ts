import { z } from "zod";
import {
  salesBoundRequirementReadScopeSchema,
  type SalesBoundRequirementReadScope,
} from "./client-requirement-intake";

export const salesBoundRequirementReadAssertionSchema = z.enum([
  "requirement-create-replay-graph",
  "requirement-create-source-version-graph",
  "requirement-create-rollback-graph-absent",
]);

export const salesBoundRequirementReadRequestSchema = z.object({
  kind: z.literal("sales-bound-requirement-read"),
  assertion: salesBoundRequirementReadAssertionSchema,
  scope: salesBoundRequirementReadScopeSchema,
});

export type SalesBoundRequirementReadAssertion = z.infer<typeof salesBoundRequirementReadAssertionSchema>;
export type SalesBoundRequirementReadRequest = z.infer<typeof salesBoundRequirementReadRequestSchema>;

export type SalesBoundRequirementReadback = {
  status: "OBSERVED" | "BLOCKED";
  assertion: SalesBoundRequirementReadAssertion;
  ok?: true;
  missingContract?: string;
};

/**
 * This is intentionally an adapter boundary, not a database read. The pending SQL proposal
 * contains the future caller-RLS definer contract, while production has no such function.
 */
export async function observeSalesBoundRequirementReadback(
  request: SalesBoundRequirementReadRequest,
): Promise<SalesBoundRequirementReadback> {
  const validated = salesBoundRequirementReadRequestSchema.parse(request);
  void validated;

  return {
    status: "BLOCKED",
    assertion: request.assertion,
    missingContract: "The scoped caller-RLS Sales requirement receipt readback contract is pending isolated acceptance and deployment.",
  };
}

export function salesBoundRequirementReadScope(
  scope: SalesBoundRequirementReadScope,
): SalesBoundRequirementReadScope {
  return salesBoundRequirementReadScopeSchema.parse(scope);
}