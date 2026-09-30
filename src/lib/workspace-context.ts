export const WORKSPACE_CONTEXT_EVENT = "ssm-one-workspace-context";
export const WORKSPACE_CONTEXT_KEY = "ssm-one-workspace-department";

export function readWorkspaceDepartmentId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WORKSPACE_CONTEXT_KEY);
}

export function setWorkspaceDepartmentId(departmentId: string | null) {
  if (typeof window === "undefined") return;
  if (departmentId) window.localStorage.setItem(WORKSPACE_CONTEXT_KEY, departmentId);
  else window.localStorage.removeItem(WORKSPACE_CONTEXT_KEY);
  window.dispatchEvent(new Event(WORKSPACE_CONTEXT_EVENT));
}