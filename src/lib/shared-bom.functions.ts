import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface PublicSharedBom {
  title: string;
  created_at: string;
  rows: Record<string, string | number>[];
  columns: string[];
}

/** Public read of a shared list snapshot. The table stays closed to anon. */
export const getSharedBom = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().min(8).max(200) }).parse(data))
  .handler(async ({ data }): Promise<PublicSharedBom | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("shared_boms")
      .select("title, payload, created_at, expires_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    if (row.revoked_at) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
    const payload = (row.payload ?? {}) as any;
    return {
      title: row.title as string,
      created_at: row.created_at as string,
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      columns: Array.isArray(payload.columns) && payload.columns.length
        ? payload.columns
        : Array.isArray(payload.rows) && payload.rows.length
          ? Object.keys(payload.rows[0])
          : [],
    };
  });
