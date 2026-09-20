import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const provenanceSchema = z.object({
  entityType: z.string().trim().min(1).max(80),
  entityId: z.string().uuid(),
  fieldKey: z.string().trim().min(1).max(120),
  sourceKind: z.enum(["ssm", "derived", "external", "ai", "manual"]),
  provider: z.string().trim().max(120).nullable(),
  sourceIdentifier: z.string().trim().max(500).nullable(),
  sourceUrl: z.string().trim().url().max(2000).nullable(),
  valueSnapshot: z.unknown().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  state: z.enum(["suggested", "needs_review", "confirmed", "rejected", "overridden"]),
});

const confirmProvenanceSchema = z.object({
  id: z.string().uuid(),
  state: z.enum(["confirmed", "rejected", "overridden"]),
  overrideValue: z.unknown().nullable(),
  overrideReason: z.string().trim().max(1000).nullable(),
});

const updateRuleSchema = z.object({ id: z.string().uuid(), isEnabled: z.boolean() });

async function requireAdmin(sb: any, userId: string) {
  const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("You do not have permission to manage automation.");
}

export const recordProvenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => provenanceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload = {
      entity_type: data.entityType,
      entity_id: data.entityId,
      field_key: data.fieldKey,
      source_kind: data.sourceKind,
      provider: data.provider,
      source_identifier: data.sourceIdentifier,
      source_url: data.sourceUrl,
      value_snapshot: data.valueSnapshot,
      confidence: data.confidence,
      state: data.state,
    };
    const { data: saved, error } = await sb
      .from("data_provenance")
      .upsert(payload, { onConflict: "entity_type,entity_id,field_key,source_kind,provider" })
      .select("id")
      .single();
    if (error || !saved) throw new Error(error?.message ?? "Could not record the data source.");
    return { id: saved.id };
  });

export const confirmProvenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmProvenanceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const patch = {
      state: data.state,
      last_verified_at: new Date().toISOString(),
      confirmed_at: data.state === "confirmed" ? new Date().toISOString() : null,
      confirmed_by: data.state === "confirmed" ? context.userId : null,
      override_value: data.state === "overridden" ? data.overrideValue : null,
      override_by: data.state === "overridden" ? context.userId : null,
      override_reason: data.state === "overridden" ? data.overrideReason : null,
    };
    const { error } = await sb.from("data_provenance").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateRuleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireAdmin(sb, context.userId);
    const { error } = await sb.from("automation_rules").update({ is_enabled: data.isEnabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });