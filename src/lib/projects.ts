import { supabase } from "@/integrations/supabase/client";

export interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
  status: "active" | "archived";
  revision: string | null;
  design_link: string | null;
  project_type: string;
  department_id: string | null;
  drive_project_class: "INTERNAL" | "CLIENT";
  customer_id: string | null;
  opportunity_id: string | null;
  requirement_baseline_id: string | null;
  project_manager_employee_id: string | null;
  engineering_lead_employee_id: string | null;
  project_stage: string;
  health_status: string;
  priority: string;
  planned_start_date: string | null;
  target_sop_date: string | null;
  prototype_quantity: number | null;
  annual_volume: number | null;
  project_drive_node_id: string | null;
  completion_notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const sb = supabase as any;

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await sb.from("projects").select("*").order("status").order("name");
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function fetchComponentProjectIds(componentId: string): Promise<string[]> {
  const { data, error } = await sb
    .from("component_projects")
    .select("project_id")
    .eq("component_id", componentId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.project_id as string);
}

export async function syncComponentProjects(componentId: string, projectIds: string[]) {
  const { data: existing } = await sb
    .from("component_projects")
    .select("project_id")
    .eq("component_id", componentId);
  const have = new Set<string>((existing ?? []).map((r: any) => r.project_id));
  const want = new Set(projectIds);
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));
  if (toAdd.length) {
    await sb
      .from("component_projects")
      .insert(toAdd.map((project_id) => ({ component_id: componentId, project_id })));
  }
  if (toRemove.length) {
    await sb
      .from("component_projects")
      .delete()
      .eq("component_id", componentId)
      .in("project_id", toRemove);
  }
}

export async function fetchAllComponentProjectMap(): Promise<Map<string, Project[]>> {
  const { data, error } = await sb
    .from("component_projects")
    .select("component_id, project:projects(*)");
  if (error) throw error;
  const map = new Map<string, Project[]>();
  for (const row of (data ?? []) as any[]) {
    if (!row.project) continue;
    const arr = map.get(row.component_id) ?? [];
    arr.push(row.project as Project);
    map.set(row.component_id, arr);
  }
  return map;
}
