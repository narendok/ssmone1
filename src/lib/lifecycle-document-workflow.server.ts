import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifecycleTransactionClient } from "./lifecycle-actor-transport.server";
import { loadLifecycleDocumentPreflight } from "./lifecycle-document-preflight.server";
import { createLifecycleDocumentDatabaseBridge } from "./lifecycle-document-database.server";
import { createDocumentStorageTransaction } from "./lifecycle-document-storage.server";
import { persistLifecycleDocumentDraft } from "./lifecycle-document-persistence";

export type LifecycleDocumentRequest = Parameters<typeof loadLifecycleDocumentPreflight>[1];

/** Source-only composition. The route must supply a verified actor-preserving
 * transaction client after acceptance; a caller-token client alone cannot execute
 * the service-only proposal. No client credentials or deployment flag live here.
 */
export async function runLifecycleDocumentWorkflow(
  readClient: SupabaseClient,
  input: LifecycleDocumentRequest,
  acceptedTransactionClient: () => Promise<LifecycleTransactionClient>,
) {
  // Resolve acceptance before reading pending tables or staging any bytes.
  const transactionClient = await acceptedTransactionClient();
  const preflight = await loadLifecycleDocumentPreflight(readClient, input);
  const bridge = createLifecycleDocumentDatabaseBridge(
    transactionClient, preflight.projectId, preflight.targetFolderId,
  );
  const transaction = createDocumentStorageTransaction(
    transactionClient.storage, bridge, preflight.projectId,
  );
  return persistLifecycleDocumentDraft(transaction, {
    rendered: preflight.rendered,
    requestKey: preflight.requestKey,
    sourceFingerprint: preflight.sourceFingerprint,
  });
}
