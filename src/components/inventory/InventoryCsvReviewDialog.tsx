import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { approveInventoryCsvRows } from "@/lib/inventory-csv-import.functions";
import { guessInventoryMapping, isInventoryDraftValid, refreshInventoryDraftWarnings, toInventoryDraftRows, type CategoryChoice, type InventoryCsvMapping, type InventoryDraftRow, type MappingConfidence } from "@/lib/inventory-csv-import";
import { parseBomFile, parseCsvText, type ParsedSheet, type StockPart } from "@/lib/bom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const fields: { key: keyof InventoryCsvMapping; label: string; required?: boolean }[] = [
  { key: "partNumber", label: "Part number / MPN", required: true }, { key: "name", label: "Name / description", required: true },
  { key: "manufacturer", label: "Manufacturer" }, { key: "footprint", label: "Footprint" }, { key: "category", label: "Category" },
  { key: "quantity", label: "On hand / quantity", required: true }, { key: "location", label: "Location / bin", required: true },
  { key: "lowStockThreshold", label: "Low stock threshold" }, { key: "stockStatus", label: "Stock status" }, { key: "substitutes", label: "Substitutes" },
  { key: "supplierUrl", label: "Supplier URL" }, { key: "datasheetUrl", label: "Datasheet URL" },
];

const locations = ["basement", "lab", "rack", "drawer", "bin", "shelf", "store"];

function ConfidenceBadge({ value }: { value: MappingConfidence }) {
  return <Badge variant={value === "high" ? "default" : "secondary"} className="ml-1 text-[10px]">{value}</Badge>;
}

