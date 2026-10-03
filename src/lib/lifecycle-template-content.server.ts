import type { SupabaseClient } from "@supabase/supabase-js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pending, service-only contract adapter. Not invoked by a live route.
 * The supplied server client must retain the verified actor's JWT context.
 */
export function createLifecycleTemplateContentStore(client: SupabaseClient) {
  return {
    async append(templateId: string, content: string) {
      if (!uuid.test(templateId) || !content.trim() || content.length > 200_000) {
        throw new Error("Valid template and non-empty content are required.");
      }
      const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content))),
        (byte) => byte.toString(16).padStart(2, "0")).join("");
      const { data, error } = await client.rpc("create_lifecycle_document_template_revision", {
        p_template_id: templateId, p_content: content,
      });
      if (error) throw new Error(error.message);
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      if (rows.length !== 1) throw new Error("Exactly one immutable revision receipt is required.");
      const row = rows[0] as Record<string, unknown>;
      if (typeof row.id !== "string" || !uuid.test(row.id) || row.template_id !== templateId
        || !Number.isSafeInteger(row.revision_number) || (row.revision_number as number) < 1
        || row.content_sha256 !== checksum) {
        throw new Error("Invalid immutable template revision receipt.");
      }
      return { id: row.id, templateId, revisionNumber: row.revision_number as number, checksum: row.content_sha256 };
    },
    async activate(templateId: string, revisionId: string) {
      if (!uuid.test(templateId) || !uuid.test(revisionId)) throw new Error("Valid pinned template revision is required.");
      const { error } = await client.rpc("activate_lifecycle_document_template", {
        p_template_id: templateId, p_template_document_revision_id: revisionId,
      });
      if (error) throw new Error(error.message);
    },
    async retire(templateId: string) {
      if (!uuid.test(templateId)) throw new Error("Valid template is required.");
      const { error } = await client.rpc("retire_lifecycle_document_template", { p_template_id: templateId });
      if (error) throw new Error(error.message);
    },
  };
}
