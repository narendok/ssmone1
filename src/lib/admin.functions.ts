import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function requireSystemAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("You do not have permission to perform this action.");
}

export const saveOrganizationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; legal_name: string; brand_name: string; default_email: string | null; phone: string | null; website: string | null; address: string | null; footer_text: string | null }) => input)
  .handler(async ({ data, context }) => {
    await requireSystemAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("organizations").update(data).eq("id", data.id);
    if (error) throw new Error("Could not save organization settings.");
    await supabaseAdmin.from("activity_log").insert({ actor_user_id: context.userId, module_key: "admin", entity_type: "organization", entity_id: data.id, action: "edited", summary: "Updated organization settings" });
  });

export const saveDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; name: string; code: string | null; description: string | null; aliases: string[]; is_active: boolean; document_code_enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    await requireSystemAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedName = data.name.trim();
    const normalizedCode = data.code?.trim().toUpperCase() || null;
    const { data: duplicate, error: duplicateError } = await context.supabase.from("departments").select("id,name,code").or(`name.ilike.${normalizedName}${normalizedCode ? `,code.eq.${normalizedCode}` : ""}`).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
    if (duplicateError) throw new Error("Could not check existing departments.");
    if (duplicate) throw new Error(`A department already uses ${duplicate.code ?? duplicate.name}.`);
    const payload = { name: normalizedName, code: normalizedCode, description: data.description, aliases: data.aliases.map((alias) => alias.trim()).filter(Boolean), is_active: data.is_active, document_code_enabled: data.document_code_enabled };
    const result = data.id ? await supabaseAdmin.from("departments").update(payload).eq("id", data.id).select("id").single() : await supabaseAdmin.from("departments").insert(payload).select("id").single();
    if (result.error || !result.data) throw new Error("Could not save the department.");
    await supabaseAdmin.from("activity_log").insert({ actor_user_id: context.userId, module_key: "admin", entity_type: "department", entity_id: result.data.id, action: data.id ? "edited" : "created", summary: `${data.id ? "Updated" : "Created"} department: ${data.name}` });
  });
