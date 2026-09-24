import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const managedTables = [
  "external_parties", "external_contacts", "external_portal_access", "external_share_snapshots",
  "external_transmittals", "external_review_requests", "external_actions", "external_upload_requests",
  "external_data_rooms", "external_data_room_items", "external_api_clients", "external_webhook_subscriptions",
] as const;
type Phase10Table = (typeof managedTables)[number];
const uuid = z.string().uuid();
const recordInput = z.object({ table: z.enum(managedTables), id: uuid.optional(), payload: z.record(z.string(), z.unknown()) });
const invitationInput = z.object({ accessId: uuid });
const revokeInput = z.object({ snapshotId: uuid, reason: z.string().trim().min(3).max(2000) });
const integrationSecretInput = z.object({ table: z.enum(["external_api_clients", "external_webhook_subscriptions"]), id: uuid });

const allowedFields: Record<Phase10Table, readonly string[]> = {
  external_parties: ["display_name", "party_type", "customer_id", "vendor_id", "support_email", "notes", "portal_required", "portal_title", "preferred_language", "timezone", "active"],
  external_contacts: ["external_party_id", "customer_contact_id", "full_name", "email", "designation", "contact_role", "phone", "portal_enabled", "preferred_language", "timezone", "notes", "active"],
  external_portal_access: ["external_contact_id", "portal_type", "access_role", "access_scope", "expires_at", "is_active", "deactivated_at", "deactivation_reason"],
  external_share_snapshots: ["external_party_id", "source_entity_type", "source_entity_id", "share_mode", "permission", "recipient_email", "expires_at", "manifest", "checksum"],
  external_transmittals: ["external_party_id", "project_id", "purpose", "required_action", "message", "due_date", "document_manifest"],
  external_review_requests: ["external_party_id", "external_contact_id", "source_entity_type", "source_entity_id", "revision_reference", "request_type", "due_date"],
  external_actions: ["external_party_id", "external_contact_id", "project_id", "source_entity_type", "source_entity_id", "title", "description", "due_date", "attachments"],
  external_upload_requests: ["external_party_id", "external_contact_id", "source_entity_type", "source_entity_id", "requested_document", "description", "expected_format", "required_metadata", "destination", "due_date"],
  external_data_rooms: ["external_party_id", "project_id", "title", "description", "confidentiality_classification", "nda_required", "expires_at"],
  external_data_room_items: ["data_room_id", "source_entity_type", "source_entity_id", "revision_reference", "category", "is_favorite_eligible"],
  external_api_clients: ["external_party_id", "client_name", "scopes", "active"],
  external_webhook_subscriptions: ["external_party_id", "endpoint_url", "event_types", "active"],
};

function sanitizePayload(table: Phase10Table, payload: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(payload).filter(([key]) => allowedFields[table].includes(key)));
  if (!Object.keys(clean).length) throw new Error("No editable fields were provided.");
  for (const key of ["external_party_id", "external_contact_id", "customer_id", "vendor_id", "project_id", "source_entity_id", "data_room_id"]) {
    if (typeof clean[key] === "string") uuid.parse(clean[key]);
  }
  if (typeof clean.expires_at === "string") z.string().datetime().or(z.string().date()).parse(clean.expires_at);
  return clean;
}

async function requireManager(context: { supabase: any; userId: string }) {
  const { data: allowed, error } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission_key: "external_collaboration.manage" });
  if (error || !allowed) throw new Error("You do not have permission to manage external collaboration.");
}

export const savePhase10Record = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => recordInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = sanitizePayload(data.table, data.payload);
    const query = data.id
      ? (supabaseAdmin.from(data.table) as any).update(payload).eq("id", data.id)
      : (supabaseAdmin.from(data.table) as any).insert({ ...payload, created_by: context.userId, ...(data.table === "external_portal_access" ? { invited_by: context.userId } : {}) });
    const { data: saved, error } = await query.select("id").single();
    if (error || !saved) throw new Error(error?.message ?? "Could not save the record.");
    return saved as { id: string };
  });

export const sendExternalInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => invitationInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: access, error } = await supabaseAdmin.from("external_portal_access").select("id,invitation_token,external_contacts(id,email,full_name)").eq("id", data.accessId).eq("is_active", true).maybeSingle();
    const contact = access?.external_contacts as unknown as { id: string; email: string; full_name: string } | null;
    if (error || !access || !contact) throw new Error("Active portal access was not found.");
    const appUrl = process.env["PUBLIC_APP_URL"] ?? "";
    const redirectTo = appUrl.startsWith("http") ? `${appUrl}/external-portal/${access.invitation_token}` : undefined;
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(contact.email, { data: { display_name: contact.full_name, external_contact_id: contact.id }, ...(redirectTo ? { redirectTo } : {}) });
    if (invite.error || !invite.data.user?.id) throw new Error(invite.error?.message ?? "Could not issue the invitation.");
    const update = await supabaseAdmin.from("external_contacts").update({ user_id: invite.data.user.id }).eq("id", contact.id);
    if (update.error) throw new Error(update.error.message);
    const stamp = await supabaseAdmin.from("external_portal_access").update({ invitation_sent_at: new Date().toISOString(), invited_by: context.userId }).eq("id", access.id);
    if (stamp.error) throw new Error(stamp.error.message);
    return { invitationToken: access.invitation_token };
  });

export const revokeExternalShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => revokeInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("external_share_snapshots").update({ revoked_at: new Date().toISOString(), revoked_by: context.userId, revoke_reason: data.reason }).eq("id", data.snapshotId).is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotateExternalIntegrationSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => integrationSecretInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireManager(context);
    const secret = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const bytes = new TextEncoder().encode(secret);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((n) => n.toString(16).padStart(2, "0")).join("");
    const hint = `…${secret.slice(-6)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = data.table === "external_api_clients"
      ? { client_secret_hash: hash, client_key_hint: hint, client_secret_rotated_at: new Date().toISOString() }
      : { signing_secret_hash: hash, signing_secret_hint: hint, signing_secret_rotated_at: new Date().toISOString(), failure_count: 0, disabled_at: null };
    const { error } = await (supabaseAdmin.from(data.table) as any).update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { secret };
  });
