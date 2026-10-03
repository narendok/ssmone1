import type { RenderedLifecycleDocument } from "./lifecycle-document-renderer";

export type DocumentDraftReceipt = { requestKey: string; nodeId: string; revisionId: string; registerId: string; auditEventId: string; sourceFingerprint: string };

export type DocumentDraftTransaction = {
  findReceipt(requestKey: string): Promise<DocumentDraftReceipt | null>;
  persist(input: { rendered: RenderedLifecycleDocument; requestKey: string; sourceFingerprint: string }): Promise<DocumentDraftReceipt>;
  rollback(): Promise<void>;
};

/**
 * Server-only orchestration shape. The database implementation must atomically
 * persist storage, Drive revision, DRAFT register, immutable receipt and audit
 * event; compensation is required for storage if the DB transaction rejects.
 */
export async function persistLifecycleDocumentDraft(
  transaction: DocumentDraftTransaction,
  input: { rendered: RenderedLifecycleDocument; requestKey: string; sourceFingerprint: string },
) {
  const replay = await transaction.findReceipt(input.requestKey);
  if (replay) {
    if (replay.sourceFingerprint !== input.sourceFingerprint) throw new Error("Request key conflicts with different document source data.");
    return { mode: "REPLAY" as const, receipt: replay };
  }
  try {
    const receipt = await transaction.persist(input);
    return { mode: "CREATED" as const, receipt };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}