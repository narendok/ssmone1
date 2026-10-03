import type { SupabaseClient } from "@supabase/supabase-js";
import { mapLifecycleProjectDocumentFields } from "./lifecycle-document-fields";
import { renderLifecycleDocument, type RenderedLifecycleDocument } from "./lifecycle-document-renderer";

export type LifecycleDocumentPreflight = {
  projectId: string;
  targetFolderId: string;
  templateDocumentRevisionId: string;
  requestKey: string;
  rendered: RenderedLifecycleDocument;
  sourceFingerprint: string;
};

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  revision: string | null;
  department_id: string | null;
  project_drive_node_id: string | null;
  updated_at: string;
};

type DepartmentRow = { id: string; name: string; is_active: boolean };
type TemplateRow = { id: string; department_id: string; template_key: string; version: number; title: string; status: string };
type TemplateRevisionRow = { id: string; template_id: string; content: string };
type TargetRow = { id: string; project_id: string | null; department_id: string | null; node_type: string; is_trashed: boolean };

function sha256(input: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then((buffer) =>
    Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}

function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

/**
 * Server-only read model. The browser may request only immutable identifiers;
 * all rendered content, Drive scope and source fingerprint are loaded here.
 */
export async function loadLifecycleDocumentPreflight(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    templateId: string;
    templateVersion: number;
    templateDocumentRevisionId: string;
    targetFolderId: string;
    requestKey: string;
  },
): Promise<LifecycleDocumentPreflight> {
  const [{ data: project, error: projectError }, { data: template, error: templateError }, { data: revision, error: revisionError }, { data: target, error: targetError }] = await Promise.all([
    supabase.from("projects").select("id,code,name,revision,department_id,project_drive_node_id,updated_at").eq("id", input.projectId).maybeSingle(),
    supabase.from("department_process_templates").select("id,department_id,template_key,version,title,status").eq("id", input.templateId).maybeSingle(),
    supabase.from("department_process_template_document_revisions" as never).select("id,template_id,content").eq("id", input.templateDocumentRevisionId).maybeSingle(),
    supabase.from("drive_nodes").select("id,project_id,department_id,node_type,is_trashed").eq("id", input.targetFolderId).maybeSingle(),
  ]);

  if (projectError || !project) fail(projectError, "Project was not found.");
  if (templateError || !template) fail(templateError, "Template was not found.");
  if (revisionError || !revision) fail(revisionError, "Immutable template content revision was not found.");
  if (targetError || !target) fail(targetError, "Target Drive folder was not found.");

  const typedProject = project as ProjectRow;
  const typedTemplate = template as TemplateRow;
  const typedRevision = revision as unknown as TemplateRevisionRow;
  const typedTarget = target as TargetRow;
  if (!typedProject.department_id || typedTemplate.department_id !== typedProject.department_id || typedTemplate.version !== input.templateVersion || typedTemplate.status !== "ACTIVE") {
    throw new Error("An active template matching the project's owning department and pinned version is required.");
  }
  if (typedRevision.template_id !== typedTemplate.id) throw new Error("Template content revision does not belong to the pinned template.");
  if (typedTarget.node_type.toUpperCase() !== "FOLDER" || typedTarget.is_trashed || typedTarget.project_id !== typedProject.id || typedTarget.department_id !== typedProject.department_id) {
    throw new Error("Target folder is outside the authorized project Drive.");
  }

  const { data: department, error: departmentError } = await supabase
    .from("departments")
    .select("id,name,is_active")
    .eq("id", typedProject.department_id)
    .maybeSingle();
  if (departmentError || !department) fail(departmentError, "Owning department was not found.");

  const fields = mapLifecycleProjectDocumentFields(typedProject, department as DepartmentRow);
  const rendered = renderLifecycleDocument({
    templateKey: typedTemplate.template_key,
    version: typedTemplate.version,
    title: typedTemplate.title,
    content: typedRevision.content,
  }, fields);
  const sourceFingerprint = await sha256(JSON.stringify({
    projectId: typedProject.id,
    targetFolderId: typedTarget.id,
    templateId: typedTemplate.id,
    templateVersion: typedTemplate.version,
    templateDocumentRevisionId: typedRevision.id,
    renderedSha256: await sha256(rendered.content),
  }));

  return {
    projectId: typedProject.id,
    targetFolderId: typedTarget.id,
    templateDocumentRevisionId: typedRevision.id,
    requestKey: input.requestKey,
    rendered,
    sourceFingerprint,
  };
}