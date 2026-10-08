import { z } from "zod";
import {
  salesBaselineReadScopeSchema,
  salesCommercialReadScopeSchema,
  salesBoundRequirementReadScopeSchema,
  type SalesBaselineReadScope,
  type SalesCommercialReadScope,
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

export const salesCommercialReadRequestSchema = z.object({
  kind: z.literal("sales-commercial-read"),
  assertion: z.literal("commercial-receipt-readback"),
  scope: salesCommercialReadScopeSchema,
});

export type SalesCommercialReadRequest = z.infer<typeof salesCommercialReadRequestSchema>;

export type SalesCommercialReadback = {
  status: "OBSERVED" | "BLOCKED";
  assertion: "commercial-receipt-readback";
  ok?: true;
  missingContract?: string;
};

const commercialPendingReason = "The scoped caller-RLS Sales commercial receipt readback contract is pending isolated acceptance and deployment.";

const commercialReceiptGraphRowSchema = z.object({
  request_key: z.string().uuid(),
  requirement_id: z.string().uuid(),
  expected_revision_number: z.number().int().nonnegative(),
  commercial_record_id: z.string().uuid(),
  commercial_revision_id: z.string().uuid(),
  commercial_revision_number: z.number().int().positive(),
  audit_id: z.string().uuid(),
}).strict();

type CommercialReceiptGraphRow = z.infer<typeof commercialReceiptGraphRowSchema>;

function blockedCommercial(missingContract: string): SalesCommercialReadback {
  return { status: "BLOCKED", assertion: "commercial-receipt-readback", missingContract };
}

function validateCommercialReceiptGraph(
  row: CommercialReceiptGraphRow,
  scope: SalesCommercialReadScope,
): boolean {
  return row.request_key === scope.requestKey
    && row.requirement_id === scope.requirementId
    && row.expected_revision_number === scope.expectedRevisionNumber
    && row.commercial_revision_number === scope.expectedRevisionNumber + 1;
}

/**
 * Concrete caller-RLS binding for the reviewed, positive-only commercial receipt RPC.
 * It stays opt-in until isolated acceptance and deployment separately approve it; it never
 * uses an admin client and cannot prove rollback absence, prior history, or concurrency.
 */
export function createSalesCommercialReadbackAdapter(input: {
  callerRlsRpc: CallerRlsRpc;
  enabled: boolean;
}): { observe: (request: SalesCommercialReadRequest) => Promise<SalesCommercialReadback> } {
  return {
    async observe(request) {
      const validated = salesCommercialReadRequestSchema.parse(request);
      if (!input.enabled) return blockedCommercial(commercialPendingReason);

      const response = await input.callerRlsRpc.rpc("read_sales_commercial_save_receipt", {
        p_requirement_id: validated.scope.requirementId,
        p_expected_revision_number: String(validated.scope.expectedRevisionNumber),
        p_request_key: validated.scope.requestKey,
      });
      if (response.error) return blockedCommercial("The scoped positive commercial receipt RPC returned unavailable or denied evidence.");
      const rows = z.array(commercialReceiptGraphRowSchema).safeParse(response.data);
      if (!rows.success || rows.data.length !== 1 || !validateCommercialReceiptGraph(rows.data[0], validated.scope)) {
        return blockedCommercial("The scoped positive commercial receipt RPC returned malformed, duplicate, mismatched, or incomplete graph evidence.");
      }
      return { status: "OBSERVED", assertion: "commercial-receipt-readback", ok: true };
    },
  };
}

/** Production remains disabled until the pending RPC is deployed and isolated acceptance approves this binding. */
export async function observeSalesCommercialReadback(
  request: SalesCommercialReadRequest,
): Promise<SalesCommercialReadback> {
  salesCommercialReadRequestSchema.parse(request);
  return blockedCommercial(commercialPendingReason);
}

export function salesCommercialReadScope(scope: SalesCommercialReadScope): SalesCommercialReadScope {
  return salesCommercialReadScopeSchema.parse(scope);
}

export const salesBaselineReadRequestSchema = z.object({
  kind: z.literal("sales-baseline-read"),
  assertion: z.literal("baseline-receipt-readback"),
  scope: salesBaselineReadScopeSchema,
});

export type SalesBaselineReadRequest = z.infer<typeof salesBaselineReadRequestSchema>;

export type SalesBaselineReadback = {
  status: "OBSERVED" | "BLOCKED";
  assertion: "baseline-receipt-readback";
  ok?: true;
  missingContract?: string;
};

const baselinePendingReason = "The scoped caller-RLS Sales baseline receipt readback contract is pending isolated acceptance and deployment.";

const baselineReceiptGraphRowSchema = z.object({
  request_key: z.string().uuid(),
  requirement_id: z.string().uuid(),
  expected_revision_number: z.number().int().positive(),
  source_revision_id: z.string().uuid(),
  master_specification_version_id: z.string().uuid(),
  master_specification_version_number: z.number().int().positive(),
  baseline_id: z.string().uuid(),
  audit_id: z.string().uuid(),
}).strict();

type BaselineReceiptGraphRow = z.infer<typeof baselineReceiptGraphRowSchema>;

function blockedBaseline(missingContract: string): SalesBaselineReadback {
  return { status: "BLOCKED", assertion: "baseline-receipt-readback", missingContract };
}

function validateBaselineReceiptGraph(row: BaselineReceiptGraphRow, scope: SalesBaselineReadScope): boolean {
  return row.request_key === scope.requestKey
    && row.requirement_id === scope.requirementId
    && row.expected_revision_number === scope.expectedRevisionNumber
    && row.source_revision_id === scope.sourceRevisionId
    && row.master_specification_version_id === scope.masterSpecificationVersionId;
}

/**
 * Concrete caller-RLS binding for the reviewed, positive-only baseline RPC. It stays opt-in
 * until isolated acceptance and deployment separately approve it; it never uses an admin client
 * and cannot prove rollback absence, reviewer history, or concurrent persistence.
 */
export function createSalesBaselineReadbackAdapter(input: {
  callerRlsRpc: CallerRlsRpc;
  enabled: boolean;
}): { observe: (request: SalesBaselineReadRequest) => Promise<SalesBaselineReadback> } {
  return {
    async observe(request) {
      const validated = salesBaselineReadRequestSchema.parse(request);
      if (!input.enabled) return blockedBaseline(baselinePendingReason);

      const response = await input.callerRlsRpc.rpc("read_sales_requirement_baseline_approval_receipt", {
        p_requirement_id: validated.scope.requirementId,
        p_expected_revision_number: String(validated.scope.expectedRevisionNumber),
        p_source_revision_id: validated.scope.sourceRevisionId,
        p_master_specification_version_id: validated.scope.masterSpecificationVersionId,
        p_request_key: validated.scope.requestKey,
      });
      if (response.error) return blockedBaseline("The scoped positive baseline receipt RPC returned unavailable or denied evidence.");
      const rows = z.array(baselineReceiptGraphRowSchema).safeParse(response.data);
      if (!rows.success || rows.data.length !== 1 || !validateBaselineReceiptGraph(rows.data[0], validated.scope)) {
        return blockedBaseline("The scoped positive baseline receipt RPC returned malformed, duplicate, mismatched, or incomplete graph evidence.");
      }
      return { status: "OBSERVED", assertion: "baseline-receipt-readback", ok: true };
    },
  };
}

/** Production remains disabled until the pending RPC is deployed and isolated acceptance approves this binding. */
export async function observeSalesBaselineReadback(
  request: SalesBaselineReadRequest,
): Promise<SalesBaselineReadback> {
  salesBaselineReadRequestSchema.parse(request);
  return blockedBaseline(baselinePendingReason);
}

export function salesBaselineReadScope(scope: SalesBaselineReadScope): SalesBaselineReadScope {
  return salesBaselineReadScopeSchema.parse(scope);
}
