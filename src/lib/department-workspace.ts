import type { CanonicalDepartment } from "@/lib/tasks";

export type DepartmentWorkTarget = "/projects" | "/hr" | "/procurement/requests" | "/production" | "/qms" | "/sales" | "/tasks";

function normalizedTerms(department: CanonicalDepartment) {
  return [department.name, department.code ?? "", ...department.aliases].map((value) => value.trim().toLowerCase());
}

function includesAny(terms: string[], values: string[]) {
  return values.some((value) => terms.includes(value));
}

export function departmentWorkTarget(department: CanonicalDepartment): DepartmentWorkTarget {
  const terms = normalizedTerms(department);
  if (includesAny(terms, ["human resources", "hr"])) return "/hr";
  if (includesAny(terms, ["procurement, stores & incoming quality", "proc"])) return "/procurement/requests";
  if (includesAny(terms, ["production & calibration", "prod"])) return "/production";
  if (includesAny(terms, ["operations & qms", "ops", "operations", "qms", "management review"])) return "/qms";
  if (includesAny(terms, ["sales", "sal"])) return "/sales";
  if (includesAny(terms, ["hardware & r&d", "rnd"])) return "/projects";
  return "/tasks";
}

export function taskMatchesCanonicalDepartment(taskDepartmentId: string | null, selectedDepartmentId: string) {
  return taskDepartmentId === selectedDepartmentId;
}