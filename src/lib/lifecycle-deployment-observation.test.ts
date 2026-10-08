import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND,
  ORIGINAL_LIFECYCLE_BACKEND,
  blockedLifecycleDeploymentObservation,
  observeScopedLifecycleReadback,
  lifecycleDocumentServerOperations,
  deriveBackendRef,
  validateLifecycleTarget,
} from "./lifecycle-deployment-observation";

const ids = {
  project: "00000000-0000-0000-0000-000000000001",
  request: "00000000-0000-0000-0000-000000000002",
  template: "00000000-0000-0000-0000-000000000003",
  source: "00000000-0000-0000-0000-000000000004",
  node: "00000000-0000-0000-0000-000000000005",
  revision: "00000000-0000-0000-0000-000000000006",
  register: "00000000-0000-0000-0000-000000000007",
  audit: "00000000-0000-0000-0000-000000000008",
};

function scopedClient(
  rows: Record<string, Record<string, unknown> | null>,
  errors: Record<string, string> = {},
  thrownTables: string[] = [],
) {
  const calls: Array<{ table: string; columns?: string; filters: Array<[string, string]> }> = [];
  return {
    calls,
    from(table: string) {
      const call = { table, filters: [] as Array<[string, string]> };
      calls.push(call);
      return {
        select(columns: string) { call.columns = columns; return this; },
        eq(column: string, value: string) { call.filters.push([column, value]); return this; },
        maybeSingle: async () => {
          if (thrownTables.includes(table)) throw new Error("Bearer eyJsecret.should-never-leak");
          return { data: rows[table] ?? null, error: errors[table] ? { message: errors[table] } : null };
        },
      };
    },
  };
}

function completeRows(): Record<string, Record<string, unknown> | null> {
  return {
    project_lifecycle_document_drafts: { project_id: ids.project, request_key: ids.request, template_id: ids.template, template_document_revision_id: ids.source, generated_drive_node_id: ids.node, generated_revision_id: ids.revision, document_control_register_id: ids.register, audit_event_id: ids.audit, source_fingerprint: "f".repeat(64), storage_bucket: "project-drive", storage_path: "safe/path.pdf", sha256_checksum: "a".repeat(64), size_bytes: 12 },
    department_process_template_document_revisions: { id: ids.source, template_id: ids.template, content_sha256: "b".repeat(64) },
    drive_nodes: { id: ids.node, project_id: ids.project, node_type: "FILE", is_trashed: false, storage_bucket: "project-drive", storage_path: "safe/path.pdf", sha256_checksum: "a".repeat(64), file_size_bytes: 12 },
    drive_node_revisions: { id: ids.revision, node_id: ids.node, storage_path: "safe/path.pdf", sha256_checksum: "a".repeat(64), file_size_bytes: 12 },
    document_control_registers: { id: ids.register, project_id: ids.project, drive_node_id: ids.node, source_revision_id: ids.revision },
  };
}

