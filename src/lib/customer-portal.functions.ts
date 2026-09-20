import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().uuid() });

export const getCustomerPortal = createServerFn({ method: "GET" })
  .inputValidator((data) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { data: portal, error } = await createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, { auth: { persistSession: false }, global: { fetch: (input, init) => { const headers = new Headers(init?.headers); const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!; if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization"); headers.set("apikey", key); return fetch(input, { ...init, headers }); } } }).from("customer_portal_access").select("id,customer_id,label,expires_at,is_active,customer:customers(legal_name,display_name)").eq("access_token", data.token).eq("is_active", true).maybeSingle();
    if (error || !portal || (portal.expires_at && new Date(portal.expires_at) < new Date())) return { valid: false, label: "", customer: "", items: [] as Array<{ type: string; title: string; status: string; reference: string }> };
    return { valid: true, label: portal.label, customer: (portal.customer as any)?.display_name ?? (portal.customer as any)?.legal_name ?? "Customer", items: [] as Array<{ type: string; title: string; status: string; reference: string }> };
  });