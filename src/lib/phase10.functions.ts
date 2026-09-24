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
const optionalText = z.string().trim().max(12000).nullable().optional();
const optionalDate = z.string().date().nullable().optional();
const recordInput = z.object({ table: z.enum(managedTables), id: uuid.optional(), payload: z.record(z.string(), z.unknown()) });

const allowedFields: Record<Phase10Table, readonly string[]> = {
  external_parties: ["display_name", "party_type", "customer_id", "vendor_id", "support_email", "notes", "portal_required", "portal_title", "preferred_language", "timezone", "active"],
  external_contacts: ["external_party_id", "customer_contact_id", "full_name", "email", "designation", "contact_role", "phone", "portal_enabled", "preferred_language", "timezone", "notes", "active"],
  external_portal_access: ["external_contact_id", "portal_type", "access_role", "access_scope", "expires_at", "is_active", "deactivated_at", "deactivation_reason", "invitation_sent_at", "invitation_accepted_at", "invitation_revoked_at"],
  external_share_snapshots: ["external_party_id", "source_entity_type", "source_entity_id", "share_mode", "permission", "recipient_email", "expires_at", "manifest", "checksum", "revoked_at", "revoked_by", "revoke_reason"],
  external_transmittals: ["external_party_id", "project_id", "purpose", "required_action", "message", "due_date", "document_manifest", "status", "issued_at", "received_at", "acknowledged_by_contact_id"],
  external_review_requests: ["external_party_id", "external_contact_id", "source_entity_type", "source_entity_id", "revision_reference", "request_type", "due_date", "status", "response", "response_metadata", "responded_at"],
  external_actions: ["external_party_id", "external_contact_id", "project_id", "source_entity_type", "source_entity_id", "title", "description", "due_date", "attachments", "status", "response"],
  external_upload_requests: ["external_party_id", "external_contact_id", "source_entity_type", "source_entity_id", "requested_document", "description", "expected_format", "required_metadata", "destination", "due_date", "status"],
  external_data_rooms: ["external_party_id", "project_id", "title", "description", "confidentiality_classification", "nda_required", "expires_at", "status"],
  external_data_room_items: ["data_room_id", "source_entity_type", "source_entity_id", "revision_reference", "category", "is_favorite_eligible"],
  external_api_clients: ["external_party_id", "client_name", "client_key_hint", "scopes", "active"],
  external_webhook_subscriptions: ["external_party_id", "endpoint_url", "event_types", "signing_secret_hint", "active"],
};

function sanitizePayload(table: Phase10Table, payload: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(payload).filter(([key]) => allowedFields[table].includes(key)));
  if (!Object.keys(clean).length) throw new Error("No editable fields were provided.");
  if (typeof clean.external_party_id === "string") uuid.parse(clean.external_party_id);
  if (typeof clean.external_contact_id === "string") uuid.parse(clean.external_contact_id);
  if (typeof clean.expires_at === "string") optionalDate.parse(clean.expires_at);
  if (typeof clean.description === "string") optionalText.parse(clean.description);
  return clean;
}

export const savePhase10Record = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => recordInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("has_permission", {
      _user_id: context.userId,
      _permission_key: "external_collaboration.manage",
    });
    if (accessError || !allowed) throw new Error("You do not have permission to manage external collaboration.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = sanitizePayload(data.table, data.payload);
    const query = data.id
      ? (supabaseAdmin.from(data.table) as any).update(payload).eq("id", data.id)
      : (supabaseAdmin.from(data.table) as any).insert({ ...payload, created_by: context.userId });
    const { data: saved, error } = await query.select("id").single();
    if (error || !saved) throw new Error(error?.message ?? "Could not save the record.");
    return saved as { id: string };
  });
