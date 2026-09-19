import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS, department as findDepartment } from "@/lib/tasks";
import type { RDMember } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/rd-team")({
  component: RDTeamPage,
});

function RDTeamPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RDMember | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "", department: "__none" });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["rd_members_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rd_members").select("*").order("name");
      if (error) throw error;
      return data as RDMember[];
    },
  });

  function openNew() { setEditing(null); setForm({ name: "", email: "", role: "", department: "__none" }); setOpen(true); }
  function openEdit(m: RDMember) { setEditing(m); setForm({ name: m.name, email: m.email, role: m.role ?? "", department: (m as any).department ?? "__none" }); setOpen(true); }

  async function save() {
    if (!form.name || !form.email) return toast.error("Name and email required");
    const payload: any = {
      name: form.name,
      email: form.email,
      role: form.role,
      department: form.department === "__none" ? null : form.department,
    };
    if (editing) {
      const { error } = await supabase.from("rd_members").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("rd_members").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["rd_members_all"] });
    qc.invalidateQueries({ queryKey: ["rd_members"] });
  }

  async function toggleActive(m: RDMember) {
    await supabase.from("rd_members").update({ active: !m.active }).eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["rd_members_all"] });
  }

  async function remove(m: RDMember) {
    if (!confirm(`Remove ${m.name}?`)) return;
    const { error } = await supabase.from("rd_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["rd_members_all"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">R&amp;D Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">People you can assign component kits to. They'll be emailed on assignment.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add member</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {!isLoading && members.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
            No team members yet. Add one to start assigning components.
          </Card>
        )}
        {members.map((m) => (
          <Card key={m.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <button onClick={() => openEdit(m)} className="font-semibold hover:text-primary text-left">{m.name}</button>
                {m.role && <div className="text-xs text-muted-foreground">{m.role}</div>}
                {findDepartment((m as any).department) && (
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${findDepartment((m as any).department)!.pill}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${findDepartment((m as any).department)!.dot}`} />
                    {findDepartment((m as any).department)!.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={m.active} onCheckedChange={() => toggleActive(m)} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {m.email}
            </div>
            <div className="pt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => remove(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit member" : "Add R&D member"}</DialogTitle>
            <DialogDescription>This person will receive email notifications when assigned components.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Role (optional)</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Firmware engineer, PCB designer…" /></div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue placeholder="No department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No department</SelectItem>
                  {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
