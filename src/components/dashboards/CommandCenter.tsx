import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ChevronDown, Circle, FileText, LayoutDashboard, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fetchTasks, OPEN_TASK_STATUSES, updateTask, type ProjectTask } from "@/lib/tasks";
import { DEMO_WORK_ITEMS, type DemoPriority } from "@/lib/portal-demo";
import { departmentDefinitions, getPermittedDepartments, type DashboardDepartment } from "@/lib/department-dashboard";
import { groupWorkspaceTasks, taskDueLabel } from "@/lib/task-workspace";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const priorityVariant: Record<DemoPriority, "default" | "secondary" | "destructive"> = {
  Urgent: "destructive",
  High: "default",
  Medium: "secondary",
};

export function CommandCenter() {
  const { role, permissions } = useAuth();
  const tasks = useQuery({ queryKey: ["command-center-tasks"], queryFn: () => fetchTasks() });
  const availableDepartments = getPermittedDepartments(role, permissions);
  const [selectedDepartment, setSelectedDepartment] = useState<DashboardDepartment | "all">(role === "admin" ? "all" : availableDepartments[0]?.id ?? "all");
  const activeDepartment = selectedDepartment === "all" ? null : departmentDefinitions.find((department) => department.id === selectedDepartment);
  const departmentTaskKeys = activeDepartment ? {
    engineering: ["hardware", "firmware", "mechanical"], operations: ["procurement"], production: ["production"], hr: [], sales: ["executive"], quality: ["qa"],
  }[activeDepartment.id] : ["__all_departments__"];
  const liveTasks = (tasks.data ?? []).filter((task) => OPEN_TASK_STATUSES.includes(task.status));
  const useDemo = !tasks.isLoading && liveTasks.length === 0;
  const groupedTasks = groupWorkspaceTasks(liveTasks, departmentTaskKeys);

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="border-b pb-6">
      <div>
        <p className="text-sm font-medium text-primary">My day</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold">Department tasks</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Complete the tasks needing attention today, then review the department’s later work.</p></div><div className="w-full sm:w-60"><p className="mb-1.5 text-xs font-medium text-muted-foreground">Department</p><Select value={selectedDepartment} onValueChange={(value) => setSelectedDepartment(value as DashboardDepartment | "all")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{role === "admin" && <SelectItem value="all">All departments</SelectItem>}{availableDepartments.map((department) => <SelectItem key={department.id} value={department.id}>{department.label}</SelectItem>)}</SelectContent></Select></div></div>
      </div>
    </section>

    {tasks.isLoading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Loading your work pulse…</div> : <>
      {useDemo && <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><LayoutDashboard className="size-4 shrink-0 text-primary" /><span><strong className="font-medium text-foreground">Demo view:</strong> these examples show the intended daily workspace. They do not create, change, or share any operational record.</span></div>}
      <div className="max-w-4xl space-y-4">
        <TaskChecklist title="Today’s priority tasks" description="Urgent, high-priority, blocked, due today, or overdue." tasks={useDemo ? [] : groupedTasks.today} demoItems={useDemo ? DEMO_WORK_ITEMS.slice(0, 2) : undefined} />
        <TaskChecklist title="Pending for later" description="Open department work that does not need attention today." tasks={useDemo ? [] : groupedTasks.later} demoItems={useDemo ? DEMO_WORK_ITEMS.slice(2) : undefined} defaultOpen={false} />
      </div>
    </>}
  </div>;
}

