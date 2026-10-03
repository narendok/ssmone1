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
const documentDraftSchema = z.object({
  projectId: uuid,
  templateId: uuid,
  templateVersion: z.number().int().positive(),
  targetFolderId: uuid,
  requestKey: uuid,
  sourceFingerprint: z.string().trim().min(1).max(4000),
});

function lifecycleError(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

async function requireLifecycleManager(
  context: { supabase: any; userId: string },
  departmentId: string,
) {
  const [{ data: inScope, error: scopeError }, { data: permitted, error: permissionError }] = await Promise.all([
    context.supabase.rpc("can_access_department_drive", {
      _user_id: context.userId,
      _department_id: departmentId,
      _project_id: null,
    }),
    context.supabase.rpc("has_any_permission", {
      _user_id: context.userId,
      _permission_keys: ["projects.manage", "engineering.manage", "documents.edit"],
    }),
  ]);
  if (scopeError || permissionError || !inScope || !permitted) throw new Error("You do not have permission to manage this department template.");
}

async function lifecycleMutationGate() {
  // Database action routines deliberately retain service-role-only execution.
  // Releasing an execution bridge requires the separate DB/RLS acceptance pack.
  throw new Error("Lifecycle mutations are disabled pending reviewed database acceptance.");
}

/**
 * Source-only protected façade contract. Each route authenticates and proves
 * department scope before the deliberate no-mutation deployment gate.
 */
export const createLifecycleTemplateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateDraftSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireLifecycleManager(context, data.departmentId);
    await lifecycleMutationGate();
    return { templateId: "", actorId: context.userId };
  });

export const saveLifecycleTemplateStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateStageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase.from("department_process_templates").select("department_id").eq("id", data.templateId).maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    await lifecycleMutationGate();
    return { stageId: "", actorId: context.userId };
  });

export const cloneLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase.from("department_process_templates").select("department_id").eq("id", data.templateId).maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    await lifecycleMutationGate();
    return { templateId: "", actorId: context.userId };
  });

export const activateLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase.from("department_process_templates").select("department_id").eq("id", data.templateId).maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    await lifecycleMutationGate();
    return { templateId: data.templateId, actorId: context.userId, status: "ACTIVE" as const };
  });

export const retireLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase.from("department_process_templates").select("department_id").eq("id", data.templateId).maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    await lifecycleMutationGate();
    return { templateId: data.templateId, actorId: context.userId, status: "RETIRED" as const };
  });

export const materializeLifecycleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => generationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase.from("projects").select("department_id").eq("id", data.projectId).maybeSingle();
    if (error || !project?.department_id) lifecycleError(error, "Project requires an owning department.");
    await requireLifecycleManager(context, project.department_id);
    await lifecycleMutationGate();
    return { result: null, actorId: context.userId };
  });

/**
 * Deliberately gated facade for the future document-producing action. Unlike
 * lifecycle materialization, this must render content, store a Drive file,
 * create a persisted source revision and audit-linked controlled draft in one
 * replay-safe server transaction. It is not available until isolated tests
 * prove authorization, rollback, concurrency and non-admin RLS behavior.
 */
export const generateLifecycleDocumentDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => documentDraftSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("department_id,project_drive_node_id,revision")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error || !project?.department_id) lifecycleError(error, "Project requires an owning department.");
    if (!project.project_drive_node_id || !project.revision) {
      throw new Error("Project Drive root and revision are required for document draft generation.");
    }
    const { data: template, error: templateError } = await context.supabase
      .from("department_process_templates")
      .select("department_id,version,status")
      .eq("id", data.templateId)
      .maybeSingle();
    if (templateError || !template) lifecycleError(templateError, "Template was not found.");
    if (template.department_id !== project.department_id || template.version !== data.templateVersion || template.status !== "ACTIVE") {
      throw new Error("An active template with the pinned project department version is required.");
    }
    await requireLifecycleManager(context, project.department_id);
    await lifecycleMutationGate();
    return { result: null, actorId: context.userId };
  });