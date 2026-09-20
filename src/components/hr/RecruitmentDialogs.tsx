import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createJobPosting, createJobRequisition } from "@/lib/hr.functions";
import type { HrJobRequisition } from "@/lib/hr";

const NONE = "__none";

type DepartmentOption = { id: string; name: string; code: string | null };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function CreateRequisitionDialog({
  open,
  onOpenChange,
  departments,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  departments: DepartmentOption[];
  onSubmitted: () => void;
}) {
  const submit = useServerFn(createJobRequisition);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    departmentId: NONE,
    employmentType: "Full-time",
    workMode: "On-site",
    location: "",
    headcount: "1",
    justification: "",
    targetStartDate: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({ title: "", departmentId: NONE, employmentType: "Full-time", workMode: "On-site", location: "", headcount: "1", justification: "", targetStartDate: "" });
  }, [open]);

  async function handleSubmit() {
    if (!form.title.trim()) return toast.error("Add a role title.");
    setSaving(true);
    try {
      await submit({
        data: {
          title: form.title.trim(),
          departmentId: form.departmentId === NONE ? null : form.departmentId,
          employmentType: form.employmentType,
          workMode: form.workMode,
          location: form.location.trim() || null,
          headcount: Number(form.headcount || "1"),
          justification: form.justification.trim() || null,
          targetStartDate: form.targetStartDate || null,
        },
      });
      toast.success("Job opening created");
      onOpenChange(false);
      onSubmitted();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save requisition");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New job opening</DialogTitle>
          <DialogDescription>The opening code is assigned automatically. Add the essentials now; publish the careers page when ready.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Role title</Label>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Senior Embedded Engineer" />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={form.departmentId} onValueChange={(value) => setForm((current) => ({ ...current, departmentId: value }))}>
              <SelectTrigger><SelectValue placeholder="Choose department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>{department.code ? `${department.code} — ` : ""}{department.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Headcount</Label>
            <Input type="number" min="1" value={form.headcount} onChange={(event) => setForm((current) => ({ ...current, headcount: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Input value={form.employmentType} onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Work mode</Label>
            <Input value={form.workMode} onChange={(event) => setForm((current) => ({ ...current, workMode: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Bengaluru" />
          </div>
          <div className="space-y-1.5">
            <Label>Target start date</Label>
            <Input type="date" value={form.targetStartDate} onChange={(event) => setForm((current) => ({ ...current, targetStartDate: event.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Justification</Label>
            <Textarea rows={5} value={form.justification} onChange={(event) => setForm((current) => ({ ...current, justification: event.target.value }))} placeholder="What gap will this hire close?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Create job opening"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreatePostingDialog({
  open,
  onOpenChange,
  departments,
  requisitions,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  departments: DepartmentOption[];
  requisitions: HrJobRequisition[];
  onSubmitted: () => void;
}) {
  const submit = useServerFn(createJobPosting);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    requisitionId: NONE,
    departmentId: NONE,
    title: "",
    slug: "",
    summary: "",
    description: "",
    location: "",
    employmentType: "Full-time",
    workMode: "On-site",
    isPublished: false,
  });

  useEffect(() => {
    if (!open) return;
    setForm({ requisitionId: NONE, departmentId: NONE, title: "", slug: "", summary: "", description: "", location: "", employmentType: "Full-time", workMode: "On-site", isPublished: false });
  }, [open]);

  const selectedRequisition = useMemo(
    () => requisitions.find((requisition) => requisition.id === form.requisitionId) ?? null,
    [form.requisitionId, requisitions],
  );

  useEffect(() => {
    if (!selectedRequisition) return;
    setForm((current) => ({
      ...current,
      title: current.title || selectedRequisition.title,
      slug: current.slug || slugify(selectedRequisition.title),
      departmentId: current.departmentId === NONE && selectedRequisition.department?.id ? selectedRequisition.department.id : current.departmentId,
      employmentType: current.employmentType || selectedRequisition.employment_type,
      workMode: current.workMode || selectedRequisition.work_mode,
      location: current.location || selectedRequisition.location || "",
    }));
  }, [selectedRequisition]);

  async function handleSubmit() {
    if (!form.title.trim() || !form.slug.trim() || !form.description.trim()) return toast.error("Complete the role title, page link, and description.");
    setSaving(true);
    try {
      await submit({
        data: {
          requisitionId: form.requisitionId === NONE ? null : form.requisitionId,
          departmentId: form.departmentId === NONE ? null : form.departmentId,
          slug: slugify(form.slug),
          title: form.title.trim(),
          summary: form.summary.trim() || null,
          description: form.description.trim(),
          location: form.location.trim() || null,
          employmentType: form.employmentType,
          workMode: form.workMode,
          isPublished: form.isPublished,
        },
      });
      toast.success(form.isPublished ? "Career opening published" : "Career opening saved");
      onOpenChange(false);
      onSubmitted();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save opening");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New career opening</DialogTitle>
          <DialogDescription>Create the public-facing opening that candidates will see on Careers.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Based on requisition</Label>
            <Select value={form.requisitionId} onValueChange={(value) => setForm((current) => ({ ...current, requisitionId: value }))}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Standalone opening</SelectItem>
                {requisitions.map((requisition) => (
                  <SelectItem key={requisition.id} value={requisition.id}>{requisition.requisition_code ? `${requisition.requisition_code} — ` : ""}{requisition.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role title</Label>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Page link</Label>
            <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Short summary</Label>
            <Input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Own embedded firmware for next-generation vehicle electronics." />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={form.departmentId} onValueChange={(value) => setForm((current) => ({ ...current, departmentId: value }))}>
              <SelectTrigger><SelectValue placeholder="Choose department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>{department.code ? `${department.code} — ` : ""}{department.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Input value={form.employmentType} onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Work mode</Label>
            <Input value={form.workMode} onChange={(event) => setForm((current) => ({ ...current, workMode: event.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Role description</Label>
            <Textarea rows={10} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe responsibilities, expectations, and the experience someone will have in the role." />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Publish immediately</p>
              <p className="text-xs text-muted-foreground">Turn this on to show the opening on the Careers page.</p>
            </div>
            <Switch checked={form.isPublished} onCheckedChange={(checked) => setForm((current) => ({ ...current, isPublished: checked }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : form.isPublished ? "Publish opening" : "Save opening"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
