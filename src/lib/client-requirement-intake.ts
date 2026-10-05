import { z } from "zod";

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const clientRequirementIntakeSchema = z.object({
  opportunityId: z.string().uuid(),
  customerId: z.string().uuid(),
  title: boundedText(240),
  description: boundedText(12_000),
  customerReference: z.string().trim().max(240).nullable(),
});

export const feasibilityAssignmentSchema = z.object({
  requirementId: z.string().uuid(),
  reviewerUserId: z.string().uuid(),
  departmentId: z.string().uuid(),
});

export const feasibilityResponseSchema = z.object({
  reviewId: z.string().uuid(),
  verdict: z.enum(["feasible", "feasible_with_conditions", "not_feasible"]),
  findings: boundedText(12_000),
  assumptions: z.string().trim().max(12_000).nullable(),
  risks: z.string().trim().max(12_000).nullable(),
});

export type ClientRequirementIntake = z.infer<typeof clientRequirementIntakeSchema>;
export type FeasibilityResponse = z.infer<typeof feasibilityResponseSchema>;

export const protectedIntakeAvailability = {
  available: false,
  reason: "Client requirement submission and feasibility responses stay unavailable until the protected database contract passes isolated acceptance.",
} as const;

export function clientRequirementState(input: { expiresAt: string | null; isActive: boolean; revokedAt: string | null }, now = new Date()): "ACTIVE" | "EXPIRED" | "REVOKED" {
  if (!input.isActive || input.revokedAt) return "REVOKED";
  if (input.expiresAt && new Date(input.expiresAt) <= now) return "EXPIRED";
  return "ACTIVE";
}

export function mayRecordFeasibility(input: { assignedTo: string; actorId: string; isEngineeringManager: boolean; status: string }): boolean {
  return !["feasible", "feasible_with_conditions", "not_feasible"].includes(input.status) && (input.assignedTo === input.actorId || input.isEngineeringManager);
}

export function mayExposeClientRequirement(input: { isActive: boolean; revokedAt: string | null; expiresAt: string | null; accessScope: unknown; opportunityId: string; customerId: string }, now = new Date()): boolean {
  if (clientRequirementState(input, now) !== "ACTIVE" || !input.accessScope || typeof input.accessScope !== "object") return false;
  const scope = input.accessScope as { opportunityIds?: unknown; customerIds?: unknown };
  return Array.isArray(scope.opportunityIds) && Array.isArray(scope.customerIds)
    && scope.opportunityIds.includes(input.opportunityId)
    && scope.customerIds.includes(input.customerId);
}
