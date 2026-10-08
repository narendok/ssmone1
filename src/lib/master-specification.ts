import { z } from "zod";

export const MASTER_SPECIFICATION_UNKNOWN = "Unknown";
export const MASTER_SPECIFICATION_TBC = "To be confirmed";

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const engineeringWorkstreamSchema = z.enum(["HARDWARE", "FIRMWARE", "MECHANICAL", "TEST", "MANUFACTURING"]);

export const masterSpecificationDraftSchema = z.object({
  proposedName: boundedText(240), customerOrInternalOwner: boundedText(240), industryApplication: boundedText(240), productFamily: boundedText(240), developmentScope: boundedText(2000),
  workstreams: z.array(engineeringWorkstreamSchema).min(1).max(5).transform((items) => [...new Set(items)]), requirementSummary: boundedText(8000),
  powerAndUnits: boundedText(1000), interfaces: boundedText(1000), connectivityAndGnss: boundedText(1000), environmentAndIp: boundedText(1000), volumes: boundedText(1000), schedule: boundedText(1000), requestedStandards: boundedText(2000), exclusions: boundedText(2000),
});

export type MasterSpecificationDraft = z.infer<typeof masterSpecificationDraftSchema>;
export const masterSpecificationSaveSchema = z.object({ specificationId: z.string().uuid().nullable(), opportunityId: z.string().uuid(), expectedVersion: z.number().int().min(0), changeSummary: boundedText(1000), draft: masterSpecificationDraftSchema });
export function masterSpecificationTitle(draft: MasterSpecificationDraft) { return `${draft.proposedName} — Master Specification`; }
export function draftFromSpecificationData(data: unknown): MasterSpecificationDraft | null { const parsed = masterSpecificationDraftSchema.safeParse(data); return parsed.success ? parsed.data : null; }