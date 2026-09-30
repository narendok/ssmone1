import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ChevronDown, FileText, Layers3, Loader2, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fetchCanonicalDepartments, fetchTasks, OPEN_TASK_STATUSES, updateTask, type CanonicalDepartment, type ProjectTask } from "@/lib/tasks";
import { departmentWorkTarget } from "@/lib/department-workspace";
import { groupWorkspaceTasks, taskDueLabel } from "@/lib/task-workspace";
import { workspaceForDepartment } from "@/lib/department-workspace-navigation";
import { setWorkspaceDepartmentId } from "@/lib/workspace-context";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CommandCenter() {
  const { role, permissions } = useAuth();
  const tasks = useQuery({ queryKey: ["command-center-tasks"], queryFn: () => fetchTasks() });
  const departments = useQuery({ queryKey: ["active-departments"], queryFn: fetchCanonicalDepartments });
  const isAdmin = role === "admin";
  const availableDepartments = departments.data ?? [];
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(isAdmin ? null : availableDepartments[0]?.id ?? null);
  const liveTasks = (tasks.data ?? []).filter((task) => OPEN_TASK_STATUSES.includes(task.status));
  const filteredTasks = selectedDepartmentId ? liveTasks.filter((task) => task.department_id === selectedDepartmentId) : liveTasks;
  const groupedTasks = groupWorkspaceTasks(filteredTasks, []);

  const selectedDepartment = availableDepartments.find((department) => department.id === selectedDepartmentId) ?? null;
  const workspaceLabel = selectedDepartment?.name ?? "All departments";
  const workspace = workspaceForDepartment(selectedDepartment);

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="border-b pb-6">
      <div>
        <p className="text-sm font-medium text-primary">{isAdmin ? "Platform oversight" : "Department workspace"}</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold">{workspaceLabel} tasks</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{selectedDepartment && workspace ? workspace.summary : isAdmin ? "Select a department to focus its approved work, or keep every department visible for a complete task picture." : "Complete the tasks needing attention today, then review the department’s later work."}</p></div><DepartmentSelector departments={availableDepartments} isAdmin={isAdmin} value={selectedDepartmentId} onChange={(departmentId) => { setSelectedDepartmentId(departmentId); setWorkspaceDepartmentId(departmentId); }} /></div>
      </div>
    </section>

    {selectedDepartment && workspace && <section className="border-y py-5"><div className="mb-3 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">{workspace.label} work</h2><p className="mt-1 text-sm text-muted-foreground">Only the areas relevant to this workspace are shown here. Access remains enforced separately.</p></div><Button asChild variant="outline" size="sm"><Link to="/dashboards" search={{ department: workspace.id }}>Open lead workspace</Link></Button></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{workspace.items.map((item) => <Button key={item.to + item.label} asChild variant="outline" className="h-auto justify-start gap-3 px-3 py-3 text-left"><Link to={item.to}><item.icon className="size-4 shrink-0 text-primary" /><span className="min-w-0"><span className="block text-sm font-medium">{item.label}</span></span></Link></Button>)}</div></section>}
    {tasks.isLoading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Loading your work pulse…</div> : tasks.isError ? <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Tasks could not be loaded. Your access has not been changed; refresh or try again later.</div> : <>
      <div className="max-w-4xl space-y-4">
        <TaskChecklist title={selectedDepartment ? "Today’s priority tasks" : "Today’s priorities across departments"} description="Urgent, high-priority, blocked, due today, or overdue." tasks={groupedTasks.today} />
        <TaskChecklist title={selectedDepartment ? "Pending for later" : "Pending across departments"} description="Open work that does not need attention today." tasks={groupedTasks.later} defaultOpen={false} />
      </div>
    </>}
  </div>;
}

function DepartmentSelector({ departments, isAdmin, value, onChange }: { departments: CanonicalDepartment[]; isAdmin: boolean; value: string | null; onChange: (departmentId: string | null) => void }) {
  const selectedDepartment = departments.find((department) => department.id === value) ?? null;
  const workTarget = selectedDepartment ? departmentWorkTarget(selectedDepartment) : "/tasks";
  const label = isAdmin ? "Workspace view" : "Department";
  return <div className="w-full sm:w-72"><p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p><div className="flex gap-2"><Select value={value ?? "all"} onValueChange={(nextValue) => onChange(nextValue === "all" ? null : nextValue)}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent>{isAdmin && <SelectItem value="all"><span className="flex items-center gap-2"><Layers3 className="size-3.5" />All departments</span></SelectItem>}{departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}{department.aliases.length ? ` · ${department.aliases.join(", ")}` : ""}</SelectItem>)}</SelectContent></Select>{selectedDepartment && <Button asChild size="icon" variant="outline" title={`Open ${selectedDepartment.name} lead workspace`} aria-label={`Open ${selectedDepartment.name} lead workspace`}><Link to={workTarget}><Wrench className="size-4" /></Link></Button>}</div>{isAdmin && <p className="mt-1.5 text-xs text-muted-foreground">Changes your oversight view only; permissions remain administrator-controlled.</p>}</div>;
}

