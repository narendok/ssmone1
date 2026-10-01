import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const sb = supabase as any;
export type WorkspacePreference = Database["public"]["Tables"]["department_workspace_preferences"]["Row"];

export async function fetchWorkspacePreference(departmentId: string): Promise<WorkspacePreference | null> {
  const { data, error } = await sb.from("department_workspace_preferences").select("*").eq("department_id", departmentId).maybeSingle();
  if (error) throw error;
  return data as WorkspacePreference | null;
}

export async function saveWorkspacePreference(departmentId: string, patch: Partial<Pick<WorkspacePreference, "drive_default_filter" | "show_dashboard_documents" | "project_tracker_view" | "lead_digest_enabled">>) {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) throw new Error("Sign in required");
  const { error } = await sb.from("department_workspace_preferences").upsert({ user_id: userResult.user.id, department_id: departmentId, ...patch }, { onConflict: "user_id,department_id" });
  if (error) throw error;
}