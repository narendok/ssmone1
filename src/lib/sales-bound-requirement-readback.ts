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

const positiveReceiptAssertion = "requirement-create-replay-graph" as const;
const pendingReason = "The scoped caller-RLS Sales requirement receipt readback contract is pending isolated acceptance and deployment.";
const unsupportedAssertionReason = "This positive-only receipt contract cannot prove rollback absence or source-version history; a separately scoped independent read contract is required.";

const receiptGraphRowSchema = z.object({
  request_key: z.string().uuid(),
  requirement_id: z.string().uuid(),
  revision_id: z.string().uuid(),
  revision_number: z.literal(1),
  audit_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  master_specification_version_id: z.string().uuid(),
  master_specification_version_number: z.number().int().positive(),
}).strict();

type ReceiptGraphRow = z.infer<typeof receiptGraphRowSchema>;

type CallerRlsRpc = {
  rpc: (functionName: string, arguments_: Record<string, string>) => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export type SalesBoundRequirementReadbackAdapter = {
  observe: (request: SalesBoundRequirementReadRequest) => Promise<SalesBoundRequirementReadback>;
};

function blocked(assertion: SalesBoundRequirementReadAssertion, missingContract: string): SalesBoundRequirementReadback {
  return { status: "BLOCKED", assertion, missingContract };
}

function validatePositiveReceiptGraph(row: ReceiptGraphRow, scope: SalesBoundRequirementReadScope): boolean {
  return row.request_key === scope.requestKey
    && row.opportunity_id === scope.opportunityId
    && row.customer_id === scope.customerId
    && row.master_specification_version_id === scope.masterSpecificationVersionId;
}

/**
 * Concrete caller-RLS binding for the reviewed, positive-only RPC. It stays opt-in until
 * isolated acceptance and deployment separately approve it; it never uses an admin client.
 */
export function createSalesBoundRequirementReadbackAdapter(input: {
  callerRlsRpc: CallerRlsRpc;
  enabled: boolean;
}): SalesBoundRequirementReadbackAdapter {
  return {
    async observe(request) {
      const validated = salesBoundRequirementReadRequestSchema.parse(request);
      if (validated.assertion !== positiveReceiptAssertion) {
        return blocked(validated.assertion, unsupportedAssertionReason);
      }
      if (!input.enabled) return blocked(validated.assertion, pendingReason);

      const response = await input.callerRlsRpc.rpc("read_sales_bound_requirement_creation_receipt", {
        p_opportunity_id: validated.scope.opportunityId,
        p_customer_id: validated.scope.customerId,
        p_master_specification_version_id: validated.scope.masterSpecificationVersionId,
        p_request_key: validated.scope.requestKey,
      });
      if (response.error) return blocked(validated.assertion, "The scoped positive receipt RPC returned unavailable or denied evidence.");
      const rows = z.array(receiptGraphRowSchema).safeParse(response.data);
      if (!rows.success || rows.data.length !== 1 || !validatePositiveReceiptGraph(rows.data[0], validated.scope)) {
        return blocked(validated.assertion, "The scoped positive receipt RPC returned malformed, duplicate, mismatched, or incomplete graph evidence.");
      }
      return { status: "OBSERVED", assertion: validated.assertion, ok: true };
    },
  };
}

/** Production remains disabled until the pending RPC is deployed and isolated acceptance approves this binding. */
export async function observeSalesBoundRequirementReadback(
  request: SalesBoundRequirementReadRequest,
): Promise<SalesBoundRequirementReadback> {
  const validated = salesBoundRequirementReadRequestSchema.parse(request);
  return blocked(validated.assertion, validated.assertion === positiveReceiptAssertion ? pendingReason : unsupportedAssertionReason);
}

export function salesBoundRequirementReadScope(
  scope: SalesBoundRequirementReadScope,
): SalesBoundRequirementReadScope {
  return salesBoundRequirementReadScopeSchema.parse(scope);
}
