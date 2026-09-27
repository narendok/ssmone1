import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, FileText, LayoutGrid, List, Plus, SlidersHorizontal, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES, department as findDepartment,
  fetchTasks, statusLabel, updateTask, type ProjectTask, type TaskStatus,
} from "@/lib/tasks";
import { TaskDialog } from "./TaskDialog";
import { TaskDrawer } from "./TaskDrawer";

export function TaskBoard({ projectId, compact = false }: { projectId?: string; compact?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/tasks/" });
  const routeSearch = useSearch({ from: "/_authenticated/tasks/" });
  const [view, setView] = useState<"board" | "table">("table");
  const [deps, setDeps] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProjectTask | null>(null);
  const [openId, setOpenId] = useState<string | null>(routeSearch.task ?? null);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["project_tasks", projectId ?? "all"],
    queryFn: () => fetchTasks(projectId),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (deps.size && !deps.has(t.department)) return false;
      if (routeSearch.assignee && t.assignee_id !== routeSearch.assignee) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.assignee?.name ?? "").toLowerCase().includes(q) ||
        (t.project?.code ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, deps, search, routeSearch.assignee]);

  const grouped = useMemo(() => {
    const m: Record<string, ProjectTask[]> = {};
    for (const s of TASK_STATUSES) m[s.value] = [];
    for (const t of filtered) m[t.status]?.push(t);
    return m;
  }, [filtered]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["project_tasks"] });
    qc.invalidateQueries({ queryKey: ["open_task_count"] });
  }

  async function move(task: ProjectTask, status: TaskStatus) {
    if (task.status === status) return;
    if (status === "done" && task.department === "qa") {
      if (!confirm("QA sign-off: confirm this quality task has been verified and can be closed?")) return;
    }
    try {
      await updateTask(task.id, { status });
      toast.success(`${task.title} → ${statusLabel(status)}`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not move the task");
    }
  }

  function toggleDep(value: string) {
    setDeps((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const openTask = tasks.find((t) => t.id === (routeSearch.task ?? openId)) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks, people, projects…"
          className="h-9 w-full sm:max-w-xs"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm"><SlidersHorizontal className="size-4" /> Departments{deps.size ? ` (${deps.size})` : ""}<ChevronDown className="size-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-2">
            <div className="space-y-1">
              {DEPARTMENTS.map((department) => <label key={department.value} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={deps.has(department.value)} onCheckedChange={() => toggleDep(department.value)} /><span className={cn("size-2 rounded-full", department.dot)} /><span className="flex-1">{department.label}</span><span className="text-xs text-muted-foreground">{tasks.filter((task) => task.department === department.value).length}</span></label>)}
            </div>
            {deps.size > 0 && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setDeps(new Set())}>Clear filters</Button>}
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" onClick={() => setView("board")}>
            <LayoutGrid className="h-4 w-4" /> Board
          </Button>
          <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setView("table")}>
            <List className="h-4 w-4" /> Table
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} task{filtered.length === 1 ? "" : "s"}{routeSearch.assignee ? " for selected assignee" : ""}</span>
        {routeSearch.assignee && <Button variant="ghost" size="sm" onClick={() => void navigate({ search: { assignee: undefined, task: routeSearch.task } })}>Clear assignee</Button>}
        <Button className="ml-auto" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New task</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading tasks…</p>}

      {!isLoading && view === "board" && (
        <div className={cn("grid gap-3", compact ? "md:grid-cols-3 xl:grid-cols-5" : "md:grid-cols-3 xl:grid-cols-5")}>
          {TASK_STATUSES.map((col) => (
            <div
              key={col.value}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const t = tasks.find((x) => x.id === dragId);
                setDragId(null);
                if (t) move(t, col.value);
              }}
              className="rounded-lg border bg-muted/30 p-2 min-h-[140px] space-y-2"
            >
              <div className="flex items-center gap-2 px-1 text-sm font-medium">
                <span className={cn("h-2 w-2 rounded-full", col.color)} />
                {col.label}
                <span className="ml-auto text-xs text-muted-foreground">{grouped[col.value].length}</span>
              </div>
              {grouped[col.value].map((t) => {
                const dep = findDepartment(t.department);
                return (
                  <Card
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onClick={() => setOpenId(t.id)}
                    className="cursor-pointer p-2.5 space-y-1.5 hover:border-primary/50"
                  >
                    <div className="text-sm font-medium leading-snug">{t.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dep && <Badge variant="outline" className={cn("text-[10px] py-0", dep.pill)}>{dep.label}</Badge>}
                      {t.project && (
                        <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{t.project.code}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.assignee?.name ?? "Unassigned"}</span>
                      {t.due_date && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{t.due_date}</span>}
                      <span className={cn("ml-auto", TASK_PRIORITIES.find((p) => p.value === t.priority)?.color)}>
                        {TASK_PRIORITIES.find((p) => p.value === t.priority)?.label}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {!isLoading && view === "table" && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const dep = findDepartment(t.department);
                return (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => { setOpenId(t.id); void navigate({ search: { assignee: routeSearch.assignee, task: t.id } }); }}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>{dep && <Badge variant="outline" className={dep.pill}>{dep.label}</Badge>}</TableCell>
                    <TableCell className="font-mono text-xs">{t.project?.code ?? "—"}</TableCell>
                    <TableCell>{t.assignee?.name ?? "—"}</TableCell>
                    <TableCell>{t.drive_node_id ? <span className="inline-flex items-center gap-1 text-muted-foreground"><FileText className="size-3.5" /> Linked</span> : "—"}</TableCell>
                    <TableCell className={TASK_PRIORITIES.find((p) => p.value === t.priority)?.color}>
                      {TASK_PRIORITIES.find((p) => p.value === t.priority)?.label}
                    </TableCell>
                    <TableCell>{t.due_date ?? "—"}</TableCell>
                    <TableCell>{statusLabel(t.status)}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No tasks match.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <TaskDialog open={creating} onOpenChange={setCreating} projectId={projectId} />
      <TaskDialog
        open={!!editing}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        task={editing}
        projectId={projectId}
      />
      <TaskDrawer
        task={openTask}
        onOpenChange={(v) => { if (!v) { setOpenId(null); void navigate({ search: { assignee: routeSearch.assignee, task: undefined } }); } }}
        onEdit={(t) => { setOpenId(null); setEditing(t); }}
      />
    </div>
  );
}
