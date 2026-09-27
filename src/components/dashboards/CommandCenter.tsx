import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarDays, ChevronDown, Circle, CircleCheck, LayoutDashboard, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fetchTasks, OPEN_TASK_STATUSES, updateTask, type ProjectTask } from "@/lib/tasks";
import { DEMO_PROGRESS, DEMO_WORK_ITEMS, type DemoPriority } from "@/lib/portal-demo";

const priorityVariant: Record<DemoPriority, "default" | "secondary" | "destructive"> = {
  Urgent: "destructive",
  High: "default",
  Medium: "secondary",
};

export function CommandCenter() {
  const tasks = useQuery({ queryKey: ["command-center-tasks"], queryFn: () => fetchTasks() });
  const liveTasks = (tasks.data ?? []).filter((task) => OPEN_TASK_STATUSES.includes(task.status));
  const useDemo = !tasks.isLoading && liveTasks.length === 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = liveTasks.filter((task) => task.priority === "urgent" || task.priority === "high" || task.status === "blocked" || task.due_date === today).sort(sortTasks);
  const laterTasks = liveTasks.filter((task) => !todayTasks.some((todayTask) => todayTask.id === task.id)).sort(sortTasks);

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium text-primary">SSM One</p>
        <h1 className="mt-1 text-2xl font-semibold">Command Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">A short daily list for urgent work first, with later work kept out of the way until you need it.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to="/dashboards" search={{ department: undefined }}>Department dashboards <ArrowRight className="size-4" /></Link></Button>
        <Button asChild variant="outline"><Link to="/tasks">All tasks</Link></Button>
      </div>
    </section>

    {tasks.isLoading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Loading your work pulse…</div> : <>
      {useDemo && <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><LayoutDashboard className="size-4 shrink-0 text-primary" /><span><strong className="font-medium text-foreground">Demo view:</strong> these examples show the intended daily workspace. They do not create, change, or share any operational record.</span></div>}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <TaskChecklist title="Today’s priority tasks" description="Urgent, high-priority, blocked, or due today." tasks={useDemo ? [] : todayTasks} demoItems={useDemo ? DEMO_WORK_ITEMS.slice(0, 2) : undefined} />
          <TaskChecklist title="Pending for later" description="Open work that does not need attention today." tasks={useDemo ? [] : laterTasks} demoItems={useDemo ? DEMO_WORK_ITEMS.slice(2) : undefined} defaultOpen={false} />
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle>At a glance</CardTitle><CardDescription>Keep the daily view short. Department dashboards show the detailed operational picture.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b pb-3"><span className="text-muted-foreground">Today</span><span className="font-semibold">{useDemo ? 2 : todayTasks.length} tasks</span></div>
            <div className="flex items-center justify-between border-b pb-3"><span className="text-muted-foreground">Later</span><span className="font-semibold">{useDemo ? 2 : laterTasks.length} tasks</span></div>
            <Button asChild className="mt-2 w-full"><Link to="/dashboards">Open department dashboard <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>
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
      {tasks.map((task) => <Collapsible key={task.id} open={openTaskId === task.id} onOpenChange={(isOpen) => setOpenTaskId(isOpen ? task.id : null)}><div className="border-b py-3 last:border-0"><div className="flex items-start gap-3"><Checkbox aria-label={`Mark ${task.title} complete`} onCheckedChange={(checked) => void completeTask(task, Boolean(checked))} /><CollapsibleTrigger className="min-w-0 flex-1 text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="size-3" />{task.assignee?.name ?? "Unassigned"}</span><span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{task.due_date ?? "No due date"}</span></p></div><ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" /></div></CollapsibleTrigger></div><CollapsibleContent className="pl-7 pt-3"><TaskDetails task={task} /></CollapsibleContent></div></Collapsible>)}
      {total === 0 && <p className="py-5 text-sm text-muted-foreground">Nothing here right now.</p>}
      {!defaultOpen && total > 0 && <p className="pt-2 text-xs text-muted-foreground">Open any task to see its notes, progress, project, and owner.</p>}
    </CardContent>
  </Card>;
}

function TaskDetails({ task }: { task: ProjectTask }) {
  const progress = task.estimated_hours ? Math.min(100, Math.round((Number(task.logged_hours ?? 0) / Number(task.estimated_hours)) * 100)) : null;
  return <div className="space-y-3 border-l pl-4 text-sm"><div className="flex flex-wrap gap-2"><Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "default" : "secondary"}>{task.priority}</Badge><Badge variant="outline">{task.status.replaceAll("_", " ")}</Badge></div>{task.description && <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p>}{progress !== null && <p className="text-muted-foreground">Progress: {progress}% · {task.logged_hours ?? 0} of {task.estimated_hours} hours logged</p>}<div className="flex flex-wrap gap-2">{task.project && <Button asChild size="sm" variant="outline"><Link to="/projects/$projectId" params={{ projectId: task.project.id }}>Project: {task.project.code}</Link></Button>}{task.assignee && <Button asChild size="sm" variant="outline"><Link to="/tasks">Assigned to: {task.assignee.name}</Link></Button>}<Button asChild size="sm" variant="ghost"><Link to="/tasks">Open task</Link></Button></div></div>;
}

function DemoTaskRow({ item }: { item: (typeof DEMO_WORK_ITEMS)[number] }) {
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen}><div className="border-b py-3 last:border-0"><div className="flex items-start gap-3"><Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><CollapsibleTrigger className="min-w-0 flex-1 text-left"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.owner} · {item.due}</p></div><ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" /></div></CollapsibleTrigger></div><CollapsibleContent className="pl-7 pt-3"><div className="space-y-3 border-l pl-4 text-sm"><div className="flex gap-2"><Badge variant={priorityVariant[item.priority]}>{item.priority}</Badge><Badge variant="outline">{item.status}</Badge></div><p className="text-muted-foreground">{item.area} · Demo task details and progress appear here when this task is expanded.</p></div></CollapsibleContent></div></Collapsible>;
}

function sortTasks(a: ProjectTask, b: ProjectTask) {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return priorityOrder[a.priority] - priorityOrder[b.priority] || (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31");
}