import type { CanonicalDepartment } from "@/lib/tasks";

const BOM_DEPARTMENT_CODES = new Set(["RND", "PROC", "PROD"]);

export function canPresentProjectBoms(department: Pick<CanonicalDepartment, "code"> | null | undefined) {
  return Boolean(department?.code && BOM_DEPARTMENT_CODES.has(department.code));
}

export function shouldRequestProjectBoms(input: { filter: string; projectId: string | null | undefined; department: Pick<CanonicalDepartment, "code"> | null | undefined }) {
  return input.filter === "boms" && Boolean(input.projectId || canPresentProjectBoms(input.department));
}