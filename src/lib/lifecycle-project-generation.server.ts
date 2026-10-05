import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifecycleTransactionClient } from "./lifecycle-actor-transport.server";
import { loadLifecycleDocumentPreflight } from "./lifecycle-document-preflight.server";
import { runLifecycleDocumentWorkflow } from "./lifecycle-document-workflow.server";

/** Same actor + canonical snapshot retries the same request; no business numbering on client. */
export async function lifecycleAutomaticRequestKey(actor: string, fingerprint: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`lifecycle-auto-v1|${actor}|${fingerprint}`)));
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.slice(0, 16), (v) => v.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Invoked after a web project save. Preserves each prior file; never edits an approved document.
 * This is not a durable database outbox: external/mobile updates need their own accepted caller.
 */
export async function generateProjectDocumentDrafts(
  client: SupabaseClient, actor: string, project: { id: string; department_id: string; project_drive_node_id: string },
  transactionClient: () => Promise<LifecycleTransactionClient>,
) {
  const { data, error } = await client.from("department_process_templates")
    .select("id,version,active_document_revision_id,title").eq("department_id", project.department_id)
    .eq("status", "ACTIVE").not("active_document_revision_id", "is", null).order("template_key").limit(51);
  if (error) throw new Error(error.message);
  const templates = (data ?? []) as unknown as Array<{ id: string; version: number; active_document_revision_id: string; title: string }>;
  if (templates.length > 50) throw new Error("Generate this department's drafts in smaller batches.");
  const results: Array<{ templateId: string; title: string; mode: string; nodeId: string }> = [];
  const failures: Array<{ templateId: string; title: string; message: string }> = [];
  for (const template of templates) {
    try {
      const input: Parameters<typeof loadLifecycleDocumentPreflight>[1] = { projectId: project.id, templateId: template.id, templateVersion: template.version,
        templateDocumentRevisionId: template.active_document_revision_id, targetFolderId: project.project_drive_node_id,
        requestKey: crypto.randomUUID() };
      const preflight = await loadLifecycleDocumentPreflight(client, input);
      input.requestKey = await lifecycleAutomaticRequestKey(actor, preflight.sourceFingerprint);
      // Reload/revalidate current server data; a concurrent edit cannot replay stale bytes.
      const saved = await runLifecycleDocumentWorkflow(client, input, transactionClient);
      results.push({ templateId: template.id, title: template.title, mode: saved.mode, nodeId: saved.receipt.nodeId });
    } catch (cause) {
      failures.push({ templateId: template.id, title: template.title, message: cause instanceof Error ? cause.message : "Draft generation failed." });
    }
  }
  return { results, failures };
}