function TaskChecklist({ title, description, tasks, demoItems, defaultOpen = true }: { title: string; description: string; tasks: ProjectTask[]; demoItems?: typeof DEMO_WORK_ITEMS; defaultOpen?: boolean }) {
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

  const total = demoItems?.length ?? tasks.length;
  return <Card>
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="size-4 text-primary" /> {title}<Badge variant="secondary">{total}</Badge></CardTitle><CardDescription>{description}</CardDescription></CardHeader>
    <CardContent className="space-y-1">
      {demoItems?.map((item) => <DemoTaskRow key={item.id} item={item} />)}
      {tasks.map((task) => <Collapsible key={task.id} open={openTaskId === task.id} onOpenChange={(isOpen) => setOpenTaskId(isOpen ? task.id : null)}><div className="border-b py-3 last:border-0"><div className="flex items-start gap-3"><Checkbox aria-label={`Mark ${task.title} complete`} onCheckedChange={(checked) => void completeTask(task, Boolean(checked))} /><CollapsibleTrigger className="min-w-0 flex-1 text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="size-3" />{task.assignee?.name ?? "Unassigned"}</span><span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{taskDueLabel(task.due_date)}</span><span>{task.status.replaceAll("_", " ")}</span>{task.project && <span>{task.project.code}</span>}{task.drive_node_id && <span className="inline-flex items-center gap-1"><FileText className="size-3" />Document linked</span>}</p></div><ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" /></div></CollapsibleTrigger></div><CollapsibleContent className="pl-7 pt-3"><TaskDetails task={task} /></CollapsibleContent></div></Collapsible>)}
      {total === 0 && <p className="py-5 text-sm text-muted-foreground">Nothing here right now.</p>}
      {!defaultOpen && total > 0 && <p className="pt-2 text-xs text-muted-foreground">Open any task to see its notes, progress, project, and owner.</p>}
    </CardContent>
  </Card>;
}

function TaskDetails({ task }: { task: ProjectTask }) {
  const navigate = useNavigate({ from: "/command-center" });
  const progress = task.estimated_hours ? Math.min(100, Math.round((Number(task.logged_hours ?? 0) / Number(task.estimated_hours)) * 100)) : null;
  return <div className="space-y-3 border-l pl-4 text-sm"><div className="flex flex-wrap gap-2"><Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "default" : "secondary"}>{task.priority}</Badge><Badge variant="outline">{task.status.replaceAll("_", " ")}</Badge></div>{task.description && <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p>}{progress !== null && <p className="text-muted-foreground">Progress: {progress}% · {task.logged_hours ?? 0} of {task.estimated_hours} hours logged</p>}<div className="flex flex-wrap gap-2">{task.project && <Button asChild size="sm" variant="outline"><Link to="/projects/$projectId" params={{ projectId: task.project.id }}>Project: {task.project.code}</Link></Button>}{task.assignee && <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/tasks", search: { assignee: task.assignee_id ?? undefined, task: undefined } })}>Assignee: {task.assignee.name}</Button>}{task.drive_node_id ? <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/drive", search: { node: task.drive_node_id ?? undefined } })}>Open document</Button> : <span className="inline-flex items-center px-2 text-xs text-muted-foreground">No document linked</span>}<Button size="sm" variant="ghost" onClick={() => void navigate({ to: "/tasks", search: { assignee: undefined, task: task.id } })}>Open task</Button></div></div>;
}

function DemoTaskRow({ item }: { item: (typeof DEMO_WORK_ITEMS)[number] }) {
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen}><div className="border-b py-3 last:border-0"><div className="flex items-start gap-3"><Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><CollapsibleTrigger className="min-w-0 flex-1 text-left"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.owner} · {item.due}</p></div><ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" /></div></CollapsibleTrigger></div><CollapsibleContent className="pl-7 pt-3"><div className="space-y-3 border-l pl-4 text-sm"><div className="flex gap-2"><Badge variant={priorityVariant[item.priority]}>{item.priority}</Badge><Badge variant="outline">{item.status}</Badge></div><p className="text-muted-foreground">{item.notes}</p><div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p><span className="font-medium text-foreground">Project:</span> {item.project}</p><p><span className="font-medium text-foreground">Progress:</span> {item.progress}%</p></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${item.progress}%` }} /></div></div></CollapsibleContent></div></Collapsible>;
}
