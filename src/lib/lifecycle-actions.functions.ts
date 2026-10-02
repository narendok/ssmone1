import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const departmentType = z.enum(["hardware", "firmware", "mechanical", "qa", "procurement", "production", "executive"]);

const templateDraftSchema = z.object({
  departmentId: uuid,
  templateKey: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).nullable(),
});

const templateStageSchema = z.object({
  templateId: uuid,
  stageId: uuid.nullable(),
  stageKey: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).nullable(),
  sortOrder: z.number().int().positive(),
  sourceCompanyProcessStageId: uuid,
  taskDepartment: departmentType,
  required: z.boolean(),
});

const templateIdSchema = z.object({ templateId: uuid });
const generationSchema = z.object({ projectId: uuid, templateId: uuid, requestKey: uuid });

function lifecycleError(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

/**
 * Protected façade over service-role-only lifecycle routines. Each routine
 * re-authorizes in the database using the caller JWT, so the server never
 * supplies or substitutes lifecycle actor provenance.
 */
export const createLifecycleTemplateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateDraftSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: templateId, error } = await (supabaseAdmin as any).rpc("create_department_process_template", {
      p_department_id: data.departmentId,
      p_template_key: data.templateKey,
      p_title: data.title,
      p_description: data.description,
    }, { headers: { Authorization: `Bearer ${context.supabase.auth.getSession ? "" : ""}` } });
    if (error) lifecycleError(error, "Template draft could not be created.");
    return { templateId: String(templateId), actorId: context.userId };
  });

export const saveLifecycleTemplateStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateStageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stageId, error } = await (supabaseAdmin as any).rpc("upsert_department_process_template_stage", {
      p_template_id: data.templateId,
      p_stage_id: data.stageId,
      p_stage_key: data.stageKey,
      p_title: data.title,
      p_description: data.description,
      p_sort_order: data.sortOrder,
      p_source_company_process_stage_id: data.sourceCompanyProcessStageId,
      p_task_department: data.taskDepartment,
      p_required: data.required,
    });
    if (error) lifecycleError(error, "Template stage could not be saved.");
    return { stageId: String(stageId), actorId: context.userId };
  });

export const cloneLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: templateId, error } = await (supabaseAdmin as any).rpc("clone_department_process_template", { p_template_id: data.templateId });
    if (error) lifecycleError(error, "Template version could not be cloned.");
    return { templateId: String(templateId), actorId: context.userId };
  });

export const activateLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("activate_department_process_template", { p_template_id: data.templateId });
    if (error) lifecycleError(error, "Template version could not be activated.");
    return { templateId: data.templateId, actorId: context.userId, status: "ACTIVE" as const };
  });

export const retireLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("retire_department_process_template", { p_template_id: data.templateId });
    if (error) lifecycleError(error, "Template version could not be retired.");
    return { templateId: data.templateId, actorId: context.userId, status: "RETIRED" as const };
  });

export const materializeLifecycleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => generationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("generate_project_lifecycle_draft", {
      p_project_id: data.projectId,
      p_template_id: data.templateId,
      p_request_key: data.requestKey,
    });
    if (error) lifecycleError(error, "Lifecycle draft could not be materialized.");
    return { result, actorId: context.userId };
  });