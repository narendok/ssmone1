import { describe, expect, it } from "vitest";
import { buildLegacyDriveOwnershipPreflight } from "./legacy-drive-ownership-review";

describe("legacy Drive ownership preflight", () => {
  it("reports null ownership without selecting an owner from a title or descendant", () => {
    const result = buildLegacyDriveOwnershipPreflight([{ id: "project-a", code: "EMULATOR", name: "TCU Test Jig", department_id: null, project_drive_node_id: "root-a" }], [{ id: "root-a", project_id: "project-a", department_id: null, parent_id: null, node_type: "FOLDER", folder_kind: "PROJECT_ROOT", current_version: 1, storage_bucket: null, storage_path: null, is_trashed: false }], [], "2026-10-03T00:00:00.000Z");
    expect(result.projects[0]).toMatchObject({ requiresExplicitOwner: true, descendantDepartmentMissingCount: 1, rootGap: false });
    expect(result.counts).toMatchObject({ affectedProjects: 1, unmappedProjects: 1 });
  });

  it("detects descendant mismatches, storage gaps, and absent revision history", () => {
    const result = buildLegacyDriveOwnershipPreflight([{ id: "project-b", code: "B", name: "Mapped", department_id: "dept-a", project_drive_node_id: "root-b" }], [
      { id: "root-b", project_id: "project-b", department_id: "dept-a", parent_id: null, node_type: "FOLDER", folder_kind: "PROJECT_ROOT", current_version: 1, storage_bucket: null, storage_path: null, is_trashed: false },
      { id: "file-b", project_id: "project-b", department_id: null, parent_id: "root-b", node_type: "FILE", folder_kind: "STANDARD", current_version: 2, storage_bucket: null, storage_path: null, is_trashed: false },
    ], []);
    expect(result.projects[0]).toMatchObject({ descendantDepartmentMismatchCount: 1, descendantDepartmentMissingCount: 1, fileStorageGapCount: 1, revisionGapCount: 1 });
  });

  it("does not report a revision gap where persisted history exists", () => {
    const result = buildLegacyDriveOwnershipPreflight([{ id: "project-c", code: "C", name: "Complete", department_id: "dept-a", project_drive_node_id: "root-c" }], [
      { id: "root-c", project_id: "project-c", department_id: "dept-a", parent_id: null, node_type: "FOLDER", folder_kind: "PROJECT_ROOT", current_version: 1, storage_bucket: null, storage_path: null, is_trashed: false },
      { id: "file-c", project_id: "project-c", department_id: "dept-a", parent_id: "root-c", node_type: "FILE", folder_kind: "STANDARD", current_version: 2, storage_bucket: "project-drive", storage_path: "c/file.txt", is_trashed: false },
    ], [{ node_id: "file-c" }]);
    expect(result.projects[0]).toMatchObject({ revisionGapCount: 0, fileStorageGapCount: 0 });
  });
});