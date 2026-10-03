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
): DocumentDatabaseBridge {
  const authorize: DocumentDraftTransaction["authorize"] = async (input) => {
    const { error } = await supabase.rpc("authorize_lifecycle_document_draft", {
      p_project_id: projectId,
      p_template_key: input.rendered.templatePin.templateKey,
      p_template_version: input.rendered.templatePin.version,
      p_template_document_revision_id: input.rendered.templatePin.documentRevisionId,
      p_request_key: input.requestKey,
    });
    if (error) throwRpcError(error, "Document draft authorization failed.");
  };

  return {
    authorize,
    async findReceipt(input) {
      const { data, error } = await supabase.rpc("find_lifecycle_document_draft_receipt", {
        p_project_id: projectId,
        p_target_folder_id: targetFolderId,
        p_template_key: input.rendered.templatePin.templateKey,
        p_template_version: input.rendered.templatePin.version,
        p_template_document_revision_id: input.rendered.templatePin.documentRevisionId,
        p_request_key: input.requestKey,
      });
      if (error) throwRpcError(error, "Document draft receipt lookup failed.");
      if (!data) return null;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result) return null;
      return toReceipt(result as DocumentDraftRpcResult);
    },
    async commit(input: CommitInput, staged: StagedDocument) {
      const { data, error } = await supabase.rpc("commit_lifecycle_document_draft", {
        p_project_id: projectId,
        p_target_folder_id: targetFolderId,
        p_request_key: input.requestKey,
        p_template_key: input.rendered.templatePin.templateKey,
        p_template_version: input.rendered.templatePin.version,
        p_template_document_revision_id: input.rendered.templatePin.documentRevisionId,
        p_file_name: input.rendered.fileName,
        p_mime_type: input.rendered.mimeType,
        p_storage_bucket: staged.bucket,
        p_storage_path: staged.path,
        p_sha256_checksum: staged.sha256,
        p_size_bytes: staged.sizeBytes,
      });
      if (error || !data) throwRpcError(error, "Document draft transaction failed.");
      const result = data as DocumentDraftRpcResult;
      return { receipt: toReceipt(result), usesStagedObject: result.uses_staged_object !== false };
    },
    async registerAttempt(input, staged) {
      const { error } = await supabase.rpc("register_lifecycle_document_storage_attempt", {
        p_project_id: projectId,
        p_template_key: input.rendered.templatePin.templateKey,
        p_template_version: input.rendered.templatePin.version,
        p_template_document_revision_id: input.rendered.templatePin.documentRevisionId,
        p_request_key: input.requestKey,
        p_storage_bucket: staged.bucket,
        p_storage_path: staged.path,
        p_sha256_checksum: staged.sha256,
        p_size_bytes: staged.sizeBytes,
      });
      if (error) throwRpcError(error, "Document storage attempt registration failed.");
    },
    async canDiscard(staged) {
      const { data, error } = await supabase.rpc("can_discard_lifecycle_document_object", {
        p_storage_bucket: staged.bucket,
        p_storage_path: staged.path,
      });
      if (error) throwRpcError(error, "Document cleanup verification failed.");
      return data === true;
    },
  };
}