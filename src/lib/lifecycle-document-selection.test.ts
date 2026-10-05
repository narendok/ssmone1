import { describe, expect, it } from "vitest";
import { lifecycleDocumentIntentKey, selectLifecycleDocumentRequest } from "./lifecycle-document-selection";
const project = { id: "project", code: "OEM-1", name: "Tracker", revision: "R1", department_id: "hardware", project_drive_node_id: "root" };
const template = { id: "template", department_id: "hardware", template_key: "PRS", version: 1, title: "Requirements", status: "ACTIVE", active_document_revision_id: "body1" };
const folder = { id: "folder", name: "Requirements", project_id: "project", department_id: "hardware", node_type: "FOLDER", is_trashed: false };
describe("document selection and retry identity", () => {
  it("pins saved body and destination without browser content", () => {
    expect(selectLifecycleDocumentRequest(project, template, folder)).toEqual({ projectId: "project", templateId: "template", templateVersion: 1, templateDocumentRevisionId: "body1", targetFolderId: "folder" });
  });
  it.each([{ ...template, status: "DRAFT" }, { ...template, active_document_revision_id: null }, { ...template, department_id: "hr" }])("blocks ineligible templates", (value) => {
    expect(() => selectLifecycleDocumentRequest(project, value, folder)).toThrow("active template");
  });
  it.each([{ ...folder, project_id: "other" }, { ...folder, department_id: "hr" }, { ...folder, is_trashed: true }, { ...folder, node_type: "FILE" }])("blocks ineligible folders", (value) => {
    expect(() => selectLifecycleDocumentRequest(project, template, value)).toThrow("project's Drive");
  });
  it("separates changed project data, template body and destination from retries", () => {
    const selected = selectLifecycleDocumentRequest(project, template, folder);
    const key = lifecycleDocumentIntentKey(project, selected);
    expect(lifecycleDocumentIntentKey({ ...project }, { ...selected })).toBe(key);
    for (const changed of [{ ...project, name: "Changed" }, { ...project, revision: "R2" }, { ...project, code: "OEM-2" }]) expect(lifecycleDocumentIntentKey(changed, selected)).not.toBe(key);
    expect(lifecycleDocumentIntentKey(project, { ...selected, templateDocumentRevisionId: "body2" })).not.toBe(key);
    expect(lifecycleDocumentIntentKey(project, { ...selected, targetFolderId: "other" })).not.toBe(key);
  });
});
