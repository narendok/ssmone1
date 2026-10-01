import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DriveBrowser } from "@/components/drive/DriveBrowser";
import { FirmwareVault } from "@/components/drive/FirmwareVault";
import { CadVault } from "@/components/drive/CadVault";
import { ProjectBomsTab } from "@/components/projects/ProjectBomsTab";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { ProjectTeamTab } from "@/components/projects/ProjectTeamTab";
import { ProjectOperationalTab } from "@/components/projects/ProjectOperationalTabs";
import { SharedProductLifecycle } from "@/components/projects/SharedProductLifecycle";
import type { Project } from "@/lib/projects";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { useAuth } from "@/hooks/useAuth";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project workspace — PartsBench" },
      { name: "description", content: "Files, firmware builds, CAD models and tasks for this hardware project." },
      { property: "og:title", content: "Project workspace — PartsBench" },
      {
        property: "og:description",
        content: "Files, firmware builds, CAD models and tasks for this hardware project.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await sb.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
  });

  const { data: componentCount = 0 } = useQuery({
    queryKey: ["project_component_count", projectId],
    queryFn: async () => {
      const { count } = await sb
        .from("component_projects")
        .select("component_id", { count: "exact", head: true })
        .eq("project_id", projectId);
      return count ?? 0;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!project) return <Card className="p-8 text-center text-muted-foreground">Project not found.</Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <span className="h-8 w-2 rounded-sm" style={{ background: project.color }} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{project.code}</span>
            <h1 className="text-2xl font-semibold truncate">{project.name}</h1>
            {project.status === "archived" && <Badge variant="secondary">archived</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {project.revision ? `Revision ${project.revision} · ` : ""}
            {componentCount} tagged component{componentCount === 1 ? "" : "s"}
          </p>
        </div>
          {role === "admin" && <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit project</Button>}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="engineering">Engineering</TabsTrigger>
          <TabsTrigger value="bom">BOM</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="firmware">Firmware</TabsTrigger>
          <TabsTrigger value="mechanical">Mechanical</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-3 lg:grid-cols-3">
          <Card className="p-4 space-y-2 text-sm lg:col-span-2">
            <Row label="Code" value={project.code} />
            <Row label="Project type" value={project.project_type.replaceAll("_", " ")} />
            <Row label="Project stage" value={project.project_stage.replaceAll("_", " ")} />
            <Row label="Health" value={project.health_status} />
            <Row label="Priority" value={project.priority} />
            <Row label="Revision" value={project.revision ?? "—"} />
            <Row label="Target SOP" value={project.target_sop_date ?? "—"} />
            <Row label="Tagged components" value={String(componentCount)} />
            <div className="flex gap-2">
              <span className="w-40 text-muted-foreground">Design link</span>
              {project.design_link ? (
                <a
                  href={project.design_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> open
                </a>
              ) : (
                <span>—</span>
              )}
            </div>
          </Card>
          <Card className="p-4 space-y-3"><div><p className="text-sm font-medium">Delivery snapshot</p><p className="text-sm text-muted-foreground">Use the Delivery and Engineering tabs to control gates, issues, changes and release records.</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{project.status}</Badge><Badge variant="secondary">{project.health_status}</Badge></div></Card>
          </div>
        </TabsContent>

        <TabsContent value="lifecycle" className="pt-4"><SharedProductLifecycle project={project} /></TabsContent>

        <TabsContent value="team" className="pt-4"><ProjectTeamTab projectId={projectId} /></TabsContent>
        <TabsContent value="inputs" className="pt-4 space-y-8"><ProjectOperationalTab projectId={projectId} kind="design" /><ProjectOperationalTab projectId={projectId} kind="research" /></TabsContent>
        <TabsContent value="delivery" className="pt-4 space-y-8"><ProjectOperationalTab projectId={projectId} kind="gates" /><ProjectOperationalTab projectId={projectId} kind="issues" /><ProjectOperationalTab projectId={projectId} kind="changes" /></TabsContent>
        <TabsContent value="engineering" className="pt-4"><ProjectOperationalTab projectId={projectId} kind="registers" /></TabsContent>

        <TabsContent value="bom" className="pt-4">
          <ProjectBomsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="files" className="pt-4">
          <DriveBrowser projectId={projectId} />
        </TabsContent>

        <TabsContent value="firmware" className="pt-4">
          <FirmwareVault projectId={projectId} />
        </TabsContent>

        <TabsContent value="mechanical" className="pt-4">
          <CadVault projectId={projectId} />
        </TabsContent>

        <TabsContent value="tasks" className="pt-4">
          <TaskBoard projectId={projectId} compact />
        </TabsContent>
      </Tabs>
      <ProjectDialog open={editing} onOpenChange={setEditing} editing={project} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ["project", projectId] }); void queryClient.invalidateQueries({ queryKey: ["projects"] }); }} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-40 text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
