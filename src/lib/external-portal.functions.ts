import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenInput = z.object({ token: z.string().uuid() });
const responseInput = z.object({ reviewId: z.string().uuid(), response: z.string().trim().min(1).max(12000), status: z.enum(["RESPONDED", "CLARIFICATION_REQUIRED"]) });

export const acceptExternalInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tokenInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: access, error } = await supabaseAdmin.from("external_portal_access").select("id,external_contact_id,is_active,expires_at,invitation_revoked_at").eq("invitation_token", data.token).maybeSingle();
    if (error || !access || !access.is_active || access.invitation_revoked_at || (access.expires_at && new Date(access.expires_at) <= new Date())) throw new Error("This invitation is unavailable.");
    const { error: linkError } = await supabaseAdmin.from("external_contacts").update({ user_id: context.userId, portal_enabled: true, active: true, last_login_at: new Date().toISOString() }).eq("id", access.external_contact_id);
    if (linkError) throw new Error(linkError.message);
    const { error: acceptedError } = await supabaseAdmin.from("external_portal_access").update({ invitation_accepted_at: new Date().toISOString() }).eq("id", access.id);
    if (acceptedError) throw new Error(acceptedError.message);
    return { ok: true };
  });

export const getExternalPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: contact, error } = await context.supabase.from("external_contacts").select("id,full_name,external_party_id,external_parties(display_name)").eq("user_id", context.userId).eq("active", true).eq("portal_enabled", true).maybeSingle();
    if (error || !contact) throw new Error("External portal access is not active.");
    const [{ data: shares }, { data: transmittals }, { data: reviews }, { data: uploads }, { data: rooms }] = await Promise.all([
      context.supabase.from("external_share_snapshots").select("id,snapshot_code,source_entity_type,permission,expires_at,share_mode").order("created_at", { ascending: false }),
      context.supabase.from("external_transmittals").select("id,transmittal_number,purpose,status,due_date").order("created_at", { ascending: false }),
      context.supabase.from("external_review_requests").select("id,request_type,revision_reference,status,due_date,response").order("created_at", { ascending: false }),
      context.supabase.from("external_upload_requests").select("id,request_code,requested_document,status,due_date").order("created_at", { ascending: false }),
      context.supabase.from("external_data_rooms").select("id,room_code,title,description,expires_at").order("created_at", { ascending: false }),
    ]);
    await context.supabase.rpc("external_log_access", { _entity_type: "external_portal", _entity_id: contact.id, _event_type: "PORTAL_OPENED", _snapshot_id: null, _metadata: {} });
    return { name: contact.full_name, party: (contact.external_parties as unknown as { display_name?: string } | null)?.display_name ?? "External partner", shares: shares ?? [], transmittals: transmittals ?? [], reviews: reviews ?? [], uploadRequests: uploads ?? [], rooms: rooms ?? [] };
  });

export const respondToExternalReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => responseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("external_review_requests").update({ response: data.response, status: data.status }).eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    await context.supabase.rpc("external_log_access", { _entity_type: "external_review_request", _entity_id: data.reviewId, _event_type: "RESPONSE_SUBMITTED", _snapshot_id: null, _metadata: { status: data.status } });
    return { ok: true };
  });
