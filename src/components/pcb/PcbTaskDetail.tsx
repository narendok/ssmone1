import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PCB_STATUSES, PCB_STATUS_LABEL, PCB_STATUS_COLOR, PRIORITIES, ROOT_CAUSES,
  type PcbStatus, type PcbTask, type PcbTaskHistory, type PcbTaskNote, type PcbTaskPhoto, type RootCause,
} from "@/lib/pcb";
import type { Project } from "@/lib/projects";
import type { RDMember } from "@/lib/inventory";
import { exportPcbTaskPdf } from "./PcbPdfExport";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface Props {
  task: PcbTask;
  projects: Project[];
  members: RDMember[];
  onClose: () => void;
  onChanged: () => void;
}

export function PcbTaskDetail({ task, projects, members, onClose, onChanged }: Props) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PcbStatus>(task.status);
  const [rootCause, setRootCause] = useState<RootCause | "">(task.root_cause ?? "");
  const [rootCauseNotes, setRootCauseNotes] = useState(task.root_cause_notes ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState<string>(task.assignee_id ?? "__none__");
  const [projectId, setProjectId] = useState<string>(task.project_id ?? "__none__");
  const [savingMeta, setSavingMeta] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStatus(task.status);
    setRootCause(task.root_cause ?? "");
    setRootCauseNotes(task.root_cause_notes ?? "");
    setPriority(task.priority);
    setAssigneeId(task.assignee_id ?? "__none__");
    setProjectId(task.project_id ?? "__none__");
  }, [task.id]);

  const { data: history = [] } = useQuery({
    queryKey: ["pcb_task_history", task.id],
    queryFn: async () => {
      const { data } = await sb.from("pcb_task_history").select("*").eq("task_id", task.id).order("created_at");
      return (data ?? []) as PcbTaskHistory[];
    },
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["pcb_task_notes", task.id],
    queryFn: async () => {
      const { data } = await sb.from("pcb_task_notes").select("*").eq("task_id", task.id).order("created_at");
      return (data ?? []) as PcbTaskNote[];
    },
  });
  const { data: photos = [] } = useQuery({
    queryKey: ["pcb_task_photos", task.id],
    queryFn: async () => {
      const { data } = await sb.from("pcb_task_photos").select("*").eq("task_id", task.id).order("created_at");
      const list = (data ?? []) as PcbTaskPhoto[];
      const withUrls = await Promise.all(list.map(async (p) => {
        const { data: signed } = await supabase.storage.from("pcb-photos").createSignedUrl(p.storage_path, 3600);
        return { ...p, url: signed?.signedUrl ?? "" };
      }));
      return withUrls;
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["pcb_tasks"] });
    qc.invalidateQueries({ queryKey: ["pcb_task_history", task.id] });
    qc.invalidateQueries({ queryKey: ["pcb_task_notes", task.id] });
    qc.invalidateQueries({ queryKey: ["pcb_task_photos", task.id] });
    onChanged();
  };

  async function saveMeta(nextStatus = status) {
    if ((nextStatus === "repaired" || nextStatus === "failed") && !rootCause) {
      toast.error("Root cause is required to mark Repaired or Failed");
      return false;
    }
    setSavingMeta(true);
    const { error } = await sb.from("pcb_tasks").update({
      status: nextStatus,
      root_cause: rootCause || null,
      root_cause_notes: rootCauseNotes.trim() || null,
      priority,
      assignee_id: assigneeId === "__none__" ? null : assigneeId,
      project_id: projectId === "__none__" ? null : projectId,
    }).eq("id", task.id);
    setSavingMeta(false);
    if (error) { toast.error(error.message); return false; }
    toast.success("Saved");
    refreshAll();
    return true;
  }

  async function handleStatusChange(next: PcbStatus) {
    setStatus(next);
    if ((next === "repaired" || next === "failed") && !rootCause) {
      toast.message("Select a root cause, then save.");
      return;
    }
    await saveMeta(next);
  }

  async function postNote() {
    if (!noteBody.trim()) return;
    setPosting(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await sb.from("pcb_task_notes").insert({ task_id: task.id, body: noteBody.trim(), author_id: u.user?.id ?? null });
    setPosting(false);
    if (error) return toast.error(error.message);
    setNoteBody("");
    qc.invalidateQueries({ queryKey: ["pcb_task_notes", task.id] });
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${task.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pcb-photos").upload(path, file, { upsert: false });
      if (upErr) { toast.error(upErr.message); continue; }
      await sb.from("pcb_task_photos").insert({ task_id: task.id, storage_path: path, uploaded_by: u.user?.id ?? null });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["pcb_task_photos", task.id] });
    toast.success("Uploaded");
  }

  async function deletePhoto(p: PcbTaskPhoto) {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage.from("pcb-photos").remove([p.storage_path]);
    await sb.from("pcb_task_photos").delete().eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["pcb_task_photos", task.id] });
  }

  async function handleDelete() {
    if (!confirm(`Delete task "${task.board_name}"?`)) return;
    const { error } = await sb.from("pcb_tasks").delete().eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onClose();
    onChanged();
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportPcbTaskPdf({ task, history, notes, photos: photos.map((p) => ({ url: p.url, caption: p.caption })) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{task.board_name}</SheetTitle>
          <SheetDescription>
            Created {new Date(task.created_at).toLocaleString()}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("text-white", PCB_STATUS_COLOR[status])}>{PCB_STATUS_LABEL[status]}</Badge>
            {task.project && (
              <span className="text-xs px-1.5 py-0.5 rounded border" style={{ background: `${task.project.color}22`, color: task.project.color, borderColor: `${task.project.color}55` }}>
                {task.project.code}
              </span>
            )}
            {task.assignee && <Badge variant="secondary" className="text-xs">{task.assignee.name}</Badge>}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Issue</Label>
            <p className="text-sm whitespace-pre-wrap">{task.issue}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => handleStatusChange(v as PcbStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PCB_STATUSES.map((s) => <SelectItem key={s} value={s}>{PCB_STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" /> Root cause / failure mode
              {(status === "repaired" || status === "failed") && !rootCause && (
                <Badge variant="destructive" className="text-[10px]">required</Badge>
              )}
            </div>
            <Select value={rootCause || "__none__"} onValueChange={(v) => setRootCause(v === "__none__" ? "" : (v as RootCause))}>
              <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {ROOT_CAUSES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea rows={2} placeholder="Details (optional)" value={rootCauseNotes} onChange={(e) => setRootCauseNotes(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => saveMeta()} disabled={savingMeta}>{savingMeta ? "Saving…" : "Save changes"}</Button>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Photos</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {photos.map((p) => (
                <div key={p.id} className="relative group">
                  <img src={p.url} alt="" className="w-full h-24 object-cover rounded border" />
                  <button onClick={() => deletePhoto(p)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <Button size="sm" variant="outline" className="mt-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
            </Button>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <div className="space-y-2 mt-2">
              {notes.map((n) => (
                <div key={n.id} className="border rounded-md p-2 text-sm">
                  <div className="text-[10px] text-muted-foreground mb-1">{new Date(n.created_at).toLocaleString()}</div>
                  <p className="whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
            </div>
            <div className="mt-2 flex gap-2">
              <Textarea rows={2} placeholder="Add a note…" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              <Button onClick={postNote} disabled={posting || !noteBody.trim()}>Post</Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Status history</Label>
            <ol className="mt-2 space-y-1.5 border-l pl-4">
              {history.map((h) => (
                <li key={h.id} className="relative text-xs">
                  <span className={cn("absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full", PCB_STATUS_COLOR[h.to_status])} />
                  <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                  <div>
                    {h.from_status ? <>{PCB_STATUS_LABEL[h.from_status]} → </> : null}
                    <strong>{PCB_STATUS_LABEL[h.to_status]}</strong>
                  </div>
                </li>
              ))}
              {history.length === 0 && <li className="text-xs text-muted-foreground">No history yet.</li>}
            </ol>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
