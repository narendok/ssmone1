import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentDraftReceipt, DocumentDraftTransaction } from "./lifecycle-document-persistence";

type Input = Parameters<DocumentDraftTransaction["persist"]>[0];
export type StagedDocument = {
  bucket: "project-drive"; path: string; sha256: string; sizeBytes: number;
};

/** Backend transaction adapter must be accepted before this is wired to a route. */
export type DocumentDatabaseBridge = {
  authorize: DocumentDraftTransaction["authorize"];
  findReceipt: DocumentDraftTransaction["findReceipt"];
  registerAttempt(input: Input, staged: StagedDocument): Promise<void>;
  // Must atomically reauthorize and persist node, revision, register, audit,
  // numbering and immutable receipt, or return a verified concurrent replay.
  commit(input: Input, staged: StagedDocument): Promise<{ receipt: DocumentDraftReceipt; usesStagedObject: boolean }>;
  // Must prove this exact attempt object has no DB reference. If the commit
  // outcome is uncertain, return false and retain it for controlled recovery.
  canDiscard(staged: StagedDocument): Promise<boolean>;
};

/** Concrete Supabase upload/compensation adapter; no independent DB inserts. */
export function createDocumentStorageTransaction(
  storage: SupabaseClient["storage"],
  database: DocumentDatabaseBridge,
  projectId: string,
): DocumentDraftTransaction {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new Error("A valid project ID is required for document storage.");
  }
  let staged: StagedDocument | null = null;
  let referenced = false;
  const rollback = async () => {
    if (!staged || referenced) return;
    if (!await database.canDiscard(staged)) {
      throw new Error("Staged document retained pending reconciliation of the database outcome.");
    }
    const { error } = await storage.from(staged.bucket).remove([staged.path]);
    if (error) throw new Error(error.message);
    staged = null;
  };
  return {
    authorize: (input) => database.authorize(input),
    findReceipt: (requestKey) => database.findReceipt(requestKey),
    rollback,
    persist: async (input) => {
      if (staged || referenced) throw new Error("Document storage transaction instances cannot be reused.");
      await database.authorize(input);
      const bytes = new TextEncoder().encode(input.rendered.content);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const candidate: StagedDocument = {
        bucket: "project-drive", path: `${projectId}/${crypto.randomUUID()}-draft.txt`,
        sha256: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""),
        sizeBytes: bytes.byteLength,
      };
      staged = candidate;
      const { error } = await storage.from(candidate.bucket).upload(candidate.path, bytes, {
        upsert: false, contentType: input.rendered.mimeType,
      });
      // Even a failed response may mean an upload succeeded. Compensation must
      // reconcile this attempt, never touch another request's storage object.
      if (error) throw new Error(error.message);
      await database.registerAttempt(input, candidate);
      const committed = await database.commit(input, candidate);
      referenced = committed.usesStagedObject;
      if (!referenced) await rollback();
      return committed.receipt;
    },
  };
}
