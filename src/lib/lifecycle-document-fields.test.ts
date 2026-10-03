import { describe, expect, it } from "vitest";
import { mapLifecycleProjectDocumentFields } from "./lifecycle-document-fields";

const project = { id: "project", code: "PROJECT-TEST", name: "Sample OEM tracker", revision: "TEST-01", department_id: "hardware", project_drive_node_id: "root", updated_at: "2026-10-03" };
const department = { id: "hardware", name: "Hardware", is_active: true };

describe("authoritative project field mapping", () => {
  it("maps verified project fields without guessing missing requirements", () => {
    expect(mapLifecycleProjectDocumentFields(project, department)).toEqual({ PROJECT_CODE: "PROJECT-TEST", PROJECT_NAME: "Sample OEM tracker", PROJECT_REVISION: "TEST-01", DEPARTMENT: "Hardware" });
  });
  it("reflects an updated project revision", () => {
    expect(mapLifecycleProjectDocumentFields({ ...project, revision: "TEST-02" }, department).PROJECT_REVISION).toBe("TEST-02");
  });
  it("rejects a department mismatch", () => {
    expect(() => mapLifecycleProjectDocumentFields(project, { ...department, id: "hr" })).toThrow("belong");
  });
  it("rejects an inactive department", () => {
    expect(() => mapLifecycleProjectDocumentFields(project, { ...department, is_active: false })).toThrow("active");
  });
  it.each([{ revision: null }, { project_drive_node_id: null }, { code: " " }, { name: " " }])("rejects incomplete provenance: %o", (missing) => {
    expect(() => mapLifecycleProjectDocumentFields({ ...project, ...missing }, department)).toThrow("required");
  });
});
