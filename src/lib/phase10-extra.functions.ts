import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uploadIntentInput = z.object({ requestId: z.string().uuid().nullable().optional(), filename: z.string().trim().min(1).max(180), mimeType: z.string().trim().max(160).nullable().optional(), fileSize: z.number().int().positive().max(50 * 1024 * 1024), checksum: z.string().trim().regex(/^[a-f0-9]{64}$/i) });
const finalizeUploadInput = z.object({ uploadId: z.string().uuid() });
const reviewUploadInput = z.object({ uploadId: z.string().uuid(), decision: z.enum(["ACCEPTED", "REJECTED", "REPLACEMENT_REQUESTED"]), reviewNotes: z.string().trim().max(4000).optional() });

function safeFilename(value: string) { return value.replace(/[^\w.\-]+/g, "_"); }

export const createExternalUploadIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => uploadIntentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: contact, error: contactError } = await context.supabase.from("external_contacts").select("id,external_party_id").eq("user_id", context.userId).eq("active", true).eq("portal_enabled", true).maybeSingle();
    if (contactError || !contact) throw new Error("External portal access is not active.");
    if (data.requestId) {
      const { data: request, error } = await context.supabase.from("external_upload_requests").select("id").eq("id", data.requestId).maybeSingle();
      if (error || !request) throw new Error("The upload request is not available.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${contact.external_party_id}/${contact.id}/${crypto.randomUUID()}-${safeFilename(data.filename)}`;
    const { data: staged, error: stageError } = await supabaseAdmin.from("external_uploads").insert({ request_id: data.requestId ?? null, external_party_id: contact.external_party_id, external_contact_id: contact.id, original_filename: data.filename, storage_path: path, mime_type: data.mimeType ?? null, file_size: data.fileSize, checksum: data.checksum, status: "PENDING_REVIEW" }).select("id").single();
    if (stageError || !staged) throw new Error(stageError?.message ?? "Could not stage the upload.");
    const { data: signed, error: signedError } = await supabaseAdmin.storage.from("external-staging").createSignedUploadUrl(path);
    if (signedError || !signed) throw new Error(signedError?.message ?? "Could not prepare the secured upload.");
    return { uploadId: staged.id, token: signed.token, path: signed.path };
  });

export const finalizeExternalUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => finalizeUploadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("external_uploads").select("id").eq("id", data.uploadId).maybeSingle();
    if (error || !row) throw new Error("The staged upload was not found.");
    await context.supabase.rpc("external_log_access", { _entity_type: "external_upload", _entity_id: data.uploadId, _event_type: "UPLOAD_SUBMITTED", _metadata: {} });
    return { ok: true };
  });

export const reviewExternalUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reviewUploadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission_key: "external_collaboration.manage" });
    if (!allowed) throw new Error("You do not have permission to review external uploads.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("external_uploads").select("id,status,storage_path").eq("id", data.uploadId).maybeSingle();
    if (error || !row || row.status !== "PENDING_REVIEW") throw new Error("Only pending uploads can be reviewed.");
    const { error: updateError } = await supabaseAdmin.from("external_uploads").update({ status: data.decision, review_notes: data.reviewNotes ?? null, reviewed_at: new Date().toISOString(), reviewed_by: context.userId }).eq("id", data.uploadId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
