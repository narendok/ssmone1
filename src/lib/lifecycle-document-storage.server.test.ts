import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createDocumentStorageTransaction } from "./lifecycle-document-storage.server";
import { persistLifecycleDocumentDraft } from "./lifecycle-document-persistence";

const input = { requestKey: "request", sourceFingerprint: "snapshot", rendered: {
  fileName: "project.txt", mimeType: "text/plain" as const, content: "भारत OEM", templatePin: { templateKey: "PRS", version: 1 },
} };
const receipt = { requestKey: "request", sourceFingerprint: "snapshot", nodeId: "file", revisionId: "rev", registerId: "reg", auditEventId: "audit" };
const projectId = "00000000-0000-0000-0000-000000000001";
function fixture() {
  const upload = vi.fn(async (_path: string, _bytes: Uint8Array, _options: { upsert: boolean; contentType: string }) => ({ data: null, error: null }));
  const remove = vi.fn(async (_paths: string[]) => ({ data: [], error: null }));
  const storage = { from: vi.fn(() => ({ upload, remove })) } as unknown as SupabaseClient["storage"];
  const bridge = {
    authorize: vi.fn(async () => undefined), findReceipt: vi.fn(async () => null),
    commit: vi.fn(async () => ({ receipt, usesStagedObject: true })), canDiscard: vi.fn(async () => true),
  };
  return { upload, remove, bridge, transaction: createDocumentStorageTransaction(storage, bridge, projectId) };
}
describe("Supabase document storage adapter", () => {
  it("uploads UTF-8 content and commits checksum/byte count without deleting a committed file", async () => {
    const f = fixture();
    await expect(persistLifecycleDocumentDraft(f.transaction, input)).resolves.toMatchObject({ mode: "CREATED" });
    const staged = f.bridge.commit.mock.calls[0] as unknown as [unknown, { sizeBytes: number; sha256: string }];
    expect(staged[1].sizeBytes).toBe(new TextEncoder().encode(input.rendered.content).byteLength);
    expect(staged[1].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(f.upload).toHaveBeenCalledWith(expect.stringContaining(projectId), expect.any(Uint8Array), { upsert: false, contentType: "text/plain" });
    await f.transaction.rollback();
    expect(f.remove).not.toHaveBeenCalled();
  });
  it("does not upload or query receipts when authorization fails", async () => {
    const f = fixture(); f.bridge.authorize.mockRejectedValue(new Error("Denied"));
    await expect(persistLifecycleDocumentDraft(f.transaction, input)).rejects.toThrow("Denied");
    expect(f.upload).not.toHaveBeenCalled(); expect(f.bridge.findReceipt).not.toHaveBeenCalled();
  });
  it("compensates its exact upload when database rejects", async () => {
    const f = fixture(); f.bridge.commit.mockRejectedValue(new Error("DB rejected"));
    await expect(persistLifecycleDocumentDraft(f.transaction, input)).rejects.toThrow("DB rejected");
    expect(f.remove).toHaveBeenCalledWith([f.upload.mock.calls[0][0]]);
  });
  it("retains an object when commit outcome cannot be proven", async () => {
    const f = fixture(); f.bridge.commit.mockRejectedValue(new Error("Timeout")); f.bridge.canDiscard.mockResolvedValue(false);
    await expect(persistLifecycleDocumentDraft(f.transaction, input)).rejects.toThrow("cleanup requires recovery");
    expect(f.remove).not.toHaveBeenCalled();
  });
  it("cleans only the losing attempt on a concurrent replay", async () => {
    const f = fixture(); f.bridge.commit.mockResolvedValue({ receipt, usesStagedObject: false });
    await persistLifecycleDocumentDraft(f.transaction, input);
    expect(f.remove).toHaveBeenCalledWith([f.upload.mock.calls[0][0]]);
  });
});
