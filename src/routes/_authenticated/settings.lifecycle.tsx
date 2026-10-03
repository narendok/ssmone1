import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, FilePenLine, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsNav } from "@/components/SettingsNav";
import { LifecycleTemplateEditor } from "@/components/lifecycle/LifecycleTemplateEditor";
import { fetchCanonicalDepartments } from "@/lib/tasks";
import { retireLifecycleTemplate } from "@/lib/lifecycle-actions.functions";
import { fetchLifecycleTemplateSettings, lifecycleTemplateMutationStatus, type LifecycleTemplateRead, type LifecycleTemplateStageRead } from "@/lib/lifecycle-template-settings";
import { readWorkspaceDepartmentId, WORKSPACE_CONTEXT_EVENT } from "@/lib/workspace-context";

export const Route = createFileRoute("/_authenticated/settings/lifecycle")({
  head: () => ({ meta: [
    { title: "Lifecycle Templates — SSM One" },
    { name: "description", content: "Department lifecycle template settings and version history." },
    { property: "og:title", content: "Lifecycle Templates — SSM One" },
    { property: "og:description", content: "Department lifecycle template settings and version history." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LifecycleTemplateSettings,
});

function LifecycleTemplateSettings() {
  const [departmentId, setDepartmentId] = useState("");
  const [workspaceDepartmentId, setWorkspaceDepartmentId] = useState<string | null>(() => readWorkspaceDepartmentId());
  const [editing, setEditing] = useState<LifecycleTemplateRead | null>(null);
  useEffect(() => {
    const syncWorkspace = () => setWorkspaceDepartmentId(readWorkspaceDepartmentId());
    window.addEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspace);
    window.addEventListener("storage", syncWorkspace);
    return () => { window.removeEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspace); window.removeEventListener("storage", syncWorkspace); };
  }, []);
  const { data: departments = [] } = useQuery({ queryKey: ["active-departments"], queryFn: fetchCanonicalDepartments });
  const selectedId = departmentId || workspaceDepartmentId || departments[0]?.id || "";
  useEffect(() => { setEditing(null); }, [selectedId]);
  const { data, isLoading, isError } = useQuery({ queryKey: ["lifecycle-template-settings", selectedId], queryFn: () => fetchLifecycleTemplateSettings(selectedId), enabled: Boolean(selectedId) });
  const stagesByTemplate = useMemo(() => {
    const grouped = new Map<string, LifecycleTemplateStageRead[]>();
    for (const stage of data?.stages ?? []) grouped.set(stage.template_id, [...(grouped.get(stage.template_id) ?? []), stage]);
    return grouped;
  }, [data]);
  const mutationStatus = lifecycleTemplateMutationStatus();
  const queryClient = useQueryClient();
  const retire = useServerFn(retireLifecycleTemplate);
  const retirement = useMutation({
    mutationFn: async (template: LifecycleTemplateRead) => {
      if (!mutationStatus.available || template.status !== "ACTIVE") throw new Error("Template retirement is unavailable.");
      return retire({ data: { templateId: template.id } });
    },
    onSuccess: async () => {
      toast.success("Template retired; existing documents remain preserved");
      await queryClient.invalidateQueries({ queryKey: ["lifecycle-template-settings", selectedId] });
    },
    onError: (error) => toast.error(error.message),
  });

  return <div className="mx-auto max-w-5xl space-y-5">
    <SettingsNav />
    <div>
      <h1 className="text-2xl font-semibold">Lifecycle template register</h1>
      <p className="mt-1 text-sm text-muted-foreground">Department templates, immutable content revisions and governed stages.</p>
    </div>
    {!mutationStatus.available && <Card className="border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex gap-3"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><div>
        <p className="text-sm font-medium">Prepare and preview; backend saving is unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">Draft bodies can be prepared locally. Saving, activation and retirement require protected backend acceptance.</p>
      </div></div>
    </Card>}
    <div className="flex flex-wrap gap-2">{departments.map((department) =>
      <Button key={department.id} size="sm" variant={department.id === selectedId ? "default" : "outline"} onClick={() => setDepartmentId(department.id)}>{department.name}</Button>
    )}</div>
    {isLoading ? <Card className="p-8 text-center text-muted-foreground">Loading template register…</Card>
      : isError ? <Card className="p-8 text-center text-destructive">Templates could not be read with your current department access.</Card>
        : !data?.templates.length ? <Card className="p-8 text-center text-muted-foreground">No templates are available for this department.</Card>
          : <div className="space-y-3">{data.templates.map((template) => <Card key={template.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{template.title}</h2><Badge variant="outline">{template.status}</Badge><Badge variant="secondary">v{template.version}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{template.template_key} · Registered {new Date(template.created_at).toLocaleDateString()}</p>
                {template.description && <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!mutationStatus.available && template.status !== "DRAFT"} onClick={() => setEditing(template)}>
                  <FilePenLine className="mr-1 h-3.5 w-3.5" />{template.status === "DRAFT" ? "Prepare body" : "View body"}
                </Button>
                {template.status === "ACTIVE" && <Button size="sm" variant="outline" disabled={!mutationStatus.available || retirement.isPending} onClick={() => retirement.mutate(template)}><Archive className="mr-1 h-3.5 w-3.5" />Retire</Button>}
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Governed stages</p>
              {!(stagesByTemplate.get(template.id) ?? []).length ? <p className="text-sm text-muted-foreground">No stages are available for this template.</p>
                : stagesByTemplate.get(template.id)?.map((stage) => <div key={stage.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{stage.sort_order}</span><span className="font-medium">{stage.title}</span><span className="text-xs text-muted-foreground">{stage.stage_key} · {stage.task_department}{stage.required ? " · required" : " · optional"}</span>
                </div>)}
            </div>
          </Card>)}</div>}
    {editing && <LifecycleTemplateEditor key={editing.id} template={editing} departmentName={departments.find((department) => department.id === editing.department_id)?.name ?? "Example department"} onClose={() => setEditing(null)} />}
  </div>;
}
