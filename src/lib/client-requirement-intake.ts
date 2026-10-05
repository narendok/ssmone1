import { z } from "zod";

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const clientRequirementIntakeSchema = z.object({
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
  verdict: z.enum(["FEASIBLE", "FEASIBLE_WITH_CHANGES", "NOT_FEASIBLE"]),
  response: boundedText(12_000),
});

export type ClientRequirementIntake = z.infer<typeof clientRequirementIntakeSchema>;

export function clientRequirementState(input: { expiresAt: string | null; isActive: boolean; revokedAt: string | null }, now = new Date()): "ACTIVE" | "EXPIRED" | "REVOKED" {
  if (!input.isActive || input.revokedAt) return "REVOKED";
  if (input.expiresAt && new Date(input.expiresAt) <= now) return "EXPIRED";
  return "ACTIVE";
}

export function mayRecordFeasibility(input: { assignedTo: string; actorId: string; isEngineeringManager: boolean; status: string }): boolean {
  return input.status !== "RESPONDED" && (input.assignedTo === input.actorId || input.isEngineeringManager);
}