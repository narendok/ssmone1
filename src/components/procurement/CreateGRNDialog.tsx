import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  createGrn,
  fetchPurchaseOrders,
  fetchSearchableParts,
  pendingQty,
  quickCreateComponentForPoItem,
  REJECTION_REASONS,
  type NewGrnLine,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/lib/procurement";

const NEW_LOCATION = "__new";
const NO_REASON = "__none";

interface RowState {
  qty: number;
  rejected: number;
  reason: string;
  note: string;
  location: string;
  newLabel: string;
  lot: string;
}

const EMPTY_ROW: RowState = {
  qty: 0,
  rejected: 0,
  reason: NO_REASON,
  note: "",
  location: NEW_LOCATION,
  newLabel: "Basement Store 11 - Rack B3",
  lot: "",
};

export function CreateGRNDialog({
  open,
  onOpenChange,
  poId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  poId?: string | null;
}) {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({ queryKey: ["purchase_orders"], queryFn: fetchPurchaseOrders });
  const { data: parts = [] } = useQuery({ queryKey: ["procurement_parts"], queryFn: fetchSearchableParts });
  const { data: categories = [] } = useQuery({
    queryKey: ["grn_categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name,slug").order("sort_order");
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });

  const receivable = useMemo(
    () => orders.filter((o) => o.status === "SENT" || o.status === "PARTIALLY_RECEIVED"),
    [orders],
  );

  const [selected, setSelected] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [storeNotes, setStoreNotes] = useState("Basement Store 11");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [quickAdd, setQuickAdd] = useState<PurchaseOrderItem | null>(null);
  const [qaName, setQaName] = useState("");
  const [qaManufacturer, setQaManufacturer] = useState("");
  const [qaCategory, setQaCategory] = useState(NO_REASON);
  const [qaBusy, setQaBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(poId ?? "");
      setInvoiceNo("");
      setInvoiceDate("");
      setRows({});
    }
  }, [open, poId]);

  const po: PurchaseOrder | undefined = useMemo(() => orders.find((o) => o.id === selected), [orders, selected]);
  const partById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  function row(id: string): RowState {
    return rows[id] ?? EMPTY_ROW;
  }
  function setRow(id: string, patch: Partial<RowState>) {
    setRows((r) => ({ ...r, [id]: { ...row(id), ...patch } }));
  }

  function openQuickAdd(it: PurchaseOrderItem) {
    setQuickAdd(it);
    setQaName(it.description ?? it.mpn);
    setQaManufacturer("");
    setQaCategory(NO_REASON);
  }

  async function saveQuickAdd(skipDetails: boolean) {
    if (!quickAdd) return;
    setQaBusy(true);
    try {
      await quickCreateComponentForPoItem({
        po_item_id: quickAdd.id,
        mpn: quickAdd.mpn,
        name: skipDetails ? quickAdd.mpn : qaName.trim() || quickAdd.mpn,
        manufacturer: skipDetails ? null : qaManufacturer.trim() || null,
        category_id: skipDetails || qaCategory === NO_REASON ? null : qaCategory,
        cost: quickAdd.unit_cost,
        needs_review: true,
      });
      toast.success(`${quickAdd.mpn} added to inventory — it is flagged for review so you can finish the details later.`);
      setQuickAdd(null);
      await qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      await qc.invalidateQueries({ queryKey: ["procurement_parts"] });
      qc.invalidateQueries({ queryKey: ["components"] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not add the part");
    } finally {
      setQaBusy(false);
    }
  }

  async function submit() {
    if (!po) return toast.error("Select a purchase order");
    if (!invoiceNo.trim()) return toast.error("Vendor invoice number is required");

    const items: NewGrnLine[] = [];
    for (const it of po.items ?? []) {
      const r = row(it.id);
      const qty = Number(r.qty) || 0;
      const rej = Number(r.rejected) || 0;
      if (qty <= 0 && rej <= 0) continue;
      if (!it.component_id) {
        toast.error(`${it.mpn} is not in inventory yet — use "Add part" on that line first`);
        return;
      }
      const remaining = pendingQty(it);
      if (qty + rej > remaining) {
        toast.error(`${it.mpn}: accepted + rejected cannot exceed the ${remaining} still pending`);
        return;
      }
      if (rej > 0 && r.reason === NO_REASON) {
        toast.error(`${it.mpn}: choose why the ${rej} units were rejected`);
        return;
      }
      items.push({
        po_item_id: it.id,
        component_id: it.component_id,
        location_id: r.location === NEW_LOCATION ? null : r.location,
        location_type: "store",
        location_label: r.newLabel.trim() || "Basement Store 11",
        quantity: qty,
        quantity_rejected: rej,
        rejection_reason: rej > 0 ? r.reason : null,
        rejection_note: rej > 0 ? r.note.trim() || null : null,
        lot_number: r.lot.trim() || null,
      });
    }
    if (!items.length) return toast.error("Enter at least one accepted or rejected quantity");

    setSaving(true);
    try {
      const res = await createGrn({
        po_id: po.id,
        vendor_invoice_number: invoiceNo.trim(),
        vendor_invoice_date: invoiceDate || null,
        storage_notes: storeNotes.trim() || null,
        items,
      });
      toast.success(
        `${res.grn_number} posted. ${res.total_quantity} units are on quality hold pending incoming inspection` +
          (res.total_rejected ? `; ${res.total_rejected} rejected.` : "."),
      );
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["grns"] });
      qc.invalidateQueries({ queryKey: ["procurement_parts"] });
      qc.invalidateQueries({ queryKey: ["components"] });
       qc.invalidateQueries({ queryKey: ["incoming_inspections"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not record the goods receipt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New goods receipt note</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label>Purchase order *</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Select a sent PO" /></SelectTrigger>
                <SelectContent>
                  {receivable.length === 0 && <SelectItem value="__none" disabled>No POs awaiting delivery</SelectItem>}
                  {receivable.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.po_number} — {o.vendor?.name ?? "No vendor"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vendor invoice no. *</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Invoice date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-4">
              <Label>Storage notes</Label>
              <Input value={storeNotes} onChange={(e) => setStoreNotes(e.target.value)} placeholder="Basement Store 11, Rack B" />
            </div>
          </div>

          {po && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right w-24">Accepted</TableHead>
                    <TableHead className="text-right w-24">Rejected</TableHead>
                    <TableHead className="min-w-48">Rejection reason</TableHead>
                    <TableHead className="min-w-56">Storage location</TableHead>
                    <TableHead className="w-32">Lot / date code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(po.items ?? []).map((it) => {
                    const r = row(it.id);
                    const part = it.component_id ? partById.get(it.component_id) : undefined;
                    const pending = pendingQty(it);
                    return (
                      <TableRow key={it.id}>
                        <TableCell>
                          <div className="font-medium">{it.mpn}</div>
                          <div className="text-xs text-muted-foreground">{it.description ?? it.component?.name}</div>
                          {!it.component_id && (
                            <Button size="sm" variant="outline" className="mt-1 h-7" onClick={() => openQuickAdd(it)}>
                              <PlusCircle className="h-3.5 w-3.5" /> Add part
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {pending}
                          <div className="text-xs text-muted-foreground">of {it.quantity_ordered}</div>
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} max={pending} value={r.qty || ""}
                            placeholder={String(pending)}
                            onChange={(e) => setRow(it.id, { qty: Number(e.target.value) })}
                            className="h-8 text-right" disabled={pending <= 0} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} max={pending} value={r.rejected || ""}
                            placeholder="0"
                            onChange={(e) => setRow(it.id, { rejected: Number(e.target.value) })}
                            className="h-8 text-right" disabled={pending <= 0} />
                        </TableCell>
                        <TableCell>
                          <Select value={r.reason} onValueChange={(v) => setRow(it.id, { reason: v })} disabled={!r.rejected}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Why rejected?" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_REASON}>No rejection</SelectItem>
                              {REJECTION_REASONS.map((reason) => (
                                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {r.rejected > 0 && (
                            <Input className="h-8 mt-1" value={r.note} placeholder="Note (optional)"
                              onChange={(e) => setRow(it.id, { note: e.target.value })} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Select value={r.location} onValueChange={(v) => setRow(it.id, { location: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(part?.locations ?? []).map((l) => (
                                <SelectItem key={l.id} value={l.id}>{l.location_type}: {l.label} ({l.quantity})</SelectItem>
                              ))}
                              <SelectItem value={NEW_LOCATION}>New location…</SelectItem>
                            </SelectContent>
                          </Select>
                          {r.location === NEW_LOCATION && (
                            <Input className="h-8 mt-1" value={r.newLabel}
                              onChange={(e) => setRow(it.id, { newLabel: e.target.value })}
                              placeholder="Basement Store 11 - Rack B3" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input className="h-8" value={r.lot} onChange={(e) => setRow(it.id, { lot: e.target.value })} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !po}>{saving ? "Posting…" : "Post GRN for quality review"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quickAdd} onOpenChange={(v) => !v && setQuickAdd(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add {quickAdd?.mpn} to inventory</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Fill in what you know — you can skip and finish later. Either way the part shows up in the review list on the inventory page.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Part name</Label>
              <Input value={qaName} onChange={(e) => setQaName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Manufacturer</Label>
              <Input value={qaManufacturer} onChange={(e) => setQaManufacturer(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={qaCategory} onValueChange={setQaCategory}>
                <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_REASON}>Decide later (Uncategorized)</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => saveQuickAdd(true)} disabled={qaBusy}>Skip for now</Button>
            <Button onClick={() => saveQuickAdd(false)} disabled={qaBusy}>Save part</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
