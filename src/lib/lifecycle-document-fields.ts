import type { Database } from "@/integrations/supabase/types";

type Project = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "code" | "name" | "revision" | "department_id" | "project_drive_node_id" | "updated_at">;
type Department = Pick<Database["public"]["Tables"]["departments"]["Row"], "id" | "name" | "is_active">;

/** Call only with server-loaded, caller-authorized records, never form data. */
export function mapLifecycleProjectDocumentFields(project: Project, department: Department) {
  if (!project.department_id || project.department_id !== department.id || !department.is_active) {
    throw new Error("Project must belong to the active source department.");
  }
  if (!project.project_drive_node_id || !project.revision?.trim() || !project.code.trim() || !project.name.trim()) {
    throw new Error("Project code, name, revision and Drive root are required.");
  }
  return {
    PROJECT_CODE: project.code,
    PROJECT_NAME: project.name,
    PROJECT_REVISION: project.revision,
    DEPARTMENT: department.name,
  };
}
