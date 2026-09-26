import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { extractInvoiceFile, applyInvoiceImport, type ApplyInvoiceLine } from "@/lib/invoice-import.functions";
import { normalizeMpn, baseMpn, type StockPart } from "@/lib/bom";
import type { Project } from "@/lib/projects";

interface CategoryOption {
  id: string;
  label: string;
}

interface DraftLine extends ApplyInvoiceLine {
  key: number;
  matchedLabel: string | null;
}

const LOCATION_TYPES = ["basement", "lab", "rack", "drawer", "bin", "shelf"];

export function InvoiceImportDialog({
  open,
  onOpenChange,
  parts,
  categories,
  projects,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parts: StockPart[];
  categories: CategoryOption[];
  projects: Project[];
  defaultProjectId?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const extract = useServerFn(extractInvoiceFile);
  const apply = useServerFn(applyInvoiceImport);

  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "__none");
  const [enrich, setEnrich] = useState(true);
  const [locationType, setLocationType] = useState("basement");
  const [locationLabel, setLocationLabel] = useState("Store 11");
  const [lines, setLines] = useState<DraftLine[] | null>(null);

  const byExact = useMemo(() => {
    const m = new Map<string, StockPart>();
    for (const p of parts) {
      m.set(normalizeMpn(p.part_number), p);
      const b = baseMpn(p.part_number);
      if (!m.has(b)) m.set(b, p);
    }
    return m;
  }, [parts]);

  function reset() {
    setLines(null);
    setFileName("");
    setVendorName("");
    setInvoiceNumber("");
    setInvoiceDate("");
  }

  async function onFile(file: File) {
    setBusy(true);
    setFileName(file.name);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("Could not read that file"));
        fr.readAsDataURL(file);
      });
      const res = await extract({ data: { dataUrl, filename: file.name, mime: file.type } });
      if (!res.lines.length) {
        toast.error("No component lines found on that invoice");
        return;
      }
      setVendorName(res.vendor_name ?? "");
      setInvoiceNumber(res.invoice_number ?? "");
      setInvoiceDate(res.invoice_date ?? "");
      if (res.currency) setCurrency(res.currency);
      setLines(
        res.lines.map((l, i) => {
          const hit = byExact.get(normalizeMpn(l.mpn)) ?? byExact.get(baseMpn(l.mpn)) ?? null;
          return {
            key: i,
            idempotency_key: crypto.randomUUID(),
            component_id: hit?.id ?? null,
            mpn: l.mpn,
            name: hit?.name ?? l.description ?? l.mpn,
            manufacturer: l.manufacturer ?? hit?.manufacturer ?? null,
            category_id: l.category_id,
            package: l.package ?? hit?.footprint ?? null,
            quantity: l.quantity,
            unit_price: l.unit_price,
            location_type: locationType,
            location_label: locationLabel,
            matchedLabel: hit ? hit.part_number : null,
          };
        }),
      );
      toast.success(`Read ${res.lines.length} line${res.lines.length === 1 ? "" : "s"} from ${file.name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read that invoice");
    } finally {
      setBusy(false);
    }
  }

  function patch(key: number, p: Partial<DraftLine>) {
    setLines((ls) => (ls ? ls.map((l) => (l.key === key ? { ...l, ...p } : l)) : ls));
  }

  async function submit() {
    if (!lines?.length) return;
    const uncategorizedLines = lines.filter((line) => !line.category_id);
    if (uncategorizedLines.length) {
      toast.error("Choose a category for every part before adding stock");
      return;
    }
    setSaving(true);
    try {
      const res = await apply({
        data: {
          vendor_name: vendorName.trim() || null,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: invoiceDate || null,
          currency: currency || null,
          project_id: projectId === "__none" ? null : projectId,
          enrich,
          lines: lines.map((l) => ({
            component_id: l.component_id,
            idempotency_key: l.idempotency_key,
            mpn: l.mpn,
            name: l.name,
            manufacturer: l.manufacturer,
            category_id: l.category_id,
            package: l.package,
            quantity: l.quantity,
            unit_price: l.unit_price,
            location_type: locationType,
            location_label: locationLabel,
          })),
        },
      });
      qc.invalidateQueries();
      if (res.errors.length) toast.error(`${res.errors.length} line(s) failed: ${res.errors[0]}`);
      toast.success(
        `${res.unitsAdded} units added to ${locationLabel} · ${res.created} new part(s), ${res.updated} restocked`,
      );
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not import that invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Smart purchase import
          </DialogTitle>
        </DialogHeader>

        {!lines && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => !busy && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !busy) onFile(f); }}
            >
              {busy ? (
                <>
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  <div className="mt-2 font-medium">Reading {fileName}…</div>
                  <div className="text-xs text-muted-foreground">This can take up to a minute</div>
                </>
              ) : (
                <>
                  <FileUp className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div className="mt-2 font-medium">Drop a purchase invoice or click to browse</div>
                  <div className="text-xs text-muted-foreground">
                    PDF or photo — DigiKey, Mouser, Robu, LCSC or a local bill
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Parts are read with quantity and unit price, matched to stock and categorised automatically. Nothing is
              saved until you review and confirm.
            </p>
          </div>
        )}

        {lines && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Vendor</Label>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="DigiKey" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice number</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Storage area</Label>
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Location label</Label>
                <Input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Store 11 - Rack B3" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link to project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No project</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} · {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <Checkbox checked={enrich} onCheckedChange={(v) => setEnrich(!!v)} />
                <span className="flex items-center gap-1"><Wand2 className="h-3.5 w-3.5" /> Fill datasheet &amp; specs</span>
              </label>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right w-24">Qty</TableHead>
                    <TableHead className="text-right w-28">Unit price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell className="min-w-[220px]">
                        <Input
                          className="h-8 font-mono text-xs"
                          value={l.mpn}
                          onChange={(e) => patch(l.key, { mpn: e.target.value })}
                        />
                        <Input
                          className="h-7 mt-1 text-xs"
                          value={l.name}
                          onChange={(e) => patch(l.key, { name: e.target.value })}
                          placeholder="Name / description"
                        />
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <Select
                          value={l.category_id ?? "__none"}
                          onValueChange={(v) => patch(l.key, { category_id: v === "__none" ? null : v })}
                        >
                          <SelectTrigger className="h-8"><SelectValue placeholder="Choose category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Choose category</SelectItem>
                            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="h-8 text-right"
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => patch(l.key, { quantity: Number(e.target.value) || 1 })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="h-8 text-right"
                          type="number"
                          step="0.0001"
                          value={l.unit_price ?? ""}
                          onChange={(e) => patch(l.key, { unit_price: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        {l.component_id ? (
                          <Badge className="bg-success text-success-foreground">In stock · {l.matchedLabel}</Badge>
                        ) : (
                          <Badge variant="secondary">New part</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLines((ls) => (ls ?? []).filter((x) => x.key !== l.key))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={saving}>Start over</Button>
              <Button onClick={submit} disabled={saving || !lines.length || !locationLabel.trim() || lines.some((line) => !line.category_id)}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add {lines.reduce((s, l) => s + (l.quantity || 0), 0)} units to stock
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
