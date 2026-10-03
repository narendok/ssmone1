import { describe, expect, it, vi } from "vitest";
import { createLifecycleDocumentDatabaseBridge } from "./lifecycle-document-database.server";
import { createDocumentStorageTransaction } from "./lifecycle-document-storage.server";
import { persistLifecycleDocumentDraft } from "./lifecycle-document-persistence";

const receipt = {
  request_key: "00000000-0000-0000-0000-000000000001",
  node_id: "node",
  revision_id: "revision",
  register_id: "register",
  audit_event_id: "audit",
  source_fingerprint: "fingerprint",
};

function fixture(responses: Record<string, { data: unknown; error: { message: string } | null }>) {
  const rpc = vi.fn((name: string, _args?: unknown) => Promise.resolve(responses[name] ?? { data: null, error: null }));
  return { rpc, bridge: createLifecycleDocumentDatabaseBridge({ rpc } as never, "project", "target-folder") };
}

const rendered = { fileName: "draft.txt", mimeType: "text/plain" as const, content: "Draft", templatePin: { templateKey: "OEM", version: 1 } };
const input = { requestKey: receipt.request_key, sourceFingerprint: receipt.source_fingerprint, rendered };
const staged = { bucket: "project-drive" as const, path: "project/attempt-draft.txt", sha256: "a".repeat(64), sizeBytes: 5 };

describe("lifecycle document database bridge", () => {
  it("uses database-owned authorization and never sends browser template content", async () => {
    const f = fixture({ authorize_lifecycle_document_draft: { data: null, error: null } });
    await f.bridge.authorize(input);
    expect(f.rpc).toHaveBeenCalledWith("authorize_lifecycle_document_draft", expect.objectContaining({
      p_template_key: "OEM", p_template_version: 1, p_request_key: input.requestKey,
    }));
    expect(f.rpc.mock.calls[0]?.[1]).not.toHaveProperty("templateContent");
    expect(f.rpc.mock.calls[0]?.[1]).not.toHaveProperty("fields");
  });

  it("maps an identical receipt and preserves the server transaction outcome", async () => {
    const f = fixture({ commit_lifecycle_document_draft: { data: { ...receipt, uses_staged_object: false }, error: null } });
    await expect(f.bridge.commit(input, staged)).resolves.toEqual({
      receipt: { requestKey: input.requestKey, nodeId: "node", revisionId: "revision", registerId: "register", auditEventId: "audit", sourceFingerprint: "fingerprint" },
      usesStagedObject: false,
    });
    expect(f.rpc).toHaveBeenCalledWith("commit_lifecycle_document_draft", expect.objectContaining({
      p_project_id: "project", p_target_folder_id: "target-folder", p_storage_path: staged.path, p_sha256_checksum: staged.sha256, p_size_bytes: 5,
    }));
  });

  it("refuses cleanup when the database cannot prove an attempt is unreferenced", async () => {
    const f = fixture({ can_discard_lifecycle_document_object: { data: false, error: null } });
    await expect(f.bridge.canDiscard(staged)).resolves.toBe(false);
  });

  it("surfaces database authorization errors before an upload can proceed", async () => {
    const f = fixture({ authorize_lifecycle_document_draft: { data: null, error: { message: "Not authorized" } } });
    await expect(f.bridge.authorize(input)).rejects.toThrow("Not authorized");
  });

  it("prevents an unauthorized bridge from uploading staged content", async () => {
    const f = fixture({ authorize_lifecycle_document_draft: { data: null, error: { message: "Out of scope" } } });
    const upload = vi.fn();
    const storage = { from: vi.fn(() => ({ upload, remove: vi.fn() })) };
    const tx = createDocumentStorageTransaction(storage as never, f.bridge, "00000000-0000-0000-0000-000000000010");
    await expect(persistLifecycleDocumentDraft(tx, input)).rejects.toThrow("Out of scope");
    expect(upload).not.toHaveBeenCalled();
  });
});