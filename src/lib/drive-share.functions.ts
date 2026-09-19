import { createServerFn } from "@tanstack/react-start";

export interface SharedFileResult {
  ok: boolean;
  reason?: string;
  name?: string;
  sizeBytes?: number;
  checksum?: string | null;
  permission?: "VIEW" | "DOWNLOAD";
  url?: string;
  mimeType?: string | null;
}

/** Resolves a public share token into a short-lived signed file URL. */
export const resolveSharedFile = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => {
    if (!data?.token || !/^[a-f0-9]{8,64}$/i.test(data.token)) throw new Error("Invalid link");
    return data;
  })
  .handler(async ({ data }): Promise<SharedFileResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: link } = await sb
      .from("drive_share_links")
      .select("*")
      .eq("share_token", data.token)
      .maybeSingle();

    if (!link) return { ok: false, reason: "This link is not valid." };
    if (link.revoked_at) return { ok: false, reason: "This link has been revoked." };
    if (link.expires_at && new Date(link.expires_at) < new Date())
      return { ok: false, reason: "This link has expired." };

    const { data: node } = await sb.from("drive_nodes").select("*").eq("id", link.node_id).maybeSingle();
    if (!node || node.is_trashed || !node.storage_path)
      return { ok: false, reason: "This file is no longer available." };

    const { data: signed, error } = await supabaseAdmin.storage
      .from(node.storage_bucket ?? "project-drive")
      .createSignedUrl(node.storage_path, 3600);
    if (error || !signed) return { ok: false, reason: "Could not open this file right now." };

    return {
      ok: true,
      name: node.name,
      sizeBytes: node.file_size_bytes,
      checksum: node.sha256_checksum,
      permission: link.permission_level,
      mimeType: node.mime_type,
      url: signed.signedUrl,
    };
  });
