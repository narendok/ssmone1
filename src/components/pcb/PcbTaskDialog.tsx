import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITIES, type Priority } from "@/lib/pcb";
import type { Project } from "@/lib/projects";
import type { RDMember } from "@/lib/inventory";

const sb = supabase as any;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: Project[];
  members: RDMember[];
  onSaved: () => void;
}

export function PcbTaskDialog({ open, onOpenChange, projects, members, onSaved }: Props) {
  const [boardName, setBoardName] = useState("");
  const [issue, setIssue] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("__none__");
  const [projectId, setProjectId] = useState<string>("__none__");
  const [priority, setPriority] = useState<Priority>("medium");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!boardName.trim() || !issue.trim()) return toast.error("Board name and issue required");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await sb.from("pcb_tasks").insert({
      board_name: boardName.trim(),
      issue: issue.trim(),
      assignee_id: assigneeId === "__none__" ? null : assigneeId,
      project_id: projectId === "__none__" ? null : projectId,
      priority,
      created_by: u.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Task created");
    setBoardName(""); setIssue(""); setAssigneeId("__none__"); setProjectId("__none__"); setPriority("medium");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New PCB task</DialogTitle>
          <DialogDescription>Log a board for repair tracking.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Board name *</Label><Input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="e.g. PSU Board #4" /></div>
          <div><Label>Issue description *</Label><Textarea rows={3} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Symptoms, what was reported…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project</SelectItem>
                  {projects.filter((p) => p.status === "active").map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
