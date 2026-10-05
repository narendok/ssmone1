import { supabase } from "@/integrations/supabase/client";
import { lifecycleAcceptanceEnabled } from "./lifecycle-acceptance-gate";

export type LifecycleTemplateRead = {
  id: string;
  department_id: string;
  template_key: string;
  version: number;
  title: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  created_at: string;
  activated_at: string | null;
  retired_at: string | null;
};

export type LifecycleTemplateStageRead = {
  id: string;
  template_id: string;
  stage_key: string;
  title: string;
  description: string | null;
  sort_order: number;
  task_department: string;
  required: boolean;
};

export type LifecycleTemplateContentRead = {
  id: string;
  template_id: string;
  revision_number: number;
  content: string;
  content_sha256: string;
  created_at: string;
};

/** Caller-token/RLS read. Invoke only after the pending schema is accepted. */
export async function fetchLifecycleTemplateContent(templateId: string) {
  const { data, error } = await supabase
    .from("department_process_template_document_revisions" as never)
    .select("id,template_id,revision_number,content,content_sha256,created_at")
    .eq("template_id", templateId)
    .order("revision_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LifecycleTemplateContentRead[];
}

export async function fetchLifecycleTemplateSettings(departmentId: string) {
  const { data: templates, error: templatesError } = await supabase
    .from("department_process_templates")
    .select("id,department_id,template_key,version,title,description,status,created_at,activated_at,retired_at")
    .eq("department_id", departmentId)
    .order("template_key")
    .order("version", { ascending: false });
  if (templatesError) throw templatesError;
  const ids = (templates ?? []).map((template) => template.id);
  if (!ids.length) return { templates: [] as LifecycleTemplateRead[], stages: [] as LifecycleTemplateStageRead[] };
  const { data: stages, error: stagesError } = await supabase
    .from("department_process_template_stages")
    .select("id,template_id,stage_key,title,description,sort_order,task_department,required")
    .in("template_id", ids)
    .order("sort_order");
  if (stagesError) throw stagesError;
  return { templates: (templates ?? []) as LifecycleTemplateRead[], stages: (stages ?? []) as LifecycleTemplateStageRead[] };
}

export function isLifecycleTemplateActionAvailable() {
  return lifecycleAcceptanceEnabled(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_LIFECYCLE_DOCUMENT_ACCEPTANCE);
}

export function lifecycleTemplateMutationStatus() {
  return {
    available: isLifecycleTemplateActionAvailable(),
    message: "Protected draft content, cloning, activation, retirement, and stage actions are acceptance-pending and cannot change records from this register.",
  } as const;
}
