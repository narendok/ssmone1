import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, ExternalLink, FileText, FolderOpen, ListChecks, Loader2, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { departmentTaskFocus, tasksForDepartment, type DashboardDepartment } from "@/lib/department-dashboard";
import { OPEN_TASK_STATUSES, fetchTasks } from "@/lib/tasks";
import { Badge } from "@/components/ui/badge";

const sb = supabase as any;

type QueueItem = {
  id: string;
  label: string;
  detail: string;
  status: string;
  to: string;
};

function useDepartmentQueues(department: DashboardDepartment) {
  const tasks = useQuery({
    queryKey: ["department_workspace_tasks", department],
    queryFn: () => fetchTasks(),
  });
  const purchaseRequests = useQuery({
    queryKey: ["department_workspace_purchase_requests", department],
    queryFn: async () => {
      const { data, error } = await sb
        .from("purchase_requests")
        .select("id,request_number,status,urgency,required_date,updated_at")
        .in("status", ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PENDING_APPROVAL"])
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
    enabled: department === "operations",
  });
  const gates = useQuery({
    queryKey: ["department_workspace_gates", department],
    queryFn: async () => {
      const { data, error } = await sb
        .from("project_stage_gates")
        .select("id,gate_code,title,status,target_date,project_id")
        .not("status", "in", "(COMPLETED,CLOSED,APPROVED)")
        .order("target_date", { ascending: true, nullsFirst: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
    enabled: department === "engineering" || department === "production" || department === "quality",
  });

  const departmentTasks = useMemo(() => {
    return tasksForDepartment(tasks.data ?? [], department).filter((task) => OPEN_TASK_STATUSES.includes(task.status));
  }, [department, tasks.data]);

  const approvals = useMemo<QueueItem[]>(() => [
    ...(purchaseRequests.data ?? []).map((request: any) => ({
      id: `purchase-${request.id}`,
      label: request.request_number,
      detail: request.required_date ? `Required ${request.required_date}` : "Purchase review required",
      status: request.status,
      to: "/procurement/requests",
    })),
    ...(gates.data ?? []).map((gate: any) => ({
      id: `gate-${gate.id}`,
      label: `${gate.gate_code} · ${gate.title}`,
      detail: gate.target_date ? `Target ${gate.target_date}` : "Development-gate review required",
      status: gate.status,
      to: `/projects/${gate.project_id}`,
    })),
  ], [gates.data, purchaseRequests.data]);

  return {
    tasks: departmentTasks,
    todayPriorities: departmentTaskFocus(departmentTasks, "today"),
    overdueTasks: departmentTaskFocus(departmentTasks, "overdue"),
    approvals,
    isLoading: tasks.isLoading || purchaseRequests.isLoading || gates.isLoading,
  };
}

export function DepartmentWorkspaceQueues({ department }: { department: DashboardDepartment }) {
  const { tasks, todayPriorities, overdueTasks, approvals, isLoading } = useDepartmentQueues(department);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="size-5 text-primary" /> Today’s lead priorities</CardTitle>
          <CardDescription>Urgent, high-priority, blocked, and due-today work visible to this department.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <Loading /> : todayPriorities.length === 0 ? <Empty label="No urgent, blocked, high-priority, or due-today tasks are visible." /> : todayPriorities.slice(0, 5).map((task) => (
            <Link key={task.id} to="/tasks" className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between hover:text-primary">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.assigneeName ?? "Unassigned"}{task.projectCode ? ` · ${task.projectCode}` : ""}{task.dueDate ? ` · Due ${task.dueDate}` : " · No due date"}</p></div>
              <div className="flex shrink-0 flex-wrap gap-1"><PriorityBadge priority={task.priority} />{task.status === "blocked" && <Badge variant="destructive">Blocked</Badge>}</div>
            </Link>
          ))}
          <Button asChild variant="outline" className="w-full"><Link to="/tasks">Open department work board <ExternalLink className="size-4" /></Link></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-destructive" /> Past due</CardTitle>
          <CardDescription>Open department work that needs recovery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <Loading /> : overdueTasks.length === 0 ? <Empty label="No past-due tasks are visible." /> : overdueTasks.slice(0, 4).map((task) => (
            <Link key={task.id} to="/tasks" className="block border-b pb-3 last:border-0 last:pb-0 hover:text-primary"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">Due {task.dueDate} · {task.assigneeName ?? "Unassigned"}</p></Link>
          ))}
          <Button asChild variant="outline" className="w-full"><Link to="/tasks">Review pending tasks <ExternalLink className="size-4" /></Link></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="size-5 text-primary" /> Department tasks</CardTitle>
          <CardDescription>Open work already visible to you in the task board.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <Loading /> : tasks.length === 0 ? <Empty label="No open tasks visible for this department." /> : tasks.slice(0, 4).map((task) => (
            <div key={task.id} className="border-b pb-3 last:border-0 last:pb-0">
              <p className="text-sm font-medium">{task.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{task.status.replaceAll("_", " ")} · {task.assignee?.name ?? "Unassigned"}</p>
            </div>
          ))}
          <Button asChild variant="outline" className="w-full"><Link to="/tasks">Open task board <ExternalLink className="size-4" /></Link></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" /> Approval queue</CardTitle>
          <CardDescription>Review each item in its established controlled workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <Loading /> : approvals.length === 0 ? <Empty label="No pending approvals or gates are visible to you." /> : approvals.slice(0, 4).map((item) => (
            <Link key={item.id} to={item.to} className="block border-b pb-3 last:border-0 last:pb-0 hover:text-primary">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail} · {item.status.replaceAll("_", " ")}</p>
            </Link>
          ))}
          <Button asChild variant="outline" className="w-full"><Link to={department === "operations" ? "/procurement/requests" : "/projects"}>Open approval work <ExternalLink className="size-4" /></Link></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderOpen className="size-5 text-primary" /> Documents</CardTitle>
          <CardDescription>References to existing SSM One project documents and secure file links.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 text-sm text-muted-foreground"><FileText className="mt-0.5 size-4 shrink-0" /><span>Open project files, controlled revisions, and share links from the existing document area.</span></div>
          <div className="flex items-start gap-3 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><span>Google Drive is not connected. No Google account, token, or external file permission is stored here.</span></div>
          <Button asChild variant="outline" className="w-full"><Link to="/drive">Open SSM One documents <ExternalLink className="size-4" /></Link></Button>
          {department === "operations" && <Button asChild variant="ghost" className="w-full"><Link to="/procurement/requests"><ShoppingCart className="size-4" /> Purchase request records</Link></Button>}
        </CardContent>
      </Card>
    </div>
  );
}

function Loading() {
  return <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Loading queue…</div>;
}

function Empty({ label }: { label: string }) {
  return <p className="min-h-24 text-sm text-muted-foreground">{label}</p>;
}

function PriorityBadge({ priority }: { priority: "low" | "medium" | "high" | "urgent" }) {
  const label = priority === "urgent" ? "Urgent" : priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low";
  const variant = priority === "urgent" ? "destructive" : priority === "high" ? "secondary" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}