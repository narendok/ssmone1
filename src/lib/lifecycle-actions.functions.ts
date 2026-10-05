import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LifecycleTransactionClient } from "@/lib/lifecycle-actor-transport.server";
import { lifecycleAcceptanceEnabled } from "@/lib/lifecycle-acceptance-gate";

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
const templateContentRevisionSchema = z.object({
  templateId: uuid,
  content: z.string().max(200_000).refine((value) => value.trim().length > 0, "Template content is required."),
});
const templateActivationSchema = z.object({
  templateId: uuid,
  templateDocumentRevisionId: uuid,
});
const generationSchema = z.object({ projectId: uuid, templateId: uuid, requestKey: uuid });
const documentDraftSchema = z.object({
  projectId: uuid,
  templateId: uuid,
  templateVersion: z.number().int().positive(),
  templateDocumentRevisionId: uuid,
  targetFolderId: uuid,
  requestKey: uuid,
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
  if (!lifecycleAcceptanceEnabled(process.env.SUPABASE_URL, process.env.LIFECYCLE_DOCUMENT_ACCEPTANCE)) {
    throw new Error("Lifecycle mutations are disabled pending reviewed database acceptance.");
  }
}

async function acceptedLifecycleClient(context: { userId: string }): Promise<LifecycleTransactionClient> {
  // Resolve acceptance before instantiating any privileged client. userId is
  // provided by verified requireSupabaseAuth context, never the input schema.
  await lifecycleMutationGate();
  const [{ supabaseAdmin }, { createLifecycleActorTransport }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("@/lib/lifecycle-actor-transport.server"),
  ]);
  return createLifecycleActorTransport(supabaseAdmin, context.userId);
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
    const { createLifecycleTemplateManagementStore } = await import("@/lib/lifecycle-template-management.server");
    const templateId = await createLifecycleTemplateManagementStore(context.supabase).create(data);
    return { templateId, actorId: context.userId };
  });

export const saveLifecycleTemplateStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateStageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase.from("department_process_templates").select("department_id").eq("id", data.templateId).maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    await lifecycleMutationGate();
    const { createLifecycleTemplateManagementStore } = await import("@/lib/lifecycle-template-management.server");
    const stageId = await createLifecycleTemplateManagementStore(context.supabase).stage(data);
    return { stageId, actorId: context.userId };
  });

export const cloneLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase.from("department_process_templates").select("department_id").eq("id", data.templateId).maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    await lifecycleMutationGate();
    const { createLifecycleTemplateManagementStore } = await import("@/lib/lifecycle-template-management.server");
    const templateId = await createLifecycleTemplateManagementStore(context.supabase).clone(data.templateId);
    return { templateId, actorId: context.userId };
  });

/**
 * Protected handler for the pending append-only template-content routine.
 * It performs no privileged RPC while the lifecycle mutation gate is shut.
 */
export const createLifecycleTemplateContentRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateContentRevisionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase
      .from("department_process_templates")
      .select("department_id,status")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    if (template.status !== "DRAFT") throw new Error("Immutable content can be appended only to a DRAFT template version.");
    const client = await acceptedLifecycleClient(context);
    const { createLifecycleTemplateContentStore } = await import("@/lib/lifecycle-template-content.server");
    const revision = await createLifecycleTemplateContentStore(client).append(data.templateId, data.content);
    return { templateDocumentRevisionId: revision.id, revisionNumber: revision.revisionNumber, checksum: revision.checksum, actorId: context.userId };
  });

export const activateLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateActivationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase.from("department_process_templates").select("department_id").eq("id", data.templateId).maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    const client = await acceptedLifecycleClient(context);
    const { createLifecycleTemplateContentStore } = await import("@/lib/lifecycle-template-content.server");
    await createLifecycleTemplateContentStore(client).activate(data.templateId, data.templateDocumentRevisionId);
    return { templateId: data.templateId, templateDocumentRevisionId: data.templateDocumentRevisionId, actorId: context.userId, status: "ACTIVE" as const };
  });

export const retireLifecycleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase.from("department_process_templates").select("department_id").eq("id", data.templateId).maybeSingle();
    if (error || !template) lifecycleError(error, "Template was not found.");
    await requireLifecycleManager(context, template.department_id);
    const client = await acceptedLifecycleClient(context);
    const { createLifecycleTemplateContentStore } = await import("@/lib/lifecycle-template-content.server");
    await createLifecycleTemplateContentStore(client).retire(data.templateId);
    return { templateId: data.templateId, actorId: context.userId, status: "RETIRED" as const };
  });

export const materializeLifecycleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => generationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase.from("projects").select("department_id").eq("id", data.projectId).maybeSingle();
    if (error || !project?.department_id) lifecycleError(error, "Project requires an owning department.");
    await requireLifecycleManager(context, project.department_id);
    throw new Error("Lifecycle task materialization is not available. Use the document draft workflow.");
  });

/**
 * Deliberately gated document-producing facade. The pending database contract
 * server-loads immutable template content and source fields, then atomically
 * persists a Drive revision, DRAFT register, audit event, and receipt.
 */
export const generateLifecycleDocumentDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => documentDraftSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("id,code,name,department_id,project_drive_node_id,revision,updated_at")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error || !project?.department_id) lifecycleError(error, "Project requires an owning department.");
    if (!project.project_drive_node_id || !project.revision) {
      throw new Error("Project Drive root and revision are required for document draft generation.");
    }
    await requireLifecycleManager(context, project.department_id);
    const { runLifecycleDocumentWorkflow } = await import("@/lib/lifecycle-document-workflow.server");
    const result = await runLifecycleDocumentWorkflow(context.supabase, data, () => acceptedLifecycleClient(context));
    return { result, actorId: context.userId };
  });

export const generateProjectLifecycleDocumentDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ projectId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    await lifecycleMutationGate();
    const { data: project, error } = await context.supabase.from("projects")
      .select("id,department_id,project_drive_node_id,revision").eq("id", data.projectId).maybeSingle();
    if (error || !project?.department_id || !project.project_drive_node_id || !project.revision) {
      lifecycleError(error, "Project department, revision and Drive root are required for automatic drafts.");
    }
    await requireLifecycleManager(context, project.department_id);
    const { generateProjectDocumentDrafts } = await import("@/lib/lifecycle-project-generation.server");
    return generateProjectDocumentDrafts(context.supabase, context.userId,
      { id: project.id, department_id: project.department_id, project_drive_node_id: project.project_drive_node_id },
      () => acceptedLifecycleClient(context));
  });
