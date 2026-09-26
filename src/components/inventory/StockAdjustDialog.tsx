import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Minus, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Component, Location } from "@/lib/inventory";
import { stockStatus } from "@/lib/inventory";
import { adjustStock } from "@/lib/inventory-adjustment.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: Component & { locations: Location[]; total_quantity: number };
  onSaved: (id: string) => void;
}

export function StockAdjustDialog({ open, onOpenChange, component, onSaved }: Props) {
  const [locationId, setLocationId] = useState(component.locations[0]?.id ?? "");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const postAdjustment = useServerFn(adjustStock);

  const loc = component.locations.find((l) => l.id === locationId);

  async function handleSave() {
    if (!loc) return toast.error("Select a location");
    if (qty <= 0) return toast.error("Quantity must be positive");
    setSaving(true);
    const delta = direction === "add" ? qty : -qty;
    if (!note.trim()) { setSaving(false); return toast.error("Provide a reason for this adjustment"); }
    const key = requestKey || crypto.randomUUID();
    if (!requestKey) setRequestKey(key);
    let data: { adjustmentNumber: string };
    try {
      data = await postAdjustment({ data: {
        componentId: component.id,
        locationId: loc.id,
        delta,
        reason: note.trim(),
        idempotencyKey: key,
      } });
    } catch (error) {
      setSaving(false);
      return toast.error(error instanceof Error ? error.message : "Stock could not be updated.");
    }

    const newQty = loc.quantity + delta;
    const newTotal = component.total_quantity + delta;
    const status = stockStatus(newTotal, component.low_stock_threshold);
    toast.success("Stock updated", {
      description: `${data.adjustmentNumber}: ${component.name} • ${loc.label}: ${loc.quantity} → ${newQty}`,
    });
    if (status !== "in_stock") {
      toast.warning(status === "out_of_stock" ? "Component is now out of stock" : "Component is now low on stock", {
        icon: <AlertTriangle className="h-4 w-4" />,
      });
    }
    setSaving(false);
    setRequestKey("");
    onSaved(component.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock — {component.name}</DialogTitle>
          <DialogDescription>Add or remove parts from a specific location.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Location</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border p-2">
              {component.locations.length === 0 && <p className="text-xs text-muted-foreground p-2">No locations. Edit the component to add one.</p>}
              {component.locations.map((l) => (
                <label key={l.id} className={`flex items-center justify-between rounded-md p-2 cursor-pointer ${locationId === l.id ? "bg-accent" : "hover:bg-accent/50"}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={locationId === l.id} onChange={() => setLocationId(l.id)} />
                    <div>
                      <div className="text-sm font-medium capitalize">{l.location_type} — {l.label}</div>
                    </div>
                  </div>
                  <span className="text-sm font-mono">{l.quantity} pcs</span>
                </label>
              ))}
            </div>
          </div>

          <RadioGroup value={direction} onValueChange={(v) => setDirection(v as "add" | "remove")} className="grid grid-cols-2 gap-2">
            <label className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer ${direction === "add" ? "border-primary bg-primary/5" : ""}`}>
              <RadioGroupItem value="add" /><Plus className="h-4 w-4 text-success" /><span className="font-medium">Add stock</span>
            </label>
            <label className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer ${direction === "remove" ? "border-primary bg-primary/5" : ""}`}>
              <RadioGroupItem value="remove" /><Minus className="h-4 w-4 text-destructive" /><span className="font-medium">Remove stock</span>
            </label>
          </RadioGroup>

          <div className="space-y-1.5"><Label className="text-xs">Quantity</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Reason *</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason, project, batch info…" /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Update stock"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
