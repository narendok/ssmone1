import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentDraftReceipt, DocumentDraftTransaction } from "./lifecycle-document-persistence";
import type { DocumentDatabaseBridge, StagedDocument } from "./lifecycle-document-storage.server";

type CommitInput = Parameters<DocumentDatabaseBridge["commit"]>[0];

type DocumentDraftRpcResult = {
  request_key: string;
  node_id: string;
  revision_id: string;
  register_id: string;
  audit_event_id: string;
  source_fingerprint: string;
  uses_staged_object?: boolean;
};

function toReceipt(result: DocumentDraftRpcResult): DocumentDraftReceipt {
  return {
    requestKey: result.request_key,
    nodeId: result.node_id,
    revisionId: result.revision_id,
    registerId: result.register_id,
    auditEventId: result.audit_event_id,
    sourceFingerprint: result.source_fingerprint,
  };
}

function readReceipt(data: unknown): DocumentDraftRpcResult | null {
  if (data == null) return null;
  if (Array.isArray(data)) {
    if (!data.length) return null;
    if (data.length !== 1) throw new Error("Ambiguous document draft receipt response.");
    data = data[0];
  }
  if (!data || typeof data !== "object") throw new Error("Invalid document draft receipt response.");
  const result = data as Record<string, unknown>;
  for (const key of ["request_key", "node_id", "revision_id", "register_id", "audit_event_id", "source_fingerprint"]) {
    if (typeof result[key] !== "string" || !(result[key] as string).trim()) throw new Error("Incomplete document draft receipt response.");
  }
  return result as DocumentDraftRpcResult;
}

function throwRpcError(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

/**
 * Maps the accepted database RPC to the storage adapter. The RPC remains
 * unapplied and this bridge is deliberately unreachable while the lifecycle
 * mutation gate is closed; it exists so the eventual bridge has no browser
 * supplied document body, template pin, or Drive provenance.
 */
export function createLifecycleDocumentDatabaseBridge(
  supabase: SupabaseClient,
  projectId: string,
  targetFolderId: string,
  templateDocumentRevisionId: string,
): DocumentDatabaseBridge {
  let authorizedInput: CommitInput | null = null;
  const authorize: DocumentDraftTransaction["authorize"] = async (input) => {
    authorizedInput = null;
    const { error } = await supabase.rpc("authorize_lifecycle_document_draft", {
      p_project_id: projectId,
      p_template_key: input.rendered.templatePin.templateKey,
      p_template_version: input.rendered.templatePin.version,
      p_template_document_revision_id: templateDocumentRevisionId,
      p_request_key: input.requestKey,
    });
    if (error) throwRpcError(error, "Document draft authorization failed.");
    authorizedInput = input;
  };

  return {
    authorize,
    async registerAttempt(input, staged) {
      await authorize(input);
      const { data, error } = await supabase.rpc("register_lifecycle_document_storage_attempt", {
        p_project_id: projectId,
        p_request_key: input.requestKey,
        p_template_key: input.rendered.templatePin.templateKey,
        p_template_version: input.rendered.templatePin.version,
        p_template_document_revision_id: templateDocumentRevisionId,
        p_storage_bucket: staged.bucket,
        p_storage_path: staged.path,
        p_sha256_checksum: staged.sha256,
        p_size_bytes: staged.sizeBytes,
      });
      if (error) throwRpcError(error, "Storage attempt registration failed.");
      if (typeof data !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
        throw new Error("Verified storage attempt receipt is required.");
      }
    },
    async findReceipt(requestKey) {
      if (!authorizedInput || authorizedInput.requestKey !== requestKey) throw new Error("Document receipt lookup requires scoped authorization.");
      const { data, error } = await supabase.rpc("find_lifecycle_document_draft_receipt", {
        p_project_id: projectId,
        p_target_folder_id: targetFolderId,
        p_template_key: authorizedInput.rendered.templatePin.templateKey,
        p_template_version: authorizedInput.rendered.templatePin.version,
        p_template_document_revision_id: templateDocumentRevisionId,
        p_request_key: requestKey,
      });
      if (error) throwRpcError(error, "Document draft receipt lookup failed.");
      const result = readReceipt(data);
      if (!result) return null;
      if (result.request_key !== requestKey) throw new Error("Document receipt request key mismatch.");
      if (result.source_fingerprint !== authorizedInput.sourceFingerprint) throw new Error("Document receipt source mismatch.");
      return toReceipt(result);
    },
    async commit(input: CommitInput, staged: StagedDocument) {
      await authorize(input);
      const { data, error } = await supabase.rpc("commit_lifecycle_document_draft", {
        p_project_id: projectId,
        p_target_folder_id: targetFolderId,
        p_request_key: input.requestKey,
        p_template_key: input.rendered.templatePin.templateKey,
        p_template_version: input.rendered.templatePin.version,
        p_template_document_revision_id: templateDocumentRevisionId,
        p_file_name: input.rendered.fileName,
        p_mime_type: input.rendered.mimeType,
        p_storage_bucket: staged.bucket,
        p_storage_path: staged.path,
        p_sha256_checksum: staged.sha256,
        p_size_bytes: staged.sizeBytes,
      });
      if (error || !data) throwRpcError(error, "Document draft transaction failed.");
      const result = readReceipt(data);
      if (!result || typeof result.uses_staged_object !== "boolean") throw new Error("Definitive document commit outcome is required.");
      if (result.request_key !== input.requestKey || result.source_fingerprint !== input.sourceFingerprint) throw new Error("Document commit receipt conflicts with the requested source.");
      return { receipt: toReceipt(result), usesStagedObject: result.uses_staged_object };
    },
    async canDiscard(staged) {
      if (!authorizedInput) return false;
      const { data, error } = await supabase.rpc("can_discard_lifecycle_document_object", {
        p_project_id: projectId,
        p_request_key: authorizedInput.requestKey,
        p_storage_bucket: staged.bucket,
        p_storage_path: staged.path,
      });
      if (error) throwRpcError(error, "Document cleanup verification failed.");
      return data === true;
    },
  };
}
