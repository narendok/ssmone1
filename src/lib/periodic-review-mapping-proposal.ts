export const PERIODIC_REVIEW_METADATA = { taxonomy: "periodic-conditional-review-v1", category: "PERIODIC_CONDITIONAL_REVIEW", placement: "COMMON" } as const;

export function periodicReviewMappingPreflight(input: { departmentId: string | null; standardsRootId: string | null; existingReviewFolderIds: string[] }) {
  if (!input.departmentId) return { canProvision: false, reason: "A verified department owner is required." } as const;
  if (!input.standardsRootId) return { canProvision: false, reason: "The department standards root is missing." } as const;
  if (input.existingReviewFolderIds.length > 1) return { canProvision: false, reason: "More than one review root exists; reconcile manually before any provision." } as const;
  return { canProvision: true, reason: input.existingReviewFolderIds.length ? "Existing canonical review root would be reused." : "A new locked review root could be created beneath the verified standards root." } as const;
}