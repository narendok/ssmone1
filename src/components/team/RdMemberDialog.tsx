import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/tasks";
import type { RDMember } from "@/lib/inventory";

const NONE = "__none";
type DepartmentValue = (typeof DEPARTMENTS)[number]["value"];

export function RdMemberDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: RDMember | null;
  onSaved: (member: RDMember) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", role: "", department: NONE });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: member?.name ?? "",
      email: member?.email ?? "",
      role: member?.role ?? "",
      department: (member as (RDMember & { department?: string | null }) | null)?.department ?? NONE,
    });
  }, [member, open]);

  async function save() {
    if (!form.name.trim() || !form.email.trim()) return toast.error("Name and email are required");
    setSaving(true);
    const payload: { name: string; email: string; role: string | null; department: DepartmentValue | null } = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role.trim() || null,
      department: form.department === NONE ? null : form.department as DepartmentValue,
    };
    const request = member
      ? supabase.from("rd_members").update(payload).eq("id", member.id).select().single()
      : supabase.from("rd_members").insert(payload).select().single();
    const { data, error } = await request;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(member ? "Team member updated" : "Team member created");
    onSaved(data as RDMember);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Edit team member" : "Create R&D team member"}</DialogTitle>
          <DialogDescription>Create a reusable R&D contact for kit assignments, tasks, and PCB repair work.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div className="space-y-1.5"><Label>Relevant role</Label><Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="Firmware engineer, PCB designer…" /></div>
          <div className="space-y-1.5"><Label>Department</Label><Select value={form.department} onValueChange={(department) => setForm({ ...form, department })}><SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger><SelectContent><SelectItem value={NONE}>No department</SelectItem>{DEPARTMENTS.map((department) => <SelectItem key={department.value} value={department.value}>{department.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : member ? "Save member" : "Create member"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}