describe("lifecycle deployment observation boundary", () => {
  describe("backend identity derivation", () => {
    it("extracts project ref from standard Supabase URLs", () => {
      expect(deriveBackendRef("https://egjotuxqguifnvdnflan.supabase.co")).toBe("egjotuxqguifnvdnflan");
      expect(deriveBackendRef("https://yyrvduosyyaluifqvwkr.supabase.co")).toBe("yyrvduosyyaluifqvwkr");
    });

    it.each([
      undefined,
      "",
      "not-a-url",
      "https://example.com",
      "https://supabase.co",
      "https://egjotuxqguifnvdnflan.extra.supabase.co",
      "https://egjotuxqguifnvdnflan.supabase.co.attacker.test",
      "http://egjotuxqguifnvdnflan.supabase.co",
      "https://user:password@egjotuxqguifnvdnflan.supabase.co",
      "https://egjotuxqguifnvdnflan.supabase.co:8443",
      "https://egjotuxqguifnvdnflan.supabase.co/path",
      "https://egjotuxqguifnvdnflan.supabase.co?probe=true",
      "https://egjotuxqguifnvdnflan.supabase.co#fragment",
    ])("returns null for a non-canonical target: %s", (url) => {
      expect(deriveBackendRef(undefined)).toBeNull();
      expect(deriveBackendRef(url)).toBeNull();
    });
  });

  describe("strict target validation", () => {
    const isolatedUrl = "https://egjotuxqguifnvdnflan.supabase.co";
    const originalUrl = "https://yyrvduosyyaluifqvwkr.supabase.co";

    it("refuses the original backend even if it matches the current environment", () => {
      const result = validateLifecycleTarget(ORIGINAL_LIFECYCLE_BACKEND, originalUrl);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Refusing the original backend.");
      }
    });

    it("refuses mismatches between target and environment", () => {
      const result = validateLifecycleTarget(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, originalUrl);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Backend mismatch: target does not match current environment.");
      }
    });

    it("refuses a canonical unknown backend even if it matches the environment", () => {
      const unknownRef = "abcdefghijklmnopqrst";
      const unknownUrl = `https://${unknownRef}.supabase.co`;
      const result = validateLifecycleTarget(unknownRef, unknownUrl);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Refusing a backend other than the approved isolated backend.");
      }
    });

    it("accepts the isolated backend when it matches the environment", () => {
      const result = validateLifecycleTarget(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, isolatedUrl);
      expect(result.valid).toBe(true);
    });

    it("fails safely if environment URL is missing", () => {
      const result = validateLifecycleTarget(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND, undefined);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Unable to derive current backend identity.");
      }
    });
  });

  it("keeps physical storage, RPC catalog, and audit evidence blocked", () => {
    const report = blockedLifecycleDeploymentObservation(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND);
    expect(report.status).toBe("BLOCKED");
    expect(report.capabilities.projectDriveStorage.status).toBe("BLOCKED");
    expect(report.capabilities.rpcSchema.status).toBe("BLOCKED");
    expect(report.capabilities.observabilityReadback.status).toBe("BLOCKED");
  });

  it("observes only a complete caller-RLS-scoped receipt lineage", async () => {
    const client = scopedClient(completeRows());
    const readback = await observeScopedLifecycleReadback(client, { projectId: ids.project, requestKey: ids.request, expectedSource: { templateId: ids.template, templateDocumentRevisionId: ids.source, sourceFingerprint: "f".repeat(64) } });
    expect(readback.receipt.status).toBe("OBSERVED");
    expect(readback.source.status).toBe("OBSERVED");
    expect(readback.generatedNode.status).toBe("OBSERVED");
    expect(readback.generatedRevision.status).toBe("OBSERVED");
    expect(readback.controlledRegister.status).toBe("OBSERVED");
    expect(readback.storageMetadata.status).toBe("OBSERVED");
    expect(readback.audit).toEqual({ status: "BLOCKED", reason: "activity_log_has_no_scoped_authenticated_read_contract" });
    expect(client.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "project_lifecycle_document_drafts", filters: [["project_id", ids.project], ["request_key", ids.request]] }),
      expect.objectContaining({ table: "department_process_template_document_revisions", filters: [["id", ids.source]] }),
      expect.objectContaining({ table: "drive_nodes", filters: [["id", ids.node]] }),
      expect.objectContaining({ table: "drive_node_revisions", filters: [["id", ids.revision]] }),
      expect.objectContaining({ table: "document_control_registers", filters: [["id", ids.register]] }),
    ]));
  });

  it("fails closed for an RLS-hidden receipt without scanning another record", async () => {
    const readback = await observeScopedLifecycleReadback(scopedClient({}), { projectId: ids.project, requestKey: ids.request });
    expect(readback.receipt).toEqual({ status: "BLOCKED", reason: "receipt_not_found_or_hidden_by_rls" });
    expect(readback.generatedNode.status).toBe("BLOCKED");
  });

  it("reports receipt query denial without exposing data", async () => {
    const readback = await observeScopedLifecycleReadback(scopedClient({}, { project_lifecycle_document_drafts: "permission denied Bearer eyJsecret.should-never-leak" }), { projectId: ids.project, requestKey: ids.request });
    expect(readback.receipt).toEqual({ status: "BLOCKED", reason: "receipt_read_denied_or_failed" });
    expect(JSON.stringify(readback)).not.toContain("eyJsecret");
  });

  it("blocks missing source and mismatched storage metadata", async () => {
    const rows = completeRows();
    rows.department_process_template_document_revisions = null;
    (rows.drive_node_revisions as Record<string, unknown>).sha256_checksum = "c".repeat(64);
    const readback = await observeScopedLifecycleReadback(scopedClient(rows), { projectId: ids.project, requestKey: ids.request });
    expect(readback.source).toEqual({ status: "BLOCKED", reason: "immutable_source_not_found_or_hidden_by_rls" });
    expect(readback.storageMetadata).toEqual({ status: "BLOCKED", reason: "storage_metadata_link_or_checksum_mismatch" });
  });

  it("blocks malformed byte evidence and does not equate missing sizes", async () => {
    const rows = completeRows();
    (rows.project_lifecycle_document_drafts as Record<string, unknown>).size_bytes = undefined;
    const readback = await observeScopedLifecycleReadback(scopedClient(rows), { projectId: ids.project, requestKey: ids.request });
    expect(readback.receipt).toEqual({ status: "BLOCKED", reason: "receipt_has_invalid_storage_or_source_evidence" });
  });

  it("requires an exact expected immutable source when supplied", async () => {
    const readback = await observeScopedLifecycleReadback(scopedClient(completeRows()), { projectId: ids.project, requestKey: ids.request, expectedSource: { templateId: ids.template, templateDocumentRevisionId: ids.source, sourceFingerprint: "a".repeat(64) } });
    expect(readback.receipt).toEqual({ status: "BLOCKED", reason: "receipt_source_evidence_mismatch" });
  });

  it("does not issue queries for invalid scoped input", async () => {
    const client = scopedClient(completeRows());
    const readback = await observeScopedLifecycleReadback(client, { projectId: "not-a-uuid", requestKey: ids.request });
    expect(readback.receipt).toEqual({ status: "BLOCKED", reason: "invalid_scoped_observation_input" });
    expect(client.calls).toEqual([]);
  });

  it("turns thrown receipt and linked reads into fixed blocked codes", async () => {
    const receiptTransport = await observeScopedLifecycleReadback(scopedClient({}, {}, ["project_lifecycle_document_drafts"]), { projectId: ids.project, requestKey: ids.request });
    expect(receiptTransport.receipt).toEqual({ status: "BLOCKED", reason: "receipt_read_transport_failed" });
    expect(JSON.stringify(receiptTransport)).not.toContain("eyJsecret");
    const linkedTransport = await observeScopedLifecycleReadback(scopedClient(completeRows(), {}, ["drive_nodes"]), { projectId: ids.project, requestKey: ids.request });
    expect(linkedTransport.generatedNode).toEqual({ status: "BLOCKED", reason: "linked_read_transport_failed" });
  });

  it("preserves the exact pending actor-operation contract without treating it as deployed", () => {
    expect(lifecycleDocumentServerOperations).toEqual([
      "authorize_lifecycle_document_draft",
      "register_lifecycle_document_storage_attempt",
      "find_lifecycle_document_draft_receipt",
      "commit_lifecycle_document_draft",
      "can_discard_lifecycle_document_object",
    ]);
  });

  it("keeps the server facade authenticated and uses strict validation", () => {
    const facade = readFileSync("src/lib/lifecycle-deployment-observation.functions.ts", "utf8");
    expect(facade).toContain("requireSupabaseAuth");
    expect(facade).toContain("validateLifecycleTarget");
    expect(facade).toContain("process.env.SUPABASE_URL");
    expect(facade).toContain("observeScopedLifecycleReadback");
    expect(facade).not.toContain(".rpc(");
    expect(facade).not.toContain("client.server");
    expect(facade).not.toContain("supabaseAdmin");
  });
});
