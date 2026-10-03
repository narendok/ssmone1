import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchProjects } from "@/lib/projects";
import {
  TASK_PRIORITIES, TASK_STATUSES, createTask, fetchCanonicalDepartments, updateTask,
  type ProjectTask,
} from "@/lib/tasks";
import type { RDMember } from "@/lib/inventory";

const NONE = "__none";

export function TaskDialog({
  open, onOpenChange, task, projectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: ProjectTask | null;
  projectId?: string;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", department: "hardware", department_id: NONE, priority: "medium", status: "todo",
    assignee_id: NONE, project_id: projectId ?? NONE, due_date: "", estimated_hours: "",
    logged_hours: "", ppap_element: "", purchase_request_id: NONE, qms_capa_id: NONE, customer_complaint_id: NONE,
  });

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: departments = [] } = useQuery({ queryKey: ["canonical_departments"], queryFn: fetchCanonicalDepartments });
  const { data: members = [] } = useQuery({
    queryKey: ["rd_members"],
    queryFn: async () => {
      const { data } = await supabase.from("rd_members").select("*").eq("active", true).order("name");
      return (data ?? []) as RDMember[];
    },
  });
  const { data: purchaseRequests = [] } = useQuery({ queryKey: ["purchase_requests", "task-link"], queryFn: async () => { const { data, error } = await supabase.from("purchase_requests").select("id,request_number,status").order("created_at", { ascending: false }).limit(100); if (error) throw error; return data ?? []; } });
  const { data: capas = [] } = useQuery({ queryKey: ["qms_capas", "task-link"], queryFn: async () => { const { data, error } = await supabase.from("qms_capas").select("id,capa_code,title,status").order("created_at", { ascending: false }).limit(100); if (error) throw error; return data ?? []; } });
  const { data: complaints = [] } = useQuery({ queryKey: ["customer_complaints", "task-link"], queryFn: async () => { const { data, error } = await supabase.from("customer_complaints").select("id,complaint_code,title,status").order("created_at", { ascending: false }).limit(100); if (error) throw error; return data ?? []; } });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: task?.title ?? "",
      description: task?.description ?? "",
      department: task?.department ?? "hardware", department_id: task?.department_id ?? NONE,
      priority: task?.priority ?? "medium",
      status: task?.status ?? "todo",
      assignee_id: task?.assignee_id ?? NONE,
      project_id: task?.project_id ?? projectId ?? NONE,
      due_date: task?.due_date ?? "",
      estimated_hours: task?.estimated_hours != null ? String(task.estimated_hours) : "",
      logged_hours: task?.logged_hours != null ? String(task.logged_hours) : "", ppap_element: task?.ppap_element ?? "",
      purchase_request_id: task?.purchase_request_id ?? NONE, qms_capa_id: task?.qms_capa_id ?? NONE, customer_complaint_id: task?.customer_complaint_id ?? NONE,
    });
  }, [open, task, projectId]);

  async function save() {
    if (!form.title.trim()) return toast.error("Give the task a title");
    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      department: form.department,
      department_id: form.department_id === NONE ? null : form.department_id,
      priority: form.priority,
      status: form.status,
      assignee_id: form.assignee_id === NONE ? null : form.assignee_id,
      project_id: form.project_id === NONE ? null : form.project_id,
      due_date: form.due_date || null,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      logged_hours: form.logged_hours ? Number(form.logged_hours) : 0,
      ppap_element: form.ppap_element.trim() || null,
      purchase_request_id: form.purchase_request_id === NONE ? null : form.purchase_request_id,
      qms_capa_id: form.qms_capa_id === NONE ? null : form.qms_capa_id,
      customer_complaint_id: form.customer_complaint_id === NONE ? null : form.customer_complaint_id,
    };
    try {
      if (task) await updateTask(task.id, payload);
      else await createTask(payload);
      toast.success(task ? "Task updated" : "Task created");
      qc.invalidateQueries({ queryKey: ["project_tasks"] });
      qc.invalidateQueries({ queryKey: ["open_task_count"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>Tasks can belong to a project or stand alone, and always belong to a department.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Calibrate oscilloscope rig 2" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.department_id} onValueChange={(id) => setForm({ ...form, department_id: id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.code ? `${department.code} — ` : ""}{department.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={form.assignee_id} onValueChange={(v) => setForm({ ...form, assignee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {members.length === 0 && <Button asChild variant="link" size="sm" className="h-auto p-0"><Link to="/rd-team">Create an R&amp;D member</Link></Button>}
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!projectId && (
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Standalone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Standalone (no project)</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <TaskLinkSelect label="Purchase request" value={form.purchase_request_id} onValueChange={(value) => setForm({ ...form, purchase_request_id: value })} noneLabel="No linked purchase request">{purchaseRequests.map((request: any) => <SelectItem key={request.id} value={request.id}>{request.request_number} — {request.status.replaceAll("_", " ")}</SelectItem>)}</TaskLinkSelect>
            <TaskLinkSelect label="CAPA / quality action" value={form.qms_capa_id} onValueChange={(value) => setForm({ ...form, qms_capa_id: value })} noneLabel="No linked CAPA">{capas.map((capa: any) => <SelectItem key={capa.id} value={capa.id}>{capa.capa_code} — {capa.title}</SelectItem>)}</TaskLinkSelect>
            <TaskLinkSelect label="Customer quality record" value={form.customer_complaint_id} onValueChange={(value) => setForm({ ...form, customer_complaint_id: value })} noneLabel="No linked customer complaint">{complaints.map((complaint: any) => <SelectItem key={complaint.id} value={complaint.id}>{complaint.complaint_code} — {complaint.title}</SelectItem>)}</TaskLinkSelect>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated hours</Label>
              <Input type="number" step="0.25" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Logged hours</Label>
              <Input type="number" step="0.25" value={form.logged_hours} onChange={(e) => setForm({ ...form, logged_hours: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>PPAP element (optional)</Label>
              <Input value={form.ppap_element} onChange={(e) => setForm({ ...form, ppap_element: e.target.value })} placeholder="18" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskLinkSelect({ label, value, onValueChange, noneLabel, children }: { label: string; value: string; onValueChange: (value: string) => void; noneLabel: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue placeholder={noneLabel} /></SelectTrigger><SelectContent><SelectItem value={NONE}>{noneLabel}</SelectItem>{children}</SelectContent></Select></div>; }
