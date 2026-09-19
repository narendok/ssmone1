import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Clock, Plus, Trash2, User } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES, addChecklistItem, addComment, deleteTask,
  department as findDepartment, fetchActivity, fetchChecklist, removeChecklistItem,
  statusLabel, toggleChecklistItem, updateTask, type ProjectTask, type TaskStatus,
} from "@/lib/tasks";

export function TaskDrawer({
  task, onOpenChange, onEdit,
}: {
  task: ProjectTask | null;
  onOpenChange: (v: boolean) => void;
  onEdit: (t: ProjectTask) => void;
}) {
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState("");
  const [comment, setComment] = useState("");

  const { data: checklist = [] } = useQuery({
    queryKey: ["task_checklist", task?.id],
    queryFn: () => fetchChecklist(task!.id),
    enabled: !!task,
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["task_activity", task?.id],
    queryFn: () => fetchActivity(task!.id),
    enabled: !!task,
  });

  if (!task) return null;

  const dep = findDepartment(task.department);
  const done = checklist.filter((c) => c.is_done).length;
  const pct = checklist.length ? Math.round((done / checklist.length) * 100) : 0;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["project_tasks"] });
    qc.invalidateQueries({ queryKey: ["open_task_count"] });
    qc.invalidateQueries({ queryKey: ["task_checklist", task!.id] });
    qc.invalidateQueries({ queryKey: ["task_activity", task!.id] });
  }

  async function changeStatus(next: TaskStatus) {
    if (next === "done" && task!.department === "qa") {
      if (!confirm("QA sign-off: confirm this quality task has been verified and can be closed?")) return;
    }
    try {
      await updateTask(task!.id, { status: next });
      toast.success(`Moved to ${statusLabel(next)}`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change the status");
    }
  }

  return (
    <Sheet open={!!task} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-6">{task.title}</SheetTitle>
          <SheetDescription>
            {task.project ? `${task.project.code} — ${task.project.name}` : "Standalone task"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {dep && <Badge variant="outline" className={dep.pill}>{dep.label}</Badge>}
            <Badge variant="outline">{TASK_PRIORITIES.find((p) => p.value === task.priority)?.label}</Badge>
            {task.ppap_element && <Badge variant="secondary">PPAP {task.ppap_element}</Badge>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Status</span>
              <Select value={task.status} onValueChange={(v) => changeStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 text-sm">
              <span className="text-xs text-muted-foreground">Details</span>
              <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />{task.assignee?.name ?? "Unassigned"}</div>
              <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{task.due_date ?? "No due date"}</div>
              <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {Number(task.logged_hours ?? 0)}h logged{task.estimated_hours ? ` of ${Number(task.estimated_hours)}h` : ""}
              </div>
            </div>
          </div>

          {task.description && (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{task.description}</p>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Checklist</h3>
              <span className="text-xs text-muted-foreground">{done}/{checklist.length}</span>
            </div>
            {checklist.length > 0 && <Progress value={pct} className="h-1.5" />}
            <div className="space-y-1">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm group">
                  <Checkbox
                    checked={item.is_done}
                    onCheckedChange={async (v) => { await toggleChecklistItem(item.id, !!v); refresh(); }}
                  />
                  <span className={item.is_done ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                  <button
                    className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={async () => { await removeChecklistItem(item.id); refresh(); }}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newItem.trim()) return;
                await addChecklistItem(task.id, newItem.trim(), checklist.length);
                setNewItem("");
                refresh();
              }}
            >
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a checklist item" />
              <Button type="submit" variant="outline" size="icon"><Plus className="h-4 w-4" /></Button>
            </form>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Activity</h3>
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!comment.trim()) return;
                await addComment(task.id, comment.trim());
                setComment("");
                refresh();
              }}
            >
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave a comment…" />
              <Button type="submit" size="sm" variant="outline">Post comment</Button>
            </form>
            <ul className="space-y-2 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="border-l-2 pl-3 py-0.5">
                  <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  {a.kind === "status" ? (
                    <span>Moved {a.from_status ? statusLabel(a.from_status) : "—"} → {a.to_status ? statusLabel(a.to_status) : "—"}</span>
                  ) : (
                    <span className="whitespace-pre-wrap">{a.body ?? a.kind}</span>
                  )}
                </li>
              ))}
              {activity.length === 0 && <li className="text-muted-foreground">No activity yet.</li>}
            </ul>
          </div>

          <Separator />

          <div className="flex justify-between pb-6">
            <Button variant="outline" onClick={() => onEdit(task)}>Edit task</Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                if (!confirm("Delete this task?")) return;
                try {
                  await deleteTask(task.id);
                  toast.success("Task deleted");
                  onOpenChange(false);
                  refresh();
                } catch {
                  toast.error("Only admins, project managers or the task creator can delete a task.");
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const TASK_DEPARTMENTS = DEPARTMENTS;
