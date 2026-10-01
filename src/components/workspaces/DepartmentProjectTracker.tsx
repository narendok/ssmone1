import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, ListChecks, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchDepartmentProjects } from "@/lib/projects";
import { fetchTasks, OPEN_TASK_STATUSES } from "@/lib/tasks";
import { fetchChildren } from "@/lib/drive";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function DepartmentProjectTracker({ departmentId }: { departmentId: string }) {
  const { role } = useAuth();
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const projects = useQuery({ queryKey: ["department_projects", departmentId], queryFn: () => fetchDepartmentProjects(departmentId) });
  const tasks = useQuery({ queryKey: ["project_tasks"], queryFn: () => fetchTasks() });
  return <section className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Department projects</h2><p className="mt-1 text-sm text-muted-foreground">Project folders, linked work, and the next actions in this department.</p></div>{role === "admin" && <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1 size-4" /> New project</Button>}</div>{projects.isLoading ? <Card className="p-5 text-sm text-muted-foreground">Loading projects…</Card> : !projects.data?.length ? <Card className="p-5 text-sm text-muted-foreground">No department projects are available.</Card> : <div className="grid gap-3 lg:grid-cols-2">{projects.data.map((project) => <ProjectTrackerCard key={project.id} project={project} tasks={(tasks.data ?? []).filter((task) => task.project_id === project.id)} />)}</div>}<ProjectDialog open={creating} onOpenChange={setCreating} defaultDepartmentId={departmentId} onSaved={() => { void client.invalidateQueries({ queryKey: ["department_projects", departmentId] }); void client.invalidateQueries({ queryKey: ["projects"] }); }} /></section>;
}

function ProjectTrackerCard({ project, tasks }: { project: Awaited<ReturnType<typeof fetchDepartmentProjects>>[number]; tasks: Awaited<ReturnType<typeof fetchTasks>> }) {
  const docs = useQuery({ queryKey: ["project_tracker_documents", project.id], queryFn: () => fetchChildren(null, project.id) });
  const openTasks = tasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status));
  const next = openTasks.slice().sort((a, b) => (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"))[0];
  return <Card><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{project.name}</CardTitle><CardDescription className="mt-1 font-mono">{project.code}</CardDescription></div><Badge variant="outline">{project.drive_project_class.toLowerCase()}</Badge></div></CardHeader><CardContent className="grid gap-3 text-sm"><div className="grid grid-cols-2 gap-3"><div className="border p-3"><div className="flex items-center gap-2 text-muted-foreground"><FileText className="size-4" /> Folder items</div><p className="mt-1 text-lg font-semibold">{docs.data?.length ?? 0}</p></div><div className="border p-3"><div className="flex items-center gap-2 text-muted-foreground"><ListChecks className="size-4" /> Open tasks</div><p className="mt-1 text-lg font-semibold">{openTasks.length}</p></div></div><div className="border p-3"><p className="text-xs font-medium text-muted-foreground">NEXT ACTION</p><p className="mt-1 font-medium">{next?.title ?? "No pending action"}</p>{next?.due_date && <p className="mt-1 text-xs text-muted-foreground">Due {new Date(next.due_date).toLocaleDateString()}</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" asChild><Link to="/projects/$projectId" params={{ projectId: project.id }}><FolderKanban className="mr-1 size-4" /> Project</Link></Button><Button size="sm" variant="outline" asChild><Link to="/drive" search={{ department: project.department_id ?? undefined }}><FileText className="mr-1 size-4" /> Drive</Link></Button></div></CardContent></Card>;
}