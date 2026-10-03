export type LifecycleDocumentDraftInput = {
  projectId: string;
  projectRevision: string | null;
  projectDriveRootId: string | null;
  departmentId: string | null;
  templateId: string | null;
  templateVersion: number | null;
  targetFolderId: string | null;
  sourceFields: Record<string, string | null>;
  existingDraft?: {
    nodeId: string;
    revisionId: string;
    templateId: string;
    templateVersion: number;
    sourceFingerprint: string;
    manualEditFingerprint: string | null;
    status: "DRAFT" | "APPROVED";
  } | null;
};

export type LifecycleDocumentGenerationPlan = {
  state: "BLOCKED" | "READY_TO_PROPOSE";
  immutableTemplatePin: { templateId: string; templateVersion: number } | null;
  requiredProvenance: string[];
  missingProvenance: string[];
  sourceFingerprint: string | null;
  retryMode: "CREATE_ONCE" | "REPLAY_EXISTING" | "REQUIRE_NEW_DRAFT" | "UNAVAILABLE";
  preservation: {
    preserveManualEdits: boolean;
    preserveApprovedVersions: boolean;
    staleSourceDetected: boolean;
  };
  unavailableReason: string | null;
};

function fingerprint(fields: Record<string, string | null>) {
  return Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value ?? ""}`)
    .join("|");
}

/**
 * Plans a document draft without rendering, uploading, registering, or
 * modifying a Drive file. A separate accepted server action will own those
 * effects, audit events, and idempotent request receipts.
 */
export function planLifecycleDocumentDraft(input: LifecycleDocumentDraftInput): LifecycleDocumentGenerationPlan {
  const requiredProvenance = ["Project", "Project revision", "Owning department", "Project Drive root", "Target Drive folder", "Active template pin"];
  const missingProvenance = [
    !input.projectId ? "Project" : null,
    !input.projectRevision ? "Project revision" : null,
    !input.departmentId ? "Owning department" : null,
    !input.projectDriveRootId ? "Project Drive root" : null,
    !input.targetFolderId ? "Target Drive folder" : null,
    !input.templateId || !input.templateVersion ? "Active template pin" : null,
  ].filter((item): item is string => Boolean(item));
  const sourceFingerprint = missingProvenance.length ? null : fingerprint(input.sourceFields);
  const existing = input.existingDraft ?? null;
  const staleSourceDetected = Boolean(existing && sourceFingerprint && existing.sourceFingerprint !== sourceFingerprint);
  const immutableTemplatePin = input.templateId && input.templateVersion
    ? { templateId: input.templateId, templateVersion: input.templateVersion }
    : null;

  if (missingProvenance.length) {
    return {
      state: "BLOCKED", immutableTemplatePin, requiredProvenance, missingProvenance, sourceFingerprint,
      retryMode: "UNAVAILABLE", preservation: { preserveManualEdits: true, preserveApprovedVersions: true, staleSourceDetected },
      unavailableReason: "Authoritative provenance is incomplete; draft generation must not infer missing values.",
    };
  }

  if (existing?.status === "APPROVED" || staleSourceDetected || Boolean(existing?.manualEditFingerprint)) {
    return {
      state: "READY_TO_PROPOSE", immutableTemplatePin, requiredProvenance, missingProvenance, sourceFingerprint,
      retryMode: "REQUIRE_NEW_DRAFT", preservation: { preserveManualEdits: true, preserveApprovedVersions: true, staleSourceDetected },
      unavailableReason: "A new draft is required; existing manual edits and approved versions must remain immutable.",
    };
  }

  if (existing) {
    return {
      state: "READY_TO_PROPOSE", immutableTemplatePin, requiredProvenance, missingProvenance, sourceFingerprint,
      retryMode: "REPLAY_EXISTING", preservation: { preserveManualEdits: true, preserveApprovedVersions: true, staleSourceDetected: false },
      unavailableReason: null,
    };
  }

  return {
    state: "READY_TO_PROPOSE", immutableTemplatePin, requiredProvenance, missingProvenance, sourceFingerprint,
    retryMode: "CREATE_ONCE", preservation: { preserveManualEdits: true, preserveApprovedVersions: true, staleSourceDetected: false },
    unavailableReason: null,
  };
}