import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchProjects } from "@/lib/projects";
import type { Component, Location, RDMember } from "@/lib/inventory";

export type AssignablePart = Component & { locations: Location[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One or more components to assign together as a bundle. */
  components: AssignablePart[];
  onSaved: (id: string) => void;
}

interface Line {
  part: AssignablePart;
  locationId: string;
  qty: number;
}

export function AssignDialog({ open, onOpenChange, components, onSaved }: Props) {
  const { user } = useAuth();
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>(() =>
    components.map((c) => ({ part: c, locationId: c.locations[0]?.id ?? "", qty: 1 }))
  );

  const { data: members = [] } = useQuery({
    queryKey: ["rd_members"],
    queryFn: async () => {
      const { data } = await supabase.from("rd_members").select("*").eq("active", true).order("name");
      return (data ?? []) as RDMember[];
    },
  });

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  const { data: allParts = [] } = useQuery({
    queryKey: ["assignable_parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("*, locations(*)")
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AssignablePart[];
    },
  });

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(lines.map((l) => l.part.id));
    return allParts
      .filter((p) => !chosen.has(p.id))
      .filter((p) => p.name.toLowerCase().includes(q) || p.part_number.toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, allParts, lines]);

  function addLine(part: AssignablePart) {
    setLines((prev) => [...prev, { part, locationId: part.locations[0]?.id ?? "", qty: 1 }]);
    setSearch("");
  }

  function patch(idx: number, patchObj: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patchObj } : l)));
  }

  async function handleAssign() {
    if (!assigneeId) return toast.error("Choose an R&D team member");
    if (lines.length === 0) return toast.error("Add at least one component");

    for (const l of lines) {
      const loc = l.part.locations.find((x) => x.id === l.locationId);
      if (!loc) return toast.error(`Choose a location for ${l.part.name}`);
      if (l.qty <= 0 || l.qty > loc.quantity) return toast.error(`${l.part.name}: quantity must be 1–${loc.quantity}`);
    }

    setSaving(true);
    const assignee = members.find((m) => m.id === assigneeId);
    const project = projects.find((p) => p.id === projectId);

    let batchId: string | null = null;
    const { data: batch, error: bErr } = await supabase
      .from("assignment_batches")
      .insert({
        assignee_id: assigneeId,
        project_id: project?.id ?? null,
        notes: notes || null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (bErr) { setSaving(false); return toast.error(bErr.message); }
    batchId = batch.id;

    for (const l of lines) {
      const loc = l.part.locations.find((x) => x.id === l.locationId)!;
      const { error: locErr } = await supabase
        .from("locations")
        .update({ quantity: loc.quantity - l.qty })
        .eq("id", loc.id);
      if (locErr) { setSaving(false); return toast.error(locErr.message); }

      const { error: aErr } = await supabase.from("assignments").insert({
        component_id: l.part.id,
        location_id: loc.id,
        quantity: l.qty,
        assignee_id: assigneeId,
        assigned_by: user?.id,
        batch_id: batchId,
        project_id: project?.id ?? null,
        project_name: project?.name ?? null,
        notes: notes || null,
      });
      if (aErr) { setSaving(false); return toast.error(aErr.message); }

      await supabase.from("stock_history").insert({
        component_id: l.part.id,
        location_id: loc.id,
        delta: -l.qty,
        action: "assign",
        note: `Assigned ${l.qty} to ${assignee?.name}${project ? ` (${project.name})` : ""}`,
        user_id: user?.id,
        user_email: user?.email,
      });
    }

    toast.success(
      lines.length === 1
        ? `Assigned ${lines[0].qty}× ${lines[0].part.name} to ${assignee?.name}`
        : `Assigned ${lines.length} items to ${assignee?.name} as one bundle`,
      { description: assignee?.email ? `Notification queued for ${assignee.email}` : undefined }
    );
    setSaving(false);
    onSaved(lines[0].part.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign to R&amp;D</DialogTitle>
          <DialogDescription>
            Everything here goes out together as one bundle with a shared ID. They can be returned item by item or all at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Choose team member" /></SelectTrigger>
                <SelectContent>
                  {members.length === 0 && <div className="p-2 text-xs text-muted-foreground">Add members in the R&amp;D Team page first.</div>}
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} {m.role ? `— ${m.role}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Choose project (optional)" /></SelectTrigger>
                <SelectContent>
                  {projects.length === 0 && <div className="p-2 text-xs text-muted-foreground">Create projects in Settings → Projects.</div>}
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Bundle items ({lines.length})</Label>
            </div>
            {lines.length === 0 && <p className="text-xs text-muted-foreground">No items yet — search below to add parts.</p>}
            {lines.map((l, i) => {
              const loc = l.part.locations.find((x) => x.id === l.locationId);
              return (
                <div key={l.part.id} className="grid grid-cols-1 gap-2 border-b pb-2 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{l.part.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{l.part.part_number}</div>
                  </div>
                  <Select value={l.locationId} onValueChange={(v) => patch(i, { locationId: v, qty: 1 })}>
                    <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Location" /></SelectTrigger>
                    <SelectContent>
                      {l.part.locations.length === 0 && <div className="p-2 text-xs text-muted-foreground">No stock locations</div>}
                      {l.part.locations.map((x) => (
                        <SelectItem key={x.id} value={x.id}>{x.location_type} — {x.label} ({x.quantity} pcs)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-full sm:w-20"
                    min={1}
                    max={loc?.quantity ?? 1}
                    value={l.qty}
                    onChange={(e) => patch(i, { qty: Number(e.target.value) })}
                  />
                  <Button variant="ghost" size="icon" aria-label={`Remove ${l.part.name}`} onClick={() => setLines((prev) => prev.filter((_, x) => x !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            <div className="relative pt-1">
              <Input placeholder="Add another part — search name or part number" value={search} onChange={(e) => setSearch(e.target.value)} />
              {results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => addLine(p)}
                    >
                      <span className="truncate">{p.name} <span className="font-mono text-xs text-muted-foreground">{p.part_number}</span></span>
                      <Plus className="h-4 w-4 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={saving}>{saving ? "Assigning…" : lines.length > 1 ? `Assign ${lines.length} items` : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
