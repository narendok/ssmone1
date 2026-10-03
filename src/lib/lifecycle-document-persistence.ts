import type { RenderedLifecycleDocument } from "./lifecycle-document-renderer";

export type DocumentDraftReceipt = { requestKey: string; nodeId: string; revisionId: string; registerId: string; auditEventId: string; sourceFingerprint: string };

export type DocumentDraftTransaction = {
  // Recheck the authenticated actor and project/template/target scope even
  // when an existing receipt can be returned. Never trust a cached role.
  authorize(input: { rendered: RenderedLifecycleDocument; requestKey: string; sourceFingerprint: string }): Promise<void>;
  findReceipt(input: { rendered: RenderedLifecycleDocument; requestKey: string; sourceFingerprint: string }): Promise<DocumentDraftReceipt | null>;
  persist(input: { rendered: RenderedLifecycleDocument; requestKey: string; sourceFingerprint: string }): Promise<DocumentDraftReceipt>;
  rollback(): Promise<void>;
};

/**
 * Server-only orchestration shape. The database implementation must atomically
 * persist Drive revision, DRAFT register, immutable receipt and audit event.
 * Storage is external to that DB transaction and requires compensation.
 */
export async function persistLifecycleDocumentDraft(
  transaction: DocumentDraftTransaction,
  input: { rendered: RenderedLifecycleDocument; requestKey: string; sourceFingerprint: string },
) {
  await transaction.authorize(input);
  const replay = await transaction.findReceipt(input);
  if (replay) {
    if (replay.requestKey !== input.requestKey) throw new Error("Document receipt does not match the request key.");
    if (replay.sourceFingerprint !== input.sourceFingerprint) throw new Error("Request key conflicts with different document source data.");
    return { mode: "REPLAY" as const, receipt: replay };
  }
  try {
    const receipt = await transaction.persist(input);
    return { mode: "CREATED" as const, receipt };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Document save failed and storage cleanup requires recovery.");
    }
    throw error;
  }
}
