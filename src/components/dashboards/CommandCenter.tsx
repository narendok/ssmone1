import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FolderKanban, LayoutDashboard, ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchTasks, OPEN_TASK_STATUSES } from "@/lib/tasks";
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
  const blocked = liveTasks.filter((task) => task.status === "blocked").length;
  const overdue = liveTasks.filter((task) => Boolean(task.due_date && task.due_date < today)).length;
  const priority = liveTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium text-primary">SSM One</p>
        <h1 className="mt-1 text-2xl font-semibold">Command Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">A focused daily view of work that needs a decision, owner, or follow-up.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/dashboards" search={{ department: undefined }}>Open department center <ArrowRight className="size-4" /></Link></Button>
        <Button asChild variant="outline"><Link to="/tasks">Open work board</Link></Button>
      </div>
    </section>

    {tasks.isLoading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Loading your work pulse…</div> : <>
      {useDemo && <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><LayoutDashboard className="size-4 shrink-0 text-primary" /><span><strong className="font-medium text-foreground">Demo view:</strong> these examples show the intended daily workspace. They do not create, change, or share any operational record.</span></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Pulse label="Open work" value={useDemo ? 12 : liveTasks.length} detail="Across accessible departments" icon={ListChecks} />
        <Pulse label="Today’s priorities" value={useDemo ? 4 : priority} detail="High or urgent work" icon={AlertTriangle} tone="attention" />
        <Pulse label="Needs a decision" value={useDemo ? 3 : blocked} detail="Blocked work and approvals" icon={ClipboardCheck} tone="critical" />
        <Pulse label="Past due" value={useDemo ? 2 : overdue} detail="Open work needing recovery" icon={CheckCircle2} tone="attention" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader><CardTitle>Priority queue</CardTitle><CardDescription>{useDemo ? "Example daily queue for a lean startup team." : "Live work already visible to your account."}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {useDemo ? DEMO_WORK_ITEMS.map((item) => <div key={item.id} className="flex flex-col gap-3 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.area} · {item.owner} · {item.due}</p></div><div className="flex gap-2"><Badge variant={priorityVariant[item.priority]}>{item.priority}</Badge><Badge variant="outline">{item.status}</Badge></div></div>) : liveTasks.slice(0, 6).map((task) => <Link key={task.id} to="/tasks" className="block border-b pb-3 last:border-0 last:pb-0 hover:text-primary"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.assignee?.name ?? "Unassigned"}{task.due_date ? ` · Due ${task.due_date}` : " · No due date"}</p></Link>)}
            <Button asChild variant="outline" className="w-full"><Link to="/tasks">Review all work <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FolderKanban className="size-5 text-primary" /> Delivery progress</CardTitle><CardDescription>Project, purchasing, and build progress in one place.</CardDescription></CardHeader>
          <CardContent className="space-y-5">{DEMO_PROGRESS.map((item) => <div key={item.label}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.area} · {item.detail}</p></div><span className="text-sm font-semibold">{item.value}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${item.value}%` }} /></div></div>)}<Button asChild variant="outline" className="w-full"><Link to="/projects">Open project workspaces <ArrowRight className="size-4" /></Link></Button></CardContent>
        </Card>
      </div>
    </>}
  </div>;
}

function Pulse({ label, value, detail, icon: Icon, tone }: { label: string; value: number; detail: string; icon: typeof ListChecks; tone?: "attention" | "critical" }) {
  return <Card className={tone === "critical" ? "border-l-4 border-destructive" : tone === "attention" ? "border-l-4 border-warning" : "border-l-4 border-primary"}><CardContent className="p-4"><Icon className="size-4 text-primary" /><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}