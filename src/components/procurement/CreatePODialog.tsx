import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VendorDialog } from "./VendorDialog";
import {
  createPurchaseOrder,
  fetchSearchableParts,
  fetchVendors,
  GST_RATE,
  inr,
  type SearchablePart,
} from "@/lib/procurement";

export interface PoDraftLine {
  component_id: string | null;
  mpn: string;
  description: string;
  quantity_ordered: number;
  unit_cost: number;
  on_hand?: number;
}

export function CreatePODialog({
  open,
  onOpenChange,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: PoDraftLine[];
  onCreated?: (poId: string) => void;
}) {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [gst, setGst] = useState(true);
  const [lines, setLines] = useState<PoDraftLine[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [vendorDialog, setVendorDialog] = useState(false);

  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
  const { data: parts = [] } = useQuery({ queryKey: ["procurement_parts"], queryFn: fetchSearchableParts });

  useEffect(() => {
    if (open) {
      setLines(prefill && prefill.length ? prefill : []);
      setSearch("");
    }
  }, [open, prefill]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [] as SearchablePart[];
    return parts
      .filter((p) => p.part_number.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, parts]);

  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity_ordered) || 0) * (Number(l.unit_cost) || 0), 0);
  const tax = gst ? subtotal * GST_RATE : 0;

  function addPart(p: SearchablePart) {
    setLines((ls) => [
      ...ls,
      {
        component_id: p.id,
        mpn: p.part_number,
        description: p.name,
        quantity_ordered: 1,
        unit_cost: Number(p.cost ?? 0),
        on_hand: p.total_quantity,
      },
    ]);
    setSearch("");
  }

  function update(i: number, patch: Partial<PoDraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!vendorId) return toast.error("Pick a vendor");
    const valid = lines.filter((l) => l.mpn.trim() && Number(l.quantity_ordered) > 0);
    if (!valid.length) return toast.error("Add at least one line with a quantity");
    setSaving(true);
    try {
      const res = await createPurchaseOrder({
        vendor_id: vendorId,
        expected_delivery_date: expected || null,
        notes: notes || null,
        tax_amount: Number(tax.toFixed(2)),
        items: valid.map((l) => ({
          component_id: l.component_id,
          mpn: l.mpn.trim(),
          description: l.description || null,
          quantity_ordered: Number(l.quantity_ordered),
          unit_cost: Number(l.unit_cost) || 0,
        })),
      });
      toast.success(`${res.po_number} created — ${inr(res.total_amount)}`);
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      onCreated?.(res.po_id);
      onOpenChange(false);
      setVendorId("");
      setExpected("");
      setNotes("");
      setLines([]);
    } catch (e: any) {
      toast.error(e.message ?? "Could not create purchase order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create purchase order</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label>Vendor *</Label>
              <div className="flex gap-2">
                <Select value={vendorId} onValueChange={(v) => (v === "__new" ? setVendorDialog(true) : setVendorId(v))}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.filter((v) => v.is_active).map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                    <SelectItem value="__new">+ Add new vendor…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Expected delivery</Label>
              <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Add components</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by part number or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {results.length > 0 && (
              <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPart(p)}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{p.part_number}</span>
                    <span className="text-sm text-muted-foreground truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      on hand {p.total_quantity} · {inr(p.cost)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MPN</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right w-24">Qty</TableHead>
                  <TableHead className="text-right w-32">Unit price</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No line items yet</TableCell></TableRow>
                )}
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input value={l.mpn} onChange={(e) => update(i, { mpn: e.target.value })} className="h-8 min-w-32" />
                    </TableCell>
                    <TableCell>
                      <Input value={l.description} onChange={(e) => update(i, { description: e.target.value })} className="h-8 min-w-40" />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{l.on_hand ?? "—"}</TableCell>
                    <TableCell>
                      <Input type="number" min={1} value={l.quantity_ordered}
                        onChange={(e) => update(i, { quantity_ordered: Number(e.target.value) })} className="h-8 text-right" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0} step="0.01" value={l.unit_cost}
                        onChange={(e) => update(i, { unit_cost: Number(e.target.value) })} className="h-8 text-right" />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {inr((Number(l.quantity_ordered) || 0) * (Number(l.unit_cost) || 0))}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions, quotation reference…" />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(subtotal)}</span></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={gst} onCheckedChange={setGst} id="gst" />
                  <Label htmlFor="gst" className="text-muted-foreground">GST 18%</Label>
                </div>
                <span>{inr(tax)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold text-base">
                <span>Total</span><span>{inr(subtotal + tax)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create purchase order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VendorDialog
        open={vendorDialog}
        onOpenChange={setVendorDialog}
        onSaved={async () => {
          const fresh = await qc.fetchQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
          const last = fresh[fresh.length - 1];
          if (last) setVendorId(last.id);
        }}
      />
    </>
  );
}
