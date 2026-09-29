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
  if (includesAny(terms, ["procurement, stores & incoming quality", "proc", "purchase", "pur", "pd", "procurement", "stores", "str", "incoming quality", "quality assurance", "qa"])) return "/procurement/requests";
  if (includesAny(terms, ["production & calibration", "prod", "production", "mprd", "prd-01", "engineering production", "eprd", "prd-02", "calibration"])) return "/production";
  if (includesAny(terms, ["operations & qms", "ops", "operations", "qms", "management review"])) return "/qms";
  if (includesAny(terms, ["sales", "sal", "marketing & business development", "mkt", "bd", "customer support", "cs"])) return "/sales";
  if (includesAny(terms, ["hardware & r&d", "rnd", "hw", "hardware", "embedded software", "esw", "software", "sw", "research & development", "r&d"])) return "/projects";
  return "/tasks";
}

export function taskMatchesCanonicalDepartment(taskDepartmentId: string | null, selectedDepartmentId: string) {
  return taskDepartmentId === selectedDepartmentId;
}