import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export const LEGACY_DEPARTMENTS = [
  { value: "hardware", label: "Hardware", dot: "bg-sky-500", pill: "bg-sky-500/15 text-sky-600 border-sky-500/30" },
  { value: "firmware", label: "Firmware", dot: "bg-violet-500", pill: "bg-violet-500/15 text-violet-600 border-violet-500/30" },
  { value: "mechanical", label: "Mechanical", dot: "bg-amber-500", pill: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  { value: "qa", label: "QA", dot: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  { value: "procurement", label: "Procurement", dot: "bg-orange-500", pill: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  { value: "production", label: "Production", dot: "bg-teal-500", pill: "bg-teal-500/15 text-teal-600 border-teal-500/30" },
  { value: "executive", label: "Executive / PM", dot: "bg-rose-500", pill: "bg-rose-500/15 text-rose-600 border-rose-500/30" },
] as const;
// Transitional export retained for existing read-only task views while forms use the canonical master.
export const DEPARTMENTS = LEGACY_DEPARTMENTS;

export type Department = (typeof LEGACY_DEPARTMENTS)[number]["value"];

export function department(value: string | null | undefined) {
  return LEGACY_DEPARTMENTS.find((d) => d.value === value) ?? null;
}

export const TASK_STATUSES = [
  { value: "todo", label: "To do", color: "bg-slate-500" },
  { value: "in_progress", label: "In progress", color: "bg-blue-500" },
  { value: "in_review", label: "In review", color: "bg-violet-500" },
  { value: "blocked", label: "Blocked", color: "bg-rose-500" },
  { value: "done", label: "Done", color: "bg-emerald-500" },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]["value"];

export const OPEN_TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "in_review", "blocked"];

export const TASK_PRIORITIES = [
  { value: "low", label: "Low", color: "text-muted-foreground" },
  { value: "medium", label: "Medium", color: "text-sky-600" },
  { value: "high", label: "High", color: "text-amber-600" },
  { value: "urgent", label: "Urgent", color: "text-rose-600" },
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number]["value"];

export function statusLabel(value: string) {
  return TASK_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  department: Department;
  department_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  logged_hours: number | null;
  ppap_element: string | null;
  drive_node_id: string | null;
  pcb_task_id: string | null;
  purchase_request_id: string | null;
  qms_capa_id: string | null;
  customer_complaint_id: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; name: string; email: string; department: Department | null; department_id: string | null } | null;
  department_record?: { id: string; name: string; code: string | null } | null;
  project?: { id: string; name: string; code: string; color: string } | null;
  purchase_request?: { id: string; request_number: string; status: string } | null;
  qms_capa?: { id: string; capa_code: string; title: string; status: string } | null;
  customer_complaint?: { id: string; complaint_code: string; title: string; status: string } | null;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  label: string;
  is_done: boolean;
  sort_order: number;
  created_at: string;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  kind: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  body: string | null;
  actor_id: string | null;
  created_at: string;
}

const SELECT =
  "*, assignee:rd_members(id,name,email,department,department_id), department_record:departments(id,name,code), project:projects(id,name,code,color), purchase_request:purchase_requests(id,request_number,status), qms_capa:qms_capas(id,capa_code,title,status), customer_complaint:customer_complaints(id,complaint_code,title,status)";

export type CanonicalDepartment = { id: string; name: string; code: string | null; aliases: string[] };

export async function fetchCanonicalDepartments(): Promise<CanonicalDepartment[]> {
  const { data, error } = await sb.from("departments").select("id,name,code,aliases").eq("is_active", true).order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []) as CanonicalDepartment[];
}

export async function fetchTasks(projectId?: string): Promise<ProjectTask[]> {
  let q = sb.from("project_tasks").select(SELECT).order("sort_order").order("created_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProjectTask[];
}

export async function fetchOpenTaskCount(): Promise<number> {
  const { count, error } = await sb
    .from("project_tasks")
    .select("id", { count: "exact", head: true })
    .in("status", OPEN_TASK_STATUSES);
  if (error) return 0;
  return count ?? 0;
}

export type TaskInput = Partial<Omit<ProjectTask, "assignee" | "project">> & { title: string };

export async function createTask(input: TaskInput) {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await sb.from("project_tasks").insert({ ...input, created_by: session.user?.id ?? null });
  if (error) throw error;
}

export async function updateTask(id: string, patch: Partial<ProjectTask>) {
  const clean = { ...patch };
  delete (clean as any).assignee;
  delete (clean as any).department_record;
  delete (clean as any).project;
  delete (clean as any).purchase_request;
  delete (clean as any).qms_capa;
  delete (clean as any).customer_complaint;
  const { error } = await sb.from("project_tasks").update(clean).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await sb.from("project_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchChecklist(taskId: string): Promise<TaskChecklistItem[]> {
  const { data, error } = await sb
    .from("project_task_checklists")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as TaskChecklistItem[];
}

export async function addChecklistItem(taskId: string, label: string, sortOrder: number) {
  const { error } = await sb
    .from("project_task_checklists")
    .insert({ task_id: taskId, label, sort_order: sortOrder });
  if (error) throw error;
}

export async function toggleChecklistItem(id: string, isDone: boolean) {
  const { error } = await sb.from("project_task_checklists").update({ is_done: isDone }).eq("id", id);
  if (error) throw error;
}

export async function removeChecklistItem(id: string) {
  const { error } = await sb.from("project_task_checklists").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchActivity(taskId: string): Promise<TaskActivity[]> {
  const { data, error } = await sb
    .from("project_task_activity")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaskActivity[];
}

export async function addComment(taskId: string, body: string) {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await sb
    .from("project_task_activity")
    .insert({ task_id: taskId, kind: "comment", body, actor_id: session.user?.id ?? null });
  if (error) throw error;
}
