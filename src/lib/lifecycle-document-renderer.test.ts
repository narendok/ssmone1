import { describe, expect, it } from "vitest";
import { renderLifecycleDocument } from "./lifecycle-document-renderer";
import { persistLifecycleDocumentDraft } from "./lifecycle-document-persistence";

const template = { templateKey: "OEM-TRACKER", version: 3, title: "OEM tracker", documentRevisionId: "template-revision-3", content: "Project: {{PROJECT_CODE}}\nRevision: {{PROJECT_REVISION}}\nOwner: {{DEPARTMENT}}" };
const fields = { PROJECT_CODE: "PROJECT-2026-0005", PROJECT_REVISION: "TEST-01", DEPARTMENT: "Hardware & R&D" };

describe("lifecycle document renderer", () => {
  it("renders deterministic populated template content with a version pin", () => {
    expect(renderLifecycleDocument(template, fields)).toEqual({
      fileName: "PROJECT-2026-0005-OEM-TRACKER-v3.txt", mimeType: "text/plain",
      content: "Project: PROJECT-2026-0005\nRevision: TEST-01\nOwner: Hardware & R&D",
      templatePin: { templateKey: "OEM-TRACKER", version: 3, documentRevisionId: "template-revision-3" },
    });
  });

  it("fails closed rather than producing an incomplete document", () => {
    expect(() => renderLifecycleDocument(template, { ...fields, DEPARTMENT: null })).toThrow("DEPARTMENT");
  });

  it.each(["{{project_code}}", "{{UNKNOWN-FIELD}}", "{{PROJECT_CODE", "PROJECT_CODE}}"])("rejects malformed placeholders: %s", (content) => {
    expect(() => renderLifecycleDocument({ ...template, content }, fields)).toThrow("Invalid document template placeholder");
  });

  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid template version: %s", (version) => {
    expect(() => renderLifecycleDocument({ ...template, version }, fields)).toThrow("positive integer");
  });

  it("preserves literal project text instead of interpreting it as template code", () => {
    const rendered = renderLifecycleDocument(template, { ...fields, DEPARTMENT: "Hardware {{CUSTOMER_TEXT}}" });
    expect(rendered.content).toContain("Hardware {{CUSTOMER_TEXT}}");
  });

  it("rejects empty template content", () => {
    expect(() => renderLifecycleDocument({ ...template, content: "  " }, fields)).toThrow("required");
  });

  it("requires an immutable content revision pin", () => {
    expect(() => renderLifecycleDocument({ ...template, documentRevisionId: " " }, fields)).toThrow("revision");
  });

  it("replays an identical receipt and rejects a conflicting request key", async () => {
    const receipt = { requestKey: "key", nodeId: "node", revisionId: "revision", registerId: "register", auditEventId: "audit", sourceFingerprint: "same" };
    const transaction = { authorize: async () => undefined, findReceipt: async () => receipt, persist: async () => receipt, rollback: async () => undefined };
    await expect(persistLifecycleDocumentDraft(transaction, { rendered: renderLifecycleDocument(template, fields), requestKey: "key", sourceFingerprint: "same" })).resolves.toMatchObject({ mode: "REPLAY" });
    await expect(persistLifecycleDocumentDraft(transaction, { rendered: renderLifecycleDocument(template, fields), requestKey: "key", sourceFingerprint: "other" })).rejects.toThrow("conflicts");
  });

  it("compensates persistence failure before surfacing it", async () => {
    let rolledBack = false;
    const transaction = { authorize: async () => undefined, findReceipt: async () => null, persist: async () => { throw new Error("register failed"); }, rollback: async () => { rolledBack = true; } };
    await expect(persistLifecycleDocumentDraft(transaction, { rendered: renderLifecycleDocument(template, fields), requestKey: "new", sourceFingerprint: "same" })).rejects.toThrow("register failed");
    expect(rolledBack).toBe(true);
  });
});
