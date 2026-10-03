import { describe, expect, it } from "vitest";
import { planLifecycleDocumentDraft } from "./lifecycle-document-generation.contract";

const ready = {
  projectId: "project-1",
  projectRevision: "TEST-01",
  projectDriveRootId: "root-1",
  departmentId: "department-1",
  templateId: "template-1",
  templateVersion: 2,
  targetFolderId: "folder-1",
  sourceFields: { project: "project-1", revision: "TEST-01", title: "Sample plan" },
};

describe("lifecycle document-draft planning contract", () => {
  it("blocks when authoritative Drive or template provenance is missing", () => {
    const plan = planLifecycleDocumentDraft({ ...ready, projectDriveRootId: null, templateId: null });
    expect(plan.state).toBe("BLOCKED");
    expect(plan.missingProvenance).toEqual(["Project Drive root", "Active template pin"]);
    expect(plan.retryMode).toBe("UNAVAILABLE");
  });

  it("pins a versioned template and requests a single initial draft", () => {
    const plan = planLifecycleDocumentDraft(ready);
    expect(plan.immutableTemplatePin).toEqual({ templateId: "template-1", templateVersion: 2 });
    expect(plan.retryMode).toBe("CREATE_ONCE");
    expect(plan.sourceFingerprint).toBe(JSON.stringify([["project", "project-1"], ["revision", "TEST-01"], ["title", "Sample plan"]]));
  });

  it("replays an unchanged draft instead of duplicating it", () => {
    const plan = planLifecycleDocumentDraft({ ...ready, existingDraft: {
      nodeId: "node-1", revisionId: "revision-1", templateId: "template-1", templateVersion: 2,
      sourceFingerprint: planLifecycleDocumentDraft(ready).sourceFingerprint!, manualEditFingerprint: null, status: "DRAFT",
    } });
    expect(plan.retryMode).toBe("REPLAY_EXISTING");
  });

  it("protects manual edits and approved versions by requiring a new draft", () => {
    const plan = planLifecycleDocumentDraft({ ...ready, existingDraft: {
      nodeId: "node-1", revisionId: "revision-1", templateId: "template-1", templateVersion: 2,
      sourceFingerprint: "old", manualEditFingerprint: "manual", status: "APPROVED",
    } });
    expect(plan.retryMode).toBe("REQUIRE_NEW_DRAFT");
    expect(plan.preservation).toMatchObject({ preserveManualEdits: true, preserveApprovedVersions: true, staleSourceDetected: true });
  });
});

describe("draft source and template identity", () => {
  it("distinguishes delimiters, null values and field order", () => {
    const fingerprint = (sourceFields: Record<string, string | null>) => planLifecycleDocumentDraft({ ...ready, sourceFields }).sourceFingerprint;
    expect(fingerprint({ A: "x|B:y" })).not.toBe(fingerprint({ A: "x", B: "y" }));
    expect(fingerprint({ A: null })).not.toBe(fingerprint({ A: "" }));
    expect(fingerprint({ B: "y", A: "x" })).toBe(fingerprint({ A: "x", B: "y" }));
  });
  it.each([{ templateId: "different", templateVersion: 2 }, { templateId: "template-1", templateVersion: 1 }])("requires a new draft when the template pin changes: %o", (pin) => {
    const plan = planLifecycleDocumentDraft({ ...ready, existingDraft: {
      nodeId: "node-1", revisionId: "revision-1", ...pin,
      sourceFingerprint: planLifecycleDocumentDraft(ready).sourceFingerprint!, manualEditFingerprint: null, status: "DRAFT",
    } });
    expect(plan.retryMode).toBe("REQUIRE_NEW_DRAFT");
  });
});
