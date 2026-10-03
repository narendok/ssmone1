import { describe, expect, it, vi } from "vitest";
import { persistLifecycleDocumentDraft } from "./lifecycle-document-persistence";

const input = {
  requestKey: "request", sourceFingerprint: "source",
  rendered: { fileName: "draft.txt", mimeType: "text/plain" as const, content: "Project draft", templatePin: { templateKey: "PRS", version: 1, documentRevisionId: "revision" } },
};
const receipt = { requestKey: "request", nodeId: "node", revisionId: "revision", registerId: "register", auditEventId: "audit", sourceFingerprint: "source" };
function transaction() {
  return { authorize: vi.fn(async () => undefined), findReceipt: vi.fn(async () => receipt), persist: vi.fn(async () => receipt), rollback: vi.fn(async () => undefined) };
}

describe("protected document persistence", () => {
  it("denies replay without reading or disclosing a receipt", async () => {
    const tx = transaction();
    tx.authorize.mockRejectedValue(new Error("Access revoked"));
    await expect(persistLifecycleDocumentDraft(tx, input)).rejects.toThrow("Access revoked");
    expect(tx.findReceipt).not.toHaveBeenCalled();
    expect(tx.persist).not.toHaveBeenCalled();
    expect(tx.rollback).not.toHaveBeenCalled();
  });
  it("authorizes before replay and performs no writes on identical replay", async () => {
    const tx = transaction();
    await expect(persistLifecycleDocumentDraft(tx, input)).resolves.toEqual({ mode: "REPLAY", receipt });
    expect(tx.authorize.mock.invocationCallOrder[0]).toBeLessThan(tx.findReceipt.mock.invocationCallOrder[0]);
    expect(tx.persist).not.toHaveBeenCalled();
    expect(tx.rollback).not.toHaveBeenCalled();
  });
  it("rejects a receipt from another request", async () => {
    const tx = transaction();
    tx.findReceipt.mockResolvedValue({ ...receipt, requestKey: "different" });
    await expect(persistLifecycleDocumentDraft(tx, input)).rejects.toThrow("request key");
    expect(tx.persist).not.toHaveBeenCalled();
  });
  it("retains both the original database failure and cleanup failure", async () => {
    const saveError = new Error("Database rejected register");
    const cleanupError = new Error("Storage cleanup failed");
    const tx = { ...transaction(), findReceipt: vi.fn(async () => null) };
    tx.persist.mockRejectedValue(saveError);
    tx.rollback.mockRejectedValue(cleanupError);
    try {
      await persistLifecycleDocumentDraft(tx, input);
      throw new Error("Expected persistence failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toEqual([saveError, cleanupError]);
    }
  });
});
