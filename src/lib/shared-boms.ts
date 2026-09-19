import { supabase } from "@/integrations/supabase/client";
import type { ShareRow } from "@/lib/bom-share";

const sb = supabase as any;

export interface SharedBom {
  id: string;
  token: string;
  title: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

function makeToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSharedBom(
  title: string,
  rows: ShareRow[],
  expiresInDays: number | null,
): Promise<SharedBom> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("You must be signed in to create a share link");
  const token = makeToken();
  const expires_at = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;
  const { data, error } = await sb
    .from("shared_boms")
    .insert({ token, title, payload: { rows, columns: rows.length ? Object.keys(rows[0]) : [] }, created_by: userId, expires_at })
    .select("id, token, title, created_at, expires_at, revoked_at")
    .single();
  if (error) throw error;
  return data as SharedBom;
}

export async function fetchSharedBoms(): Promise<SharedBom[]> {
  const { data, error } = await sb
    .from("shared_boms")
    .select("id, token, title, created_at, expires_at, revoked_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SharedBom[];
}

export async function revokeSharedBom(id: string): Promise<void> {
  const { error } = await sb
    .from("shared_boms")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
