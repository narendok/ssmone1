import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { fetchProjects, type Project } from "@/lib/projects";
import { SettingsNav } from "@/components/SettingsNav";

export const Route = createFileRoute("/_authenticated/settings/projects")({
  component: ProjectsSettings,
});

const sb = supabase as any;

function ProjectsSettings() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);

  async function toggleArchive(p: Project) {
    const next = p.status === "active" ? "archived" : "active";
    const { error } = await sb.from("projects").update({ status: next }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(next === "active" ? "Restored" : "Archived");
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function handleDelete(p: Project) {
    if (!confirm(`Delete project "${p.name}"? Component tags will be removed.`)) return;
    const { error } = await sb.from("projects").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <SettingsNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Tag components to projects and track design revisions.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Add project</Button>
        )}
      </div>
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">Read-only — only admins can edit projects.</p>
      )}

      {isLoading ? <p className="text-muted-foreground">Loading…</p> : projects.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No projects yet.</Card>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <span className="w-3 h-10 rounded-sm flex-shrink-0" style={{ background: p.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{p.code}</span>
                  <span className="font-medium">{p.name}</span>
                  {p.status === "archived" && <Badge variant="secondary">archived</Badge>}
                  {p.revision && <span className="text-xs text-muted-foreground">rev {p.revision}</span>}
                </div>
                {p.design_link && (
                  <a href={p.design_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
                    <ExternalLink className="h-3 w-3" /> design link
                  </a>
                )}
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggleArchive(p)} title={p.status === "active" ? "Archive" : "Restore"}>
                    {p.status === "active" ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ProjectDialog
        open={!!editing || creating}
        onClose={() => { setEditing(null); setCreating(false); }}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["projects"] })}
      />
    </div>
  );
}

function ProjectDialog({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void; editing: Project | null; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [revision, setRevision] = useState("");
  const [designLink, setDesignLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCode(editing.code);
      setColor(editing.color);
      setStatus(editing.status);
      setRevision(editing.revision ?? "");
      setDesignLink(editing.design_link ?? "");
    } else {
      setName(""); setCode(""); setColor("#3b82f6"); setStatus("active"); setRevision(""); setDesignLink("");
    }
  }, [open, editing]);

  async function handleSave() {
    if (!name.trim() || !code.trim()) return toast.error("Name and code are required");
    setSaving(true);
    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      color,
      status,
      revision: revision.trim() || null,
      design_link: designLink.trim() || null,
    };
    const { error } = editing
      ? await sb.from("projects").update(payload).eq("id", editing.id)
      : await sb.from("projects").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated" : "Created");
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit project" : "Add project"}</DialogTitle>
          <DialogDescription>Used to tag components and PCB tasks.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Short code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" placeholder="ALPHA" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
            </div>
            <div><Label>Revision</Label><Input value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="v1.2" /></div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Design link URL</Label><Input value={designLink} onChange={(e) => setDesignLink(e.target.value)} placeholder="https://…" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
