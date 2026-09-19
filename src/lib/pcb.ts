import { supabase } from "@/integrations/supabase/client";

export const PCB_STATUSES = [
  "received",
  "in_progress",
  "waiting_parts",
  "repaired",
  "failed",
  "scrapped",
  "returned",
] as const;
export type PcbStatus = (typeof PCB_STATUSES)[number];

export const PCB_STATUS_LABEL: Record<PcbStatus, string> = {
  received: "Received",
  in_progress: "In Progress",
  waiting_parts: "Waiting on Parts",
  repaired: "Repaired",
  failed: "Failed",
  scrapped: "Scrapped",
  returned: "Returned",
};

export const PCB_STATUS_COLOR: Record<PcbStatus, string> = {
  received: "bg-slate-500",
  in_progress: "bg-blue-500",
  waiting_parts: "bg-amber-500",
  repaired: "bg-emerald-500",
  failed: "bg-rose-500",
  scrapped: "bg-zinc-500",
  returned: "bg-violet-500",
};

export const OPEN_STATUSES: PcbStatus[] = ["received", "in_progress", "waiting_parts"];

export const ROOT_CAUSES = [
  { value: "solder_joint", label: "Solder Joint" },
  { value: "component_failure", label: "Component Failure" },
  { value: "esd", label: "ESD" },
  { value: "thermal", label: "Thermal" },
  { value: "vibration", label: "Vibration" },
  { value: "design_defect", label: "Design Defect" },
  { value: "other", label: "Other" },
] as const;
export type RootCause = (typeof ROOT_CAUSES)[number]["value"];

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["value"];

export interface PcbTask {
  id: string;
  board_name: string;
  issue: string;
  assignee_id: string | null;
  project_id: string | null;
  priority: Priority;
  status: PcbStatus;
  root_cause: RootCause | null;
  root_cause_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; name: string } | null;
  project?: { id: string; name: string; code: string; color: string } | null;
}

export interface PcbTaskHistory {
  id: string;
  task_id: string;
  from_status: PcbStatus | null;
  to_status: PcbStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface PcbTaskNote {
  id: string;
  task_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
}

export interface PcbTaskPhoto {
  id: string;
  task_id: string;
  storage_path: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const sb = supabase as any;

export async function fetchPcbTasks(): Promise<PcbTask[]> {
  const { data, error } = await sb
    .from("pcb_tasks")
    .select("*, assignee:rd_members(id,name), project:projects(id,name,code,color)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PcbTask[];
}

export async function fetchOpenPcbTaskCount(): Promise<number> {
  const { count, error } = await sb
    .from("pcb_tasks")
    .select("*", { count: "exact", head: true })
    .in("status", OPEN_STATUSES);
  if (error) return 0;
  return count ?? 0;
}

export async function getPhotoSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("pcb-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