function TaskChecklist({ title, description, tasks, defaultOpen = true }: { title: string; description: string; tasks: ProjectTask[]; defaultOpen?: boolean }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const completeTask = async (task: ProjectTask, checked: boolean) => {
    if (!checked) return;
    try {
      await updateTask(task.id, { status: "done" });
      await queryClient.invalidateQueries({ queryKey: ["command-center-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["project_tasks"] });
      toast.success("Task marked complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the task");
    }
  };

  const total = tasks.length;
  return <Card>
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="size-4 text-primary" /> {title}<Badge variant="secondary">{total}</Badge></CardTitle><CardDescription>{description}</CardDescription></CardHeader>
    <CardContent className="space-y-1">
       {tasks.map((task) => <Collapsible key={task.id} open={openTaskId === task.id} onOpenChange={(isOpen) => setOpenTaskId(isOpen ? task.id : null)}><div className="border-b py-3 last:border-0"><div className="flex items-start gap-3"><Checkbox aria-label={`Mark ${task.title} complete`} onCheckedChange={(checked) => void completeTask(task, Boolean(checked))} /><CollapsibleTrigger className="min-w-0 flex-1 text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="size-3" />{task.assignee?.name ?? "Unassigned"}</span><span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{taskDueLabel(task.due_date)}</span><StatusBadge status={task.status} />{task.department_record && <span>{task.department_record.code ?? task.department_record.name}</span>}{task.project && <span>{task.project.code}</span>}{task.drive_node_id && <span className="inline-flex items-center gap-1"><FileText className="size-3" />Document linked</span>}</p></div><ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" /></div></CollapsibleTrigger></div><CollapsibleContent className="pl-7 pt-3"><TaskDetails task={task} /></CollapsibleContent></div></Collapsible>)}
       {total === 0 && <p className="py-5 text-sm text-muted-foreground">No open tasks are visible in this workspace view.</p>}
      {!defaultOpen && total > 0 && <p className="pt-2 text-xs text-muted-foreground">Open any task to see its notes, progress, project, and owner.</p>}
    </CardContent>
  </Card>;
}

function TaskDetails({ task }: { task: ProjectTask }) {
  const navigate = useNavigate({ from: "/command-center" });
  const progress = task.estimated_hours ? Math.min(100, Math.round((Number(task.logged_hours ?? 0) / Number(task.estimated_hours)) * 100)) : null;
  return <div className="space-y-3 border-l pl-4 text-sm"><div className="flex flex-wrap gap-2"><Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "default" : "secondary"}>{task.priority}</Badge><Badge variant="outline">{task.status.replaceAll("_", " ")}</Badge></div>{task.description && <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p>}{progress !== null && <p className="text-muted-foreground">Progress: {progress}% · {task.logged_hours ?? 0} of {task.estimated_hours} hours logged</p>}<div className="flex flex-wrap gap-2">{task.project && <Button asChild size="sm" variant="outline"><Link to="/projects/$projectId" params={{ projectId: task.project.id }}>Project: {task.project.code}</Link></Button>}{task.assignee && <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/tasks", search: { assignee: task.assignee_id ?? undefined, task: undefined } })}>Assignee: {task.assignee.name}</Button>}{task.drive_node_id ? <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/drive", search: { node: task.drive_node_id ?? undefined } })}>Open document</Button> : <span className="inline-flex items-center px-2 text-xs text-muted-foreground">No document linked</span>}<Button size="sm" variant="ghost" onClick={() => void navigate({ to: "/tasks", search: { assignee: undefined, task: task.id } })}>Open task</Button></div></div>;
}

function StatusBadge({ status }: { status: ProjectTask["status"] }) {
  const variant = status === "blocked" ? "destructive" : status === "in_progress" ? "secondary" : "outline";
  return <Badge variant={variant} className="h-5 px-1.5 text-[10px]">{status.replaceAll("_", " ")}</Badge>;
}

