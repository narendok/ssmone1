import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const managedTables = [
  "external_parties", "external_contacts", "external_portal_access", "external_share_snapshots",
  "external_transmittals", "external_review_requests", "external_actions", "external_upload_requests",
  "external_data_rooms", "external_data_room_items", "external_api_clients", "external_webhook_subscriptions",
] as const;

type Phase10Table = (typeof managedTables)[number];

export const savePhase10Record = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: Phase10Table; id?: string; payload: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("has_permission", {
      _user_id: context.userId,
      _permission_key: "external_collaboration.manage",
    });
    if (accessError || !allowed) throw new Error("You do not have permission to manage external collaboration.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const query = data.id
      ? (supabaseAdmin.from(data.table) as any).update(data.payload).eq("id", data.id)
      : (supabaseAdmin.from(data.table) as any).insert({ ...data.payload, created_by: context.userId });
    const { data: saved, error } = await query.select("id").single();
    if (error || !saved) throw new Error(error?.message ?? "Could not save the record.");
    return saved as { id: string };
  });
