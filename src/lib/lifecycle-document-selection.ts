export type DocumentTemplateSelection = { id: string; department_id: string; template_key: string; version: number; title: string; status: string; active_document_revision_id: string | null };
export type DocumentFolderSelection = { id: string; name: string; project_id: string | null; department_id: string | null; node_type: string; is_trashed: boolean };

/** Presentation validation only; the authenticated server revalidates scope. */
export function selectLifecycleDocumentRequest(
  project: { id: string; department_id: string | null; revision: string | null; project_drive_node_id: string | null },
  template: DocumentTemplateSelection | undefined, folder: DocumentFolderSelection | undefined,
) {
  if (!project.department_id || !project.revision || !project.project_drive_node_id) throw new Error("Link the project's department, revision and Drive root first.");
  if (!template || template.status !== "ACTIVE" || template.department_id !== project.department_id || !template.active_document_revision_id) throw new Error("Choose an active template with saved content for this department.");
  if (!folder || folder.project_id !== project.id || folder.department_id !== project.department_id || folder.node_type !== "FOLDER" || folder.is_trashed) throw new Error("Choose a folder in this project's Drive.");
  return { projectId: project.id, templateId: template.id, templateVersion: template.version, templateDocumentRevisionId: template.active_document_revision_id, targetFolderId: folder.id };
}

/** Failed saves reuse their key; changed source or mapping requires a new key. */
export function lifecycleDocumentIntentKey(
  project: { id: string; code: string; name: string; revision: string | null; department_id: string | null; project_drive_node_id: string | null },
  selection: ReturnType<typeof selectLifecycleDocumentRequest>,
) {
  return JSON.stringify([project.id, project.code, project.name, project.revision, project.department_id, project.project_drive_node_id, selection.templateId, selection.templateVersion, selection.templateDocumentRevisionId, selection.targetFolderId]);
}
