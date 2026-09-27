import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, CircleAlert, Loader2, UsersRound } from "lucide-react";
import { fetchDepartmentDashboard, type DashboardDepartment } from "@/lib/department-dashboard";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const departments: { id: DashboardDepartment; label: string; permission: string }[] = [
  { id: "engineering", label: "Engineering", permission: "engineering.view" },
  { id: "operations", label: "Operations", permission: "procurement.view" },
  { id: "production", label: "Production", permission: "production.view" },
  { id: "hr", label: "People", permission: "hr.view" },
  { id: "sales", label: "Sales", permission: "sales.view" },
  { id: "quality", label: "Quality", permission: "quality.view" },
];

const toneClasses = { default: "border-border", attention: "border-amber-500/50", critical: "border-destructive/50" };

export function DepartmentLeadDashboard() {
  const { role, permissions } = useAuth();
  const navigate = useNavigate({ from: "/dashboards/" });
  const search = useSearch({ from: "/_authenticated/dashboards/" });
  const availableDepartments = useMemo(() => departments.filter((department) => role === "admin" || permissions.includes(department.permission)), [permissions, role]);
  const requestedDepartment = departments.some((department) => department.id === search.department) ? search.department as DashboardDepartment : undefined;
  const [selectedDepartment, setSelectedDepartment] = useState<DashboardDepartment>(requestedDepartment ?? availableDepartments[0]?.id ?? "engineering");
  const activeSelection = requestedDepartment && availableDepartments.some((department) => department.id === requestedDepartment) ? requestedDepartment : selectedDepartment;
  const activeDepartment = availableDepartments.find((department) => department.id === activeSelection) ?? availableDepartments[0];
  const dashboard = useQuery({ queryKey: ["department_dashboard", activeDepartment?.id], queryFn: () => fetchDepartmentDashboard(activeDepartment?.id ?? "engineering"), enabled: Boolean(activeDepartment) });

  if (!availableDepartments.length) return <section className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold">Department access required</h1><p className="mt-2 text-sm text-muted-foreground">Your account does not currently have access to a department workspace.</p></section>;

  return <div className="space-y-6"><section className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-medium text-primary">Lead workspace</p><h1 className="mt-1 text-2xl font-semibold">Department command center</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Stay ahead of work queues, bottlenecks and daily operating actions across your department.</p></div><Button asChild variant="outline"><Link to="/tasks"><UsersRound className="size-4" /> Team work queue</Link></Button></section><div className="flex flex-wrap gap-2" aria-label="Department dashboard selection">{availableDepartments.map((department) => <Button key={department.id} size="sm" variant={activeDepartment?.id === department.id ? "default" : "outline"} onClick={() => { setSelectedDepartment(department.id); void navigate({ search: { department: department.id } }); }}>{department.label}</Button>)}</div>{dashboard.isLoading && <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Loading operational workspace…</div>}{dashboard.isError && <Card><CardContent className="flex items-center gap-3 p-5 text-sm"><CircleAlert className="size-5 text-destructive" /> This workspace could not be loaded. Refresh and try again.</CardContent></Card>}{dashboard.data && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{dashboard.data.metrics.map((metric) => <Card key={metric.label} className={cn("border-l-4", toneClasses[metric.tone ?? "default"])}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{metric.label}</p><p className="mt-1 text-3xl font-semibold">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p></CardContent></Card>)}</div><div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-primary" /> Lead action queue</CardTitle><CardDescription>Open the correct work area and take action without navigating through multiple menus.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{dashboard.data.actions.map((action) => <Link key={action.label} to={action.to} className={cn("group flex min-h-28 flex-col justify-between border p-4 transition-colors hover:bg-muted/60", toneClasses[action.tone ?? "default"])}><div><p className="font-medium">{action.label}</p><p className="mt-1 text-sm text-muted-foreground">{action.detail}</p></div><ArrowUpRight className="mt-3 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-primary" /> Workload pulse</CardTitle><CardDescription>Task pressure that needs lead attention.</CardDescription></CardHeader><CardContent className="space-y-4">{dashboard.data.workload.map((item) => <div key={item.label} className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm font-medium">{item.label}</span><span className="text-sm text-muted-foreground">{item.open} open</span></div><div className="grid grid-cols-3 gap-2 text-center"><div className="border p-2"><p className="font-semibold">{item.open}</p><p className="text-xs text-muted-foreground">Open</p></div><div className="border border-destructive/40 p-2"><p className="font-semibold text-destructive">{item.blocked}</p><p className="text-xs text-muted-foreground">Blocked</p></div><div className="border border-amber-500/40 p-2"><p className="font-semibold text-amber-700 dark:text-amber-400">{item.overdue}</p><p className="text-xs text-muted-foreground">Overdue</p></div></div></div>)}<div className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-primary" /> Keep ownership and due dates current to keep this view reliable.</div></CardContent></Card></div></>}</div>;
}