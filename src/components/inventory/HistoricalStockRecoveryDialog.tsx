import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { recoverHistoricalZeroStock } from "@/lib/inventory-recovery.functions";
import type { Component } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const locationTypes = ["basement", "lab", "rack", "drawer", "bin", "shelf", "store"];

export function HistoricalStockRecoveryDialog({ open, onOpenChange, component, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: Component;
  onSaved: () => void;
}) {
  const recover = useServerFn(recoverHistoricalZeroStock);
  const [quantity, setQuantity] = useState(0);
  const [locationType, setLocationType] = useState("bin");
  const [locationLabel, setLocationLabel] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!Number.isInteger(quantity) || quantity <= 0) return toast.error("Enter a verified positive quantity.");
    if (!locationLabel.trim()) return toast.error("Enter the verified bin or storage label.");
    if (sourceNote.trim().length < 3) return toast.error("State the verified source for this recovery.");
    const idempotencyKey = requestKey || crypto.randomUUID();
    if (!requestKey) setRequestKey(idempotencyKey);
    setSaving(true);
    try {
      const result = await recover({ data: {
        componentId: component.id,
        quantity,
        locationType,
        locationLabel: locationLabel.trim(),
        sourceNote: sourceNote.trim(),
        idempotencyKey,
      } });
      toast.success(`${component.part_number} recovered · ${result.locationLabel} now has ${result.locationQuantity} units`);
      setRequestKey("");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not recover historical stock.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Recover historical stock — {component.part_number}</DialogTitle>
        <DialogDescription>Enter only quantity and bin values verified from the original source. This cannot infer historical stock.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5"><Label>Verified quantity</Label><Input type="number" min={1} value={quantity || ""} onChange={(event) => setQuantity(Number(event.target.value) || 0)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Storage area</Label><Select value={locationType} onValueChange={setLocationType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{locationTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Bin / location</Label><Input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="Store 11 · Rack B3" /></div>
        </div>
        <div className="space-y-1.5"><Label>Verified source note</Label><Textarea value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} placeholder="Source document and line reference" rows={3} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? "Posting…" : "Post verified stock"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}