export function InventoryCsvReviewDialog({ open, onOpenChange, parts, categories }: { open: boolean; onOpenChange: (open: boolean) => void; parts: StockPart[]; categories: CategoryChoice[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const approve = useServerFn(approveInventoryCsvRows);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<InventoryCsvMapping | null>(null);
  const [confidence, setConfidence] = useState<Record<keyof InventoryCsvMapping, MappingConfidence> | null>(null);
  const [rows, setRows] = useState<InventoryDraftRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [requestKeys, setRequestKeys] = useState<Record<number, string>>({});
  const [pasted, setPasted] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() { setSheet(null); setMapping(null); setConfidence(null); setRows([]); setSelected(new Set()); setRequestKeys({}); setPasted(""); }
  function load(parsed: ParsedSheet) {
    const guessed = guessInventoryMapping(parsed.headers);
    setSheet(parsed); setMapping(guessed.mapping); setConfidence(guessed.confidence); setRows([]); setSelected(new Set());
  }
  async function onFile(file: File) { try { load(await parseBomFile(file)); } catch (error: any) { toast.error(error?.message ?? "Could not read that file"); } }
  function buildRows() {
    if (!sheet || !mapping) return;
    const drafts = toInventoryDraftRows(sheet.rows, mapping, parts, categories);
    setRows(drafts); setSelected(new Set(drafts.filter(isInventoryDraftValid).map((row) => row.key)));
  }
  function patch(key: number, value: Partial<InventoryDraftRow>) {
    setRows((current) => refreshInventoryDraftWarnings(current.map((row) => row.key === key ? { ...row, ...value } : row)));
  }
  const validRows = rows.filter(isInventoryDraftValid);
  const selectedRows = validRows.filter((row) => selected.has(row.key));
  async function submit() {
    if (!selectedRows.length) return;
    setSaving(true);
    try {
      const keys = { ...requestKeys };
      selectedRows.forEach((row) => { if (!keys[row.key]) keys[row.key] = crypto.randomUUID(); });
      setRequestKeys(keys);
      const result = await approve({ data: { rows: selectedRows.flatMap((row) => row.categoryId ? [{ idempotencyKey: keys[row.key], partNumber: row.partNumber, name: row.name, manufacturer: row.manufacturer || null, categoryId: row.categoryId, footprint: row.footprint || null, quantity: row.quantity, locationType: row.locationType, locationLabel: row.locationLabel, lowStockThreshold: row.lowStockThreshold, supplierUrl: row.supplierUrl || null, datasheetUrl: row.datasheetUrl || null }] : []) } });
      const failed = result.results.filter((item) => !item.ok);
      const succeeded = result.results.length - failed.length;
      queryClient.invalidateQueries();
      if (succeeded) toast.success(`${succeeded} inventory row${succeeded === 1 ? "" : "s"} approved`);
      if (failed.length) toast.error(`${failed.length} row${failed.length === 1 ? "" : "s"} failed: ${failed[0].error}`);
      setSelected(new Set(failed.map((item) => rows.find((row) => row.partNumber === item.partNumber)?.key).filter((key): key is number => key != null)));
    } catch (error: any) { toast.error(error?.message ?? "Could not approve the selected rows"); } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={(value) => { if (!value) reset(); onOpenChange(value); }}>
    <DialogContent className="max-w-[96vw] max-h-[92vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Review inventory CSV</DialogTitle></DialogHeader>
      {!sheet && <div className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) onFile(file); }}>
          <FileUp className="h-8 w-8 mx-auto text-muted-foreground" /><div className="mt-2 font-medium">Drop an inventory CSV or spreadsheet</div><div className="text-xs text-muted-foreground">Nothing is added until rows are selected and approved.</div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} />
        </div>
        <div className="space-y-2"><Label>Or paste CSV text</Label><Textarea value={pasted} rows={4} onChange={(event) => setPasted(event.target.value)} /><Button variant="secondary" disabled={!pasted.trim()} onClick={() => load(parseCsvText(pasted))}>Review pasted CSV</Button></div>
      </div>}
      {sheet && mapping && !rows.length && <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Map the available headers before creating a review list. Low-confidence fields should be checked.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map((field) => <div className="space-y-1" key={field.key}><Label className="text-xs">{field.label}{field.required ? " *" : ""}<ConfidenceBadge value={confidence?.[field.key] ?? "none"} /></Label><Select value={mapping[field.key] || "__none"} onValueChange={(value) => { setMapping({ ...mapping, [field.key]: value === "__none" ? "" : value }); setConfidence({ ...(confidence ?? {} as Record<keyof InventoryCsvMapping, MappingConfidence>), [field.key]: value === "__none" ? "none" : "high" }); }}><SelectTrigger><SelectValue placeholder="Not mapped" /></SelectTrigger><SelectContent><SelectItem value="__none">Not mapped</SelectItem>{sheet.headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}</SelectContent></Select></div>)}</div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={reset}>Start over</Button><Button onClick={buildRows}>Create review list</Button></div>
      </div>}
      {rows.length > 0 && <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm text-muted-foreground">{validRows.length} valid of {rows.length} reviewed rows</div><div className="flex gap-2"><Button variant="outline" onClick={() => { setRows([]); setSelected(new Set()); }}>Adjust mapping</Button><Button variant="outline" onClick={reset}>Start over</Button><Button disabled={!selectedRows.length || saving} onClick={submit}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Approve {selectedRows.length} selected</Button></div></div>
        {!categories.length && <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />Inventory categories must be created before CSV rows can be approved.</div>}
        <div className="rounded-lg border overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={validRows.length > 0 && selectedRows.length === validRows.length} onCheckedChange={(value) => setSelected(value ? new Set(validRows.map((row) => row.key)) : new Set())} aria-label="Select all valid rows" /></TableHead><TableHead>Part / details</TableHead><TableHead>Category</TableHead><TableHead className="w-24">Qty</TableHead><TableHead>Location</TableHead><TableHead className="w-24">Low stock</TableHead><TableHead>Review</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => { const valid = isInventoryDraftValid(row); return <TableRow key={row.key} className={!valid ? "bg-destructive/5" : ""}><TableCell><Checkbox checked={selected.has(row.key)} disabled={!valid} onCheckedChange={(value) => setSelected((current) => { const next = new Set(current); if (value) next.add(row.key); else next.delete(row.key); return next; })} aria-label={`Select ${row.partNumber || "row"}`} /></TableCell><TableCell className="min-w-[270px] space-y-1"><Input className="h-8 font-mono text-xs" value={row.partNumber} placeholder="Part number" onChange={(event) => patch(row.key, { partNumber: event.target.value })} /><Input className="h-8 text-xs" value={row.name} placeholder="Name / description" onChange={(event) => patch(row.key, { name: event.target.value })} /><Input className="h-7 text-xs" value={row.manufacturer} placeholder="Manufacturer" onChange={(event) => patch(row.key, { manufacturer: event.target.value })} /></TableCell><TableCell className="min-w-[180px]"><Select value={row.categoryId ?? "__none"} onValueChange={(value) => patch(row.key, { categoryId: value === "__none" ? null : value })}><SelectTrigger className="h-8"><SelectValue placeholder="Uncategorized" /></SelectTrigger><SelectContent><SelectItem value="__none">Uncategorized</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>)}</SelectContent></Select><Input className="h-7 mt-1 text-xs" value={row.footprint} placeholder="Footprint" onChange={(event) => patch(row.key, { footprint: event.target.value })} /></TableCell><TableCell><Input className="h-8" type="number" min={1} value={row.quantity || ""} onChange={(event) => patch(row.key, { quantity: Number(event.target.value) || 0 })} /></TableCell><TableCell className="min-w-[190px]"><Select value={row.locationType} onValueChange={(value) => patch(row.key, { locationType: value })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{locations.map((location) => <SelectItem key={location} value={location}>{location}</SelectItem>)}</SelectContent></Select><Input className="h-7 mt-1 text-xs" value={row.locationLabel} placeholder="Bin or store" onChange={(event) => patch(row.key, { locationLabel: event.target.value })} /></TableCell><TableCell><Input className="h-8" type="number" min={0} value={row.lowStockThreshold} onChange={(event) => patch(row.key, { lowStockThreshold: Math.max(0, Number(event.target.value) || 0) })} /></TableCell><TableCell className="min-w-[200px]">{row.warnings.length ? <div className="space-y-1 text-xs text-destructive">{row.warnings.map((warning) => <div className="flex gap-1" key={warning}><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{warning}</div>)}</div> : <div className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{row.matchLabel ? `Matches ${row.matchLabel}` : "Ready to create"}</div>}</TableCell></TableRow>; })}</TableBody></Table></div>
      </div>}
    </DialogContent>
  </Dialog>;
}