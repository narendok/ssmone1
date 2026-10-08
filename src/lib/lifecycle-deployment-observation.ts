export const ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND = "egjotuxqguifnvdnflan";
export const ORIGINAL_LIFECYCLE_BACKEND = "yyrvduosyyaluifqvwkr";

export const lifecycleDocumentServerOperations = [
  "authorize_lifecycle_document_draft",
  "register_lifecycle_document_storage_attempt",
  "find_lifecycle_document_draft_receipt",
  "commit_lifecycle_document_draft",
  "can_discard_lifecycle_document_object",
] as const;

export type LifecycleDeploymentObservation = {
  backendRef: string;
  verified: boolean;
  actorGateway?: string;
  serverOperations?: string[];
  storage?: { bucket?: string; uploadDownloadObserved?: boolean };
  observability?: { readbackObserved?: boolean };
};

export type LifecycleDeploymentObservationReport = {
  status: "BLOCKED";
  missingContract: string;
  backendRef: string;
  capabilities: {
    authenticatedApplicationTransport: "OBSERVED";
    actorGateway: ObservationCapability;
    rpcSchema: ObservationCapability;
    projectDriveStorage: ObservationCapability;
    observabilityReadback: ObservationCapability;
  };
};

export type ObservationCapability = {
  status: "OBSERVED" | "BLOCKED";
  reason?: string;
};

export type ScopedLifecycleObservationInput = {
  projectId: string;
  requestKey: string;
  expectedSource?: {
    templateId: string;
    templateDocumentRevisionId: string;
    sourceFingerprint: string;
  };
};

type QueryResult = {
  data: Record<string, unknown> | null;
  error: { message?: string } | null;
};

type Query = {
  select: (columns: string) => Query;
  eq: (column: string, value: string) => Query;
  maybeSingle: () => Promise<QueryResult>;
};

export type ScopedLifecycleReadClient = {
  from: (table: string) => Query;
};

export type ScopedLifecycleReadback = {
  receipt: ObservationCapability;
  source: ObservationCapability;
  generatedNode: ObservationCapability;
  generatedRevision: ObservationCapability;
  controlledRegister: ObservationCapability;
  audit: ObservationCapability;
  storageMetadata: ObservationCapability;
};

const blocked = (reason: string): ObservationCapability => ({ status: "BLOCKED", reason });
const observed = (): ObservationCapability => ({ status: "OBSERVED" });

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function invalidInput(input: ScopedLifecycleObservationInput) {
  if (!isUuid(input.projectId) || !isUuid(input.requestKey)) return true;
  const expected = input.expectedSource;
  return expected !== undefined && (!isUuid(expected.templateId)
    || !isUuid(expected.templateDocumentRevisionId)
    || !isSha256(expected.sourceFingerprint));
}

/**
 * Reads one immutable receipt and its links through caller RLS. It does not
 * enumerate tables, invoke lifecycle RPCs, access object bytes, or fall back
 * to unscoped records when the requested receipt is absent or hidden.
 */
export async function observeScopedLifecycleReadback(
  client: ScopedLifecycleReadClient,
  input: ScopedLifecycleObservationInput,
): Promise<ScopedLifecycleReadback> {
  const empty: ScopedLifecycleReadback = {
    receipt: blocked("receipt_not_observed"),
    source: blocked("source_not_observed"),
    generatedNode: blocked("generated_node_not_observed"),
    generatedRevision: blocked("generated_revision_not_observed"),
    controlledRegister: blocked("controlled_register_not_observed"),
    audit: blocked("activity_log_has_no_scoped_authenticated_read_contract"),
    storageMetadata: blocked("storage_metadata_not_observed"),
  };
  if (invalidInput(input)) return { ...empty, receipt: blocked("invalid_scoped_observation_input") };
  let receiptResult: QueryResult;
  try {
    receiptResult = await client
      .from("project_lifecycle_document_drafts")
      .select("project_id,request_key,template_id,template_document_revision_id,generated_drive_node_id,generated_revision_id,document_control_register_id,audit_event_id,source_fingerprint,storage_bucket,storage_path,sha256_checksum,size_bytes")
      .eq("project_id", input.projectId)
      .eq("request_key", input.requestKey)
      .maybeSingle();
  } catch {
    return { ...empty, receipt: blocked("receipt_read_transport_failed") };
  }
  if (receiptResult.error) {
    return { ...empty, receipt: blocked("receipt_read_denied_or_failed") };
  }
  const receipt = receiptResult.data;
  if (!receipt) return { ...empty, receipt: blocked("receipt_not_found_or_hidden_by_rls") };
  const required = ["project_id", "request_key", "template_id", "template_document_revision_id", "generated_drive_node_id", "generated_revision_id", "document_control_register_id", "audit_event_id", "source_fingerprint", "storage_bucket", "storage_path", "sha256_checksum"];
  if (required.some((field) => !isNonEmptyString(receipt[field]))) {
    return { ...empty, receipt: blocked("receipt_has_incomplete_linkage") };
  }
  if (!isSha256(receipt.source_fingerprint) || !isSha256(receipt.sha256_checksum)
    || receipt.storage_bucket !== "project-drive" || !isNonNegativeInteger(receipt.size_bytes)) {
    return { ...empty, receipt: blocked("receipt_has_invalid_storage_or_source_evidence") };
  }
  if (receipt.project_id !== input.projectId || receipt.request_key !== input.requestKey) {
    return { ...empty, receipt: blocked("receipt_scope_mismatch") };
  }
  if (input.expectedSource && (receipt.template_id !== input.expectedSource.templateId
    || receipt.template_document_revision_id !== input.expectedSource.templateDocumentRevisionId
    || receipt.source_fingerprint !== input.expectedSource.sourceFingerprint)) {
    return { ...empty, receipt: blocked("receipt_source_evidence_mismatch") };
  }
  const sourceRevisionId = receipt.template_document_revision_id;
  const generatedNodeId = receipt.generated_drive_node_id;
  const generatedRevisionId = receipt.generated_revision_id;
  const registerId = receipt.document_control_register_id;
  if (!isNonEmptyString(sourceRevisionId) || !isNonEmptyString(generatedNodeId)
    || !isNonEmptyString(generatedRevisionId) || !isNonEmptyString(registerId)) {
    return { ...empty, receipt: blocked("receipt_has_incomplete_linkage") };
  }
  const linked = (table: string, id: string, columns: string) => client.from(table).select(columns).eq("id", id).maybeSingle();
  let sourceResult: QueryResult;
  let nodeResult: QueryResult;
  let revisionResult: QueryResult;
  let registerResult: QueryResult;
  try {
    [sourceResult, nodeResult, revisionResult, registerResult] = await Promise.all([
      linked("department_process_template_document_revisions", sourceRevisionId, "id,template_id,revision_number,content_sha256"),
      linked("drive_nodes", generatedNodeId, "id,project_id,node_type,is_trashed,storage_bucket,storage_path,sha256_checksum,file_size_bytes"),
      linked("drive_node_revisions", generatedRevisionId, "id,node_id,storage_path,sha256_checksum,file_size_bytes"),
      linked("document_control_registers", registerId, "id,project_id,drive_node_id,source_revision_id,document_status"),
    ]);
  } catch {
    return { ...empty, receipt: observed(), source: blocked("linked_read_transport_failed"), generatedNode: blocked("linked_read_transport_failed"), generatedRevision: blocked("linked_read_transport_failed"), controlledRegister: blocked("linked_read_transport_failed") };
  }
  const source = sourceResult.error ? blocked("immutable_source_read_denied_or_failed")
    : !sourceResult.data ? blocked("immutable_source_not_found_or_hidden_by_rls")
    : sourceResult.data.id !== receipt.template_document_revision_id || sourceResult.data.template_id !== receipt.template_id || !isSha256(sourceResult.data.content_sha256) ? blocked("immutable_source_link_mismatch") : observed();
  const generatedNode = nodeResult.error ? blocked("generated_node_read_denied_or_failed")
    : !nodeResult.data ? blocked("generated_node_not_found_or_hidden_by_rls")
    : nodeResult.data.id !== receipt.generated_drive_node_id || nodeResult.data.project_id !== input.projectId || nodeResult.data.node_type !== "FILE" || nodeResult.data.is_trashed === true ? blocked("generated_node_link_mismatch") : observed();
  const generatedRevision = revisionResult.error ? blocked("generated_revision_read_denied_or_failed")
    : !revisionResult.data ? blocked("generated_revision_not_found_or_hidden_by_rls")
    : revisionResult.data.id !== receipt.generated_revision_id || revisionResult.data.node_id !== receipt.generated_drive_node_id ? blocked("generated_revision_link_mismatch") : observed();
  const controlledRegister = registerResult.error ? blocked("controlled_register_read_denied_or_failed")
    : !registerResult.data ? blocked("controlled_register_not_found_or_hidden_by_rls")
    : registerResult.data.id !== receipt.document_control_register_id || registerResult.data.project_id !== input.projectId || registerResult.data.drive_node_id !== receipt.generated_drive_node_id || registerResult.data.source_revision_id !== receipt.generated_revision_id ? blocked("controlled_register_link_mismatch") : observed();
  const storageMetadata = generatedNode.status === "OBSERVED" && generatedRevision.status === "OBSERVED"
    && nodeResult.data?.storage_bucket === receipt.storage_bucket && nodeResult.data?.storage_path === receipt.storage_path
    && nodeResult.data?.sha256_checksum === receipt.sha256_checksum && nodeResult.data?.file_size_bytes === receipt.size_bytes
    && revisionResult.data?.storage_path === receipt.storage_path && revisionResult.data?.sha256_checksum === receipt.sha256_checksum
    && revisionResult.data?.file_size_bytes === receipt.size_bytes
    && isSha256(nodeResult.data?.sha256_checksum) && isSha256(revisionResult.data?.sha256_checksum)
    && isNonNegativeInteger(nodeResult.data?.file_size_bytes) && isNonNegativeInteger(revisionResult.data?.file_size_bytes)
      ? observed() : blocked("storage_metadata_link_or_checksum_mismatch");
  return { receipt: observed(), source, generatedNode, generatedRevision, controlledRegister, audit: empty.audit, storageMetadata };
}

/**
 * Derives a project reference only from the exact canonical project endpoint.
 * Lifecycle acceptance cannot use custom domains or nested subdomains.
 */
export function deriveBackendRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) return null;

    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Strictly validates that the target backend reference matches the current environment
 * and is not the original production backend.
 */
export function validateLifecycleTarget(
  targetBackendRef: string,
  currentBackendUrl: string | undefined,
): { valid: true } | { valid: false; reason: string } {
  if (targetBackendRef === ORIGINAL_LIFECYCLE_BACKEND) {
    return { valid: false, reason: "Refusing the original backend." };
  }

  const currentRef = deriveBackendRef(currentBackendUrl);
  if (!currentRef) {
    return { valid: false, reason: "Unable to derive current backend identity." };
  }

  if (targetBackendRef !== currentRef) {
    return { valid: false, reason: "Backend mismatch: target does not match current environment." };
  }

  if (targetBackendRef !== ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND) {
    return { valid: false, reason: "Refusing a backend other than the approved isolated backend." };
  }

  return { valid: true };
}

/**
 * Conservative source-level contract for the isolated acceptance observer.
 * No deployed read-only query contract exists yet, so this never treats local
 * declarations as evidence and deliberately makes no database or storage call.
 */
export function blockedLifecycleDeploymentObservation(
  backendRef: string,
): LifecycleDeploymentObservationReport {
  return {
    status: "BLOCKED",
    missingContract: "reviewed_read_only_deployment_observation_adapter",
    backendRef,
    capabilities: {
      authenticatedApplicationTransport: "OBSERVED",
      actorGateway: blocked("no_read_only_actor_gateway_contract"),
      rpcSchema: blocked("no_read_only_rpc_catalog_contract"),
      projectDriveStorage: blocked("physical_upload_download_not_observable_through_metadata"),
      observabilityReadback: blocked("scoped_readback_not_run"),
    },
  };
}
