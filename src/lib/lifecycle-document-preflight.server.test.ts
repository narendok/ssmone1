import { describe, expect, it, vi } from "vitest";
import { loadLifecycleDocumentPreflight } from "./lifecycle-document-preflight.server";

const ids = {
  project: "00000000-0000-0000-0000-000000000001",
  department: "00000000-0000-0000-0000-000000000002",
  template: "00000000-0000-0000-0000-000000000003",
  revision: "00000000-0000-0000-0000-000000000004",
  target: "00000000-0000-0000-0000-000000000005",
  request: "00000000-0000-0000-0000-000000000006",
};

function client(overrides: Record<string, unknown> = {}) {
  const records: Record<string, unknown> = {
    projects: { id: ids.project, code: "PROJECT-2026-0005", name: "OEM Tracker Portal Test", revision: "TEST-01", department_id: ids.department, project_drive_node_id: "root", updated_at: "2026-10-03T00:00:00Z" },
    department_process_templates: { id: ids.template, department_id: ids.department, template_key: "OEM-TRACKER", version: 1, title: "OEM Tracker", status: "ACTIVE" },
    department_process_template_document_revisions: { id: ids.revision, template_id: ids.template, content: "{{PROJECT_CODE}} / {{PROJECT_NAME}} / {{PROJECT_REVISION}} / {{DEPARTMENT}}" },
    drive_nodes: { id: ids.target, project_id: ids.project, department_id: ids.department, node_type: "FOLDER", is_trashed: false },
    departments: { id: ids.department, name: "Hardware & R&D", is_active: true },
    ...overrides,
  };
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: records[table] ?? null, error: null })) })) })),
    })),
  } as never;
}

const input = { projectId: ids.project, templateId: ids.template, templateVersion: 1, templateDocumentRevisionId: ids.revision, targetFolderId: ids.target, requestKey: ids.request };

describe("server-owned lifecycle document preflight", () => {
  it("loads immutable content, target, and project fields instead of browser document data", async () => {
    const result = await loadLifecycleDocumentPreflight(client(), input);
    expect(result.rendered.content).toBe("PROJECT-2026-0005 / OEM Tracker Portal Test / TEST-01 / Hardware & R&D");
    expect(result.rendered.templatePin).toEqual({ templateKey: "OEM-TRACKER", version: 1 });
    expect(result.templateDocumentRevisionId).toBe(ids.revision);
    expect(result.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the canonical fingerprint when the server-loaded project source changes", async () => {
    const first = await loadLifecycleDocumentPreflight(client(), input);
    const updated = await loadLifecycleDocumentPreflight(client({ projects: { id: ids.project, code: "PROJECT-2026-0005", name: "OEM Tracker Portal Test", revision: "TEST-02", department_id: ids.department, project_drive_node_id: "root", updated_at: "2026-10-03T00:00:00Z" } }), input);
    expect(updated.sourceFingerprint).not.toBe(first.sourceFingerprint);
  });

  it("rejects content/template and target/project scope mismatches", async () => {
    await expect(loadLifecycleDocumentPreflight(client({ department_process_template_document_revisions: { id: ids.revision, template_id: "other", content: "{{PROJECT_CODE}}" } }), input)).rejects.toThrow("does not belong");
    await expect(loadLifecycleDocumentPreflight(client({ drive_nodes: { id: ids.target, project_id: "other", department_id: ids.department, node_type: "FILE", is_trashed: false } }), input)).rejects.toThrow("outside");
  });
});