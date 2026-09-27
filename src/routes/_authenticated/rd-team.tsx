import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardList, Mail, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DEPARTMENTS, department as findDepartment } from "@/lib/tasks";
import type { RDMember } from "@/lib/inventory";
import { RdMemberDialog } from "@/components/team/RdMemberDialog";

export const Route = createFileRoute("/_authenticated/rd-team")({
  head: () => ({ meta: [{ title: "R&D Team — SSM One" }, { name: "description", content: "Research and development team directory." }, { property: "og:title", content: "R&D Team — SSM One" }, { property: "og:description", content: "Research and development team directory." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RDTeamPage,
});

function RDTeamPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RDMember | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["rd_members_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rd_members").select("*").order("name");
      if (error) throw error;
      return data as RDMember[];
    },
  });

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(m: RDMember) { setEditing(m); setOpen(true); }
  function refreshMembers() { void qc.invalidateQueries({ queryKey: ["rd_members_all"] }); void qc.invalidateQueries({ queryKey: ["rd_members"] }); }

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
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Create member</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {!isLoading && members.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
            <p>No R&amp;D members yet.</p>
            <Button className="mt-3" onClick={openNew}><Plus className="h-4 w-4" /> Create the first member</Button>
          </Card>
        )}
        {members.map((m) => (
          <Card key={m.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{m.name}</p>
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
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild variant="outline" size="sm"><Link to="/tasks" search={{ assignee: undefined, task: undefined }}><ClipboardList className="h-3.5 w-3.5" /> Task</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/pcb"><Wrench className="h-3.5 w-3.5" /> PCB repair</Link></Button>
                <Button variant="ghost" size="icon" aria-label={`Edit ${m.name}`} title="Edit member" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Remove ${m.name}`} title="Remove member" onClick={() => remove(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <RdMemberDialog open={open} onOpenChange={setOpen} member={editing} onSaved={refreshMembers} />
    </div>
  );
}
