import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Project } from "@/lib/projects";

const sb = supabase as any;

export function ProjectDialog({ open, onOpenChange, editing, onSaved, defaultDepartmentId }: { open: boolean; onOpenChange: (open: boolean) => void; editing?: Project | null; onSaved: () => void; defaultDepartmentId?: string | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [color, setColor] = useState("#3b82f6"); const [status, setStatus] = useState<"active" | "archived">("active"); const [revision, setRevision] = useState(""); const [designLink, setDesignLink] = useState(""); const [projectType, setProjectType] = useState("CUSTOM_PROJECT"); const [projectStage, setProjectStage] = useState("INITIATION"); const [healthStatus, setHealthStatus] = useState("GREEN"); const [priority, setPriority] = useState("MEDIUM"); const [plannedStartDate, setPlannedStartDate] = useState(""); const [targetSopDate, setTargetSopDate] = useState(""); const [departmentId, setDepartmentId] = useState("none"); const [projectClass, setProjectClass] = useState<"INTERNAL" | "CLIENT">("INTERNAL"); const [saving, setSaving] = useState(false);
  const { data: departments = [] } = useQuery({ queryKey: ["active_project_departments"], queryFn: async () => { const { data, error } = await sb.from("departments").select("id,name,code").eq("is_active", true).order("sort_order"); if (error) throw error; return data as Array<{ id: string; name: string; code: string | null }>; }, enabled: open });
  useEffect(() => { if (!open) return; if (editing) { setName(editing.name); setCode(editing.code); setColor(editing.color); setStatus(editing.status); setRevision(editing.revision ?? ""); setDesignLink(editing.design_link ?? ""); setProjectType(editing.project_type); setProjectStage(editing.project_stage); setHealthStatus(editing.health_status); setPriority(editing.priority); setPlannedStartDate(editing.planned_start_date ?? ""); setTargetSopDate(editing.target_sop_date ?? ""); setDepartmentId(editing.department_id ?? "none"); setProjectClass(editing.drive_project_class ?? "INTERNAL"); } else { setName(""); setCode(""); setColor("#3b82f6"); setStatus("active"); setRevision(""); setDesignLink(""); setProjectType("CUSTOM_PROJECT"); setProjectStage("INITIATION"); setHealthStatus("GREEN"); setPriority("MEDIUM"); setPlannedStartDate(""); setTargetSopDate(""); setDepartmentId(defaultDepartmentId ?? "none"); setProjectClass("INTERNAL"); } }, [open, editing, defaultDepartmentId]);
  async function save() {
    if (saving) return;
    if (!name.trim()) return toast.error("Name is required");
    if (departmentId === "none") return toast.error("Select the owning department");
    setSaving(true);
    const payload = { name: name.trim(), ...(editing ? { code: code.trim().toUpperCase() } : {}), color, status, revision: revision.trim() || null, design_link: designLink.trim() || null, project_type: projectType, project_stage: projectStage, health_status: healthStatus, priority, planned_start_date: plannedStartDate || null, target_sop_date: targetSopDate || null, department_id: departmentId, drive_project_class: projectClass };
    try {
      const { data: savedProject, error } = editing
        ? await sb.from("projects").update(payload).eq("id", editing.id).select("id").single()
        : await sb.from("projects").insert(payload).select("id").single();
      if (error || !savedProject) throw new Error(error?.message ?? "Project could not be saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["department_projects", departmentId] }),
        queryClient.invalidateQueries({ queryKey: ["drive_children"] }),
        queryClient.invalidateQueries({ queryKey: ["department_drive_roots", departmentId] }),
      ]);
      toast.success(editing ? "Project updated" : "Project created with its folder structure");
      onSaved();
      onOpenChange(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Project could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit project" : "Add project"}</DialogTitle><DialogDescription>Project information is used across delivery, engineering and task workflows.</DialogDescription></DialogHeader><div className="grid gap-3"><div className="grid grid-cols-3 gap-3"><div className="col-span-2"><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div><div><Label>Project code</Label><Input value={code} disabled={!editing} onChange={(event) => setCode(event.target.value.toUpperCase())} className="font-mono" placeholder={editing ? "Project code" : "Generated on save"} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Owning department</Label><Select value={departmentId} onValueChange={setDepartmentId} disabled={Boolean(defaultDepartmentId && !editing)}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent>{departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}{department.code ? ` · ${department.code}` : ""}</SelectItem>)}</SelectContent></Select></div><div><Label>Project area</Label><Select value={projectClass} onValueChange={(value) => setProjectClass(value as "INTERNAL" | "CLIENT")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INTERNAL">Internal project</SelectItem><SelectItem value="CLIENT">Client project</SelectItem></SelectContent></Select></div></div><div className="grid grid-cols-3 gap-3"><div><Label>Color</Label><Input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 p-1" /></div><div><Label>Revision</Label><Input value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="v1.2" /></div><div><Label>Status</Label><Select value={status} onValueChange={(value) => setStatus(value as "active" | "archived")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div></div><div><Label>Design link URL</Label><Input value={designLink} onChange={(event) => setDesignLink(event.target.value)} placeholder="https://…" /></div><div className="grid grid-cols-2 gap-3"><ProjectSelect label="Project type" value={projectType} onValueChange={setProjectType} options={["CUSTOM_PROJECT", "CUSTOMER_PRODUCT_DEVELOPMENT", "INTERNAL_RND", "CUSTOMER_CHANGE_PROJECT", "COST_REDUCTION", "COMPONENT_CHANGE", "FIRMWARE_ONLY", "SOFTWARE_ONLY", "MECHANICAL_ONLY", "VALIDATION_ONLY"]} /><ProjectSelect label="Project stage" value={projectStage} onValueChange={setProjectStage} options={["INITIATION", "PLANNING", "DEVELOPMENT", "VALIDATION", "RELEASE", "CLOSED"]} /><ProjectSelect label="Health" value={healthStatus} onValueChange={setHealthStatus} options={["GREEN", "AMBER", "RED"]} /><ProjectSelect label="Priority" value={priority} onValueChange={setPriority} options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Planned start</Label><Input type="date" value={plannedStartDate} onChange={(event) => setPlannedStartDate(event.target.value)} /></div><div><Label>Target SOP</Label><Input type="date" value={targetSopDate} onChange={(event) => setTargetSopDate(event.target.value)} /></div></div></div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save project"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ProjectSelect({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: string[] }) { return <div><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>; }