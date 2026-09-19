import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createLeaveRequest } from "@/lib/hr.functions";
import type { HrLeaveType } from "@/lib/hr";

const NONE = "__none";

export function LeaveRequestDialog({
  open,
  onOpenChange,
  employeeId,
  leaveTypes,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  employeeId: string | null;
  leaveTypes: HrLeaveType[];
  onSubmitted: () => void;
}) {
  const submit = useServerFn(createLeaveRequest);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    leaveTypeId: NONE,
    startDate: "",
    endDate: "",
    totalDays: "1",
    reason: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({ leaveTypeId: leaveTypes[0]?.id ?? NONE, startDate: "", endDate: "", totalDays: "1", reason: "" });
  }, [open, leaveTypes]);

  async function handleSubmit() {
    if (!employeeId) return toast.error("Your employee profile is not ready yet.");
    if (form.leaveTypeId === NONE) return toast.error("Choose a leave type.");
    if (!form.startDate || !form.endDate) return toast.error("Choose the leave dates.");
    setSaving(true);
    try {
      await submit({
        data: {
          employeeId,
          leaveTypeId: form.leaveTypeId,
          startDate: form.startDate,
          endDate: form.endDate,
          totalDays: Number(form.totalDays || "1"),
          reason: form.reason.trim() || null,
        },
      });
      toast.success("Leave request submitted");
      onOpenChange(false);
      onSubmitted();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not submit leave request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>Send a leave request to your reporting manager for approval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Leave type</Label>
            <Select value={form.leaveTypeId} onValueChange={(value) => setForm((current) => ({ ...current, leaveTypeId: value }))}>
              <SelectTrigger><SelectValue placeholder="Choose leave type" /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((leaveType) => (
                  <SelectItem key={leaveType.id} value={leaveType.id}>{leaveType.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Total days</Label>
            <Input type="number" min="0.5" step="0.5" value={form.totalDays} onChange={(event) => setForm((current) => ({ ...current, totalDays: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea rows={4} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Add any context your approver should know." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Submitting…" : "Submit request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
