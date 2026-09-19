import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Category } from "@/lib/inventory";
import { SettingsNav } from "@/components/SettingsNav";

export const Route = createFileRoute("/_authenticated/settings/categories")({
  component: CategorySettings,
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function CategorySettings() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const parents = categories.filter((c) => !c.parent_id);
  const subsByParent = new Map<string, Category[]>();
  categories.forEach((c) => { if (c.parent_id) { const arr = subsByParent.get(c.parent_id) ?? []; arr.push(c); subsByParent.set(c.parent_id, arr); } });

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState<{ parent_id: string | null } | null>(null);
  const [reassign, setReassign] = useState<{ category: Category; componentCount: number; childIds: string[] } | null>(null);

  async function handleDelete(c: Category) {
    if (c.slug === "uncategorized") {
      toast.error("Uncategorized is required as a safe fallback category");
      return;
    }

    // Collect descendant category IDs
    const childIds: string[] = [];
    const stack = [c.id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const cat of categories) {
        if (cat.parent_id === cur) { childIds.push(cat.id); stack.push(cat.id); }
      }
    }
    const allIds = [c.id, ...childIds];
    const { count, error: cntErr } = await supabase
      .from("components").select("id", { count: "exact", head: true })
      .in("category_id", allIds);
    if (cntErr) return toast.error(cntErr.message);

    if ((count ?? 0) > 0) {
      setReassign({ category: c, componentCount: count ?? 0, childIds });
      return;
    }
    if (!confirm(`Delete "${c.name}"${childIds.length ? ` and ${childIds.length} subcategor${childIds.length === 1 ? "y" : "ies"}` : ""}?`)) return;
    if (childIds.length) {
      const { error: e1 } = await supabase.from("categories").delete().in("id", childIds);
      if (e1) return toast.error(e1.message);
    }
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <SettingsNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage top-level categories and subcategories.</p>
        </div>
        <Button onClick={() => setCreating({ parent_id: null })}><Plus className="h-4 w-4 mr-1" /> Add category</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <div className="space-y-3">
          {parents.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{p.sort_order}. {p.name}</span>
                  <span className="text-xs text-muted-foreground font-normal">({p.slug})</span>
                </CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setCreating({ parent_id: p.id })}><Plus className="h-3.5 w-3.5" /> Sub</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {p.slug !== "uncategorized" && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <ul className="space-y-1">
                  {(subsByParent.get(p.id) ?? []).sort((a, b) => a.sort_order - b.sort_order).map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                      <span className="flex items-center gap-2">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.sort_order}.{s.sort_order} {s.name}
                        <span className="text-xs text-muted-foreground">({s.slug})</span>
                      </span>
                      <span className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                        {s.slug !== "uncategorized" && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(s)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        )}
                      </span>
                    </li>
                  ))}
                  {(subsByParent.get(p.id) ?? []).length === 0 && (
                    <li className="text-xs text-muted-foreground px-3">No subcategories yet.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CategoryDialog
        open={!!editing || !!creating}
        onClose={() => { setEditing(null); setCreating(null); }}
        editing={editing}
        defaultParentId={creating?.parent_id ?? null}
        parents={parents}
        onSaved={() => qc.invalidateQueries({ queryKey: ["categories"] })}
      />

      <ReassignDialog
        open={!!reassign}
        info={reassign}
        categories={categories}
        onClose={() => setReassign(null)}
        onDone={() => { setReassign(null); qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["components"] }); }}
      />
    </div>
  );
}

function ReassignDialog({
  open, info, categories, onClose, onDone,
}: {
  open: boolean;
  info: { category: Category; componentCount: number; childIds: string[] } | null;
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setTarget(""); }, [info?.category.id]);
  if (!info) return null;
  const excluded = new Set([info.category.id, ...info.childIds]);
  const options = categories.filter((c) => !excluded.has(c.id));

  async function handleReassignAndDelete() {
    if (!target) return toast.error("Pick a target category");
    if (!info) return;
    setBusy(true);
    try {
      const allIds = [info.category.id, ...info.childIds];
      const { error: uErr } = await supabase.from("components")
        .update({ category_id: target }).in("category_id", allIds);
      if (uErr) throw uErr;
      if (info.childIds.length) {
        const { error: e1 } = await supabase.from("categories").delete().in("id", info.childIds);
        if (e1) throw e1;
      }
      const { error } = await supabase.from("categories").delete().eq("id", info.category.id);
      if (error) throw error;
      toast.success("Reassigned and deleted");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign components</DialogTitle>
          <DialogDescription>
            "{info.category.name}" has {info.componentCount} component{info.componentCount === 1 ? "" : "s"}
            {info.childIds.length ? ` across ${info.childIds.length + 1} categor${info.childIds.length === 0 ? "y" : "ies"}` : ""}.
            Pick a category to move them to, then it will be deleted.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Move components to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.parent_id ? "↳ " : ""}{c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleReassignAndDelete} disabled={busy || !target}>
            {busy ? "Working…" : "Reassign & delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open, onClose, editing, defaultParentId, parents, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Category | null;
  defaultParentId: string | null;
  parents: Category[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState(1);
  const [icon, setIcon] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setSlug(editing.slug);
      setParentId(editing.parent_id);
      setSortOrder(editing.sort_order);
      setIcon(editing.icon ?? "");
    } else {
      setName("");
      setSlug("");
      setParentId(defaultParentId);
      setSortOrder(1);
      setIcon("");
    }
  }, [open, editing, defaultParentId]);

  function reset() {
    setName(""); setSlug(""); setParentId(null); setSortOrder(1); setIcon("");
  }

  async function handleSave() {
    if (!name.trim()) return toast.error("Name is required");
    const finalSlug = slug.trim() || slugify(name);
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("categories").update({
          name: name.trim(), slug: finalSlug, parent_id: parentId, sort_order: sortOrder, icon: icon || null,
        }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Updated");
      } else {
        const { error } = await supabase.from("categories").insert({
          name: name.trim(), slug: finalSlug, parent_id: parentId, sort_order: sortOrder, icon: icon || null,
        });
        if (error) throw error;
        toast.success("Created");
      }
      onSaved();
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>{parentId ? "Subcategory" : "Top-level category"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => { setName(e.target.value); if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value)); }} /></div>
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" /></div>
          <div>
            <Label>Parent</Label>
            <Select value={parentId ?? "__none__"} onValueChange={(v) => setParentId(v === "__none__" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None (top level) —</SelectItem>
                {parents.filter((p) => !editing || p.id !== editing.id).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Sort order</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
            <div><Label>Icon (top-level only)</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Zap, Cpu, Box…" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
