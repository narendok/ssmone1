import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, Link2, Search, RotateCcw, Copy, Share2, ShoppingCart, Sparkles, FolderPlus, Save, Loader2, ClipboardCheck } from "lucide-react";
import { saveProjectBom, loadProjectBom } from "@/lib/project-bom.functions";
import { fetchProjectFilesByType, type DriveNode } from "@/lib/drive";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAllSubstituteMap, linkSubstitute, type SubstituteRef } from "@/lib/substitutes";
import {
  parseBomFile,
  parseCsvText,
  guessMapping,
  toLines,
  matchBom,
  matchesToRows,
  shortageRows,
  inventoryRows,
  sampleTemplateRows,
  toCsv,
  downloadCsv,
  downloadXlsx,
  calculatedLineCost,
  hasTotalCostMismatch,
  type BomMapping,
  type BomMatch,
  type ParsedSheet,
  type StockPart,
} from "@/lib/bom";
import { shareRows, rowsToMarkdown, type ShareRow } from "@/lib/bom-share";
import { ShareLinkDialog } from "@/components/inventory/ShareLinkDialog";
import { CreatePODialog, type PoDraftLine } from "@/components/procurement/CreatePODialog";
import { InvoiceImportDialog } from "@/components/inventory/InvoiceImportDialog";
import { InventoryCsvReviewDialog } from "@/components/inventory/InventoryCsvReviewDialog";
import { fetchProjects } from "@/lib/projects";


export const Route = createFileRoute("/_authenticated/bom")({
  component: BomPage,
  validateSearch: (search: Record<string, unknown>) => {
    const v = typeof search?.loadBom === "string" ? search.loadBom : undefined;
    const projectId = typeof search?.projectId === "string" ? search.projectId : undefined;
    return { ...(v ? { loadBom: v } : {}), ...(projectId ? { projectId } : {}) };
  },
  head: () => ({
    meta: [
      { title: "BOM import & export — PartsBench" },
      { name: "description", content: "Import a CSV or Excel BOM, match every line to stocked parts, surface substitutes for shortages, and export matched BOMs, shortage lists and inventory." },
      { property: "og:title", content: "BOM import & export — PartsBench" },
      { property: "og:description", content: "Match BOM line items to your component stock and link suggested substitutes automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MAP_FIELDS: { key: keyof BomMapping; label: string }[] = [
  { key: "mpn", label: "Part number / MPN" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "quantity", label: "Quantity" },
  { key: "refs", label: "Reference designators" },
  { key: "value", label: "Comment / value" },
  { key: "description", label: "Description / value" },
  { key: "footprint", label: "Footprint / package" },
  { key: "remark", label: "Remark" },
  { key: "unitCost", label: "Unit cost" },
  { key: "totalCost", label: "Total cost" },
];

function BomPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<BomMapping | null>(null);
  const [pasted, setPasted] = useState("");
  const [matches, setMatches] = useState<BomMatch[] | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [picking, setPicking] = useState<BomMatch | null>(null);
  const [linking, setLinking] = useState(false);
  const [sharing, setSharing] = useState<ShareRow[] | null>(null);
  const [poOpen, setPoOpen] = useState(false);
  const [poLines, setPoLines] = useState<PoDraftLine[] | undefined>(undefined);
  const [projectId, setProjectId] = useState<string>("__none");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [inventoryCsvOpen, setInventoryCsvOpen] = useState(false);
  const [linkingProject, setLinkingProject] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveRevision, setSaveRevision] = useState("");
  const [sourceDriveNodeId, setSourceDriveNodeId] = useState("none");
  const [saving, setSaving] = useState(false);
  const [savedLink, setSavedLink] = useState<{ bom_number: string; project_id: string } | null>(null);

  const loadBomId = (useSearch({ strict: false }) as any)?.loadBom as string | undefined;
  const projectFromSearch = (useSearch({ strict: false }) as any)?.projectId as string | undefined;
  const loadFn = useServerFn(loadProjectBom);
  const saveFn = useServerFn(saveProjectBom);

  const { data: projectBomFiles = [] } = useQuery({
    queryKey: ["project_bom_source_files", activeProject?.id],
    queryFn: () => fetchProjectFilesByType(activeProject?.id ?? "", ["BOM", "SPREADSHEET"]),
    enabled: Boolean(activeProject?.id),
  });

  useEffect(() => {
    if (!loadBomId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await loadFn({ data: { bomId: loadBomId } });
        if (cancelled) return;
        const rows = res.lines.map((l) => ({
          "Comment(value)": l.value,
          "Manufacturer-Part-Number": l.mpn,
          Manufacturer: l.manufacturer,
          Description: l.description,
          Designator: l.refs,
          Footprint: l.footprint,
          Quantity: String(l.quantity),
          Remark: l.remark,
          "Unit-Cost": l.unitCost == null ? "" : String(l.unitCost),
          "Total-Cost": l.totalCost == null ? "" : String(l.totalCost),
        }));
        const headers = rows.length ? Object.keys(rows[0]) : [];
        setFileName(res.header.source_filename || res.header.name || `${res.header.bom_number}.csv`);
        setSheet({ headers, rows });
        setMapping(guessMapping(headers));
        setMatches(null);
        setOverrides({});
        setProjectId(res.header.project_id);
        toast.info(`Loaded ${res.header.bom_number}. Click “Match against stock” to refresh against current inventory.`);
      } catch (e: any) {
        toast.error(e?.message ?? "Could not load that BOM");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadBomId]);

  useEffect(() => {
    if (projectFromSearch && !loadBomId) setProjectId(projectFromSearch);
  }, [projectFromSearch, loadBomId]);

  async function confirmSaveBom() {
    if (!activeProject) return toast.error("Pick a project first");
    if (!matches) return toast.error("Match the BOM first");
    const name = saveName.trim() || fileName.replace(/\.[^.]+$/, "") || "BOM";
    const items = resolved.map((m) => ({
      line_index: m.line.index,
      mpn: m.line.mpn || null,
      manufacturer: m.line.manufacturer || null,
      value: m.line.value || null,
      description: m.line.description || null,
      refs: m.line.refs || null,
      footprint: m.line.footprint || null,
      quantity: m.line.quantity,
      remark: m.line.remark || null,
      unit_cost: m.line.unitCost,
      total_cost: calculatedLineCost(m.line) ?? m.line.totalCost ?? null,
      matched_component_id: m.part?.id ?? null,
      match_status: m.kind,
      shortage: m.shortage,
    }));
    setSaving(true);
    try {
      const res = await saveFn({
        data: {
          project_id: activeProject.id,
          name,
          source_filename: fileName || null,
          revision: saveRevision.trim() || null,
          notes: null,
          source_drive_node_id: sourceDriveNodeId === "none" ? null : sourceDriveNodeId,
          items,
        },
      });
      toast.success(`Saved ${res.bom_number} to ${activeProject.name}`);
      setSavedLink({ bom_number: res.bom_number, project_id: activeProject.id });
      setSaveOpen(false); setSourceDriveNodeId("none");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the BOM");
    } finally {
      setSaving(false);
    }
  }


  const { data: parts = [] } = useQuery({
    queryKey: ["bom_parts"],
    queryFn: async (): Promise<StockPart[]> => {
      const { data, error } = await supabase
        .from("components")
        .select("id, name, part_number, manufacturer, footprint, package_case, value, supplier_url, datasheet_url, low_stock_threshold, category:categories(name), locations(location_type,label,quantity)");
      if (error) throw error;
      return (data as any[]).map((c) => ({
        ...c,
        category_name: c.category?.name ?? null,
        total_quantity: (c.locations ?? []).reduce((s: number, l: any) => s + (l.quantity ?? 0), 0),
      })) as StockPart[];
    },
  });

  const { data: substituteMap = new Map<string, SubstituteRef[]>() } = useQuery({
    queryKey: ["component_substitutes_map"],
    queryFn: fetchAllSubstituteMap,
  });

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  const { data: categoryOptions = [] } = useQuery({
    queryKey: ["category_options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, parent_id").order("sort_order");
      if (error) throw error;
      const rows = (data ?? []) as { id: string; name: string; parent_id: string | null }[];
      const byId = new Map(rows.map((r) => [r.id, r]));
      return rows.map((r) => {
        const parts = [r.name];
        let cur = r.parent_id ? byId.get(r.parent_id) : undefined;
        let guard = 0;
        while (cur && guard++ < 5) {
          parts.unshift(cur.name);
          cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
        }
        return { id: r.id, label: parts.join(" > ") };
      });
    },
  });

  const activeProject = projects.find((p) => p.id === projectId) ?? null;

  const partById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  const resolved = useMemo(() => {
    if (!matches) return [];
    return matches.map((m) => {
      const ov = overrides[m.line.index];
      if (!ov) return m;
      const part = partById.get(ov) ?? null;
      return {
        ...m,
        part,
        kind: part ? ("substitute" as const) : m.kind,
        shortage: Math.max(0, m.line.quantity - (part?.total_quantity ?? 0)),
      };
    });
  }, [matches, overrides, partById]);

  const stats = useMemo(() => {
    const s = { exact: 0, close: 0, substitute: 0, missing: 0, short: 0 };
    for (const m of resolved) {
      s[m.kind]++;
      if (m.shortage > 0) s.short++;
    }
    return s;
  }, [resolved]);

  async function onFile(file: File) {
    try {
      const parsed = await parseBomFile(file);
      if (!parsed.rows.length) return toast.error("No data rows found in that file");
      setFileName(file.name);
      setSheet(parsed);
      setMapping(guessMapping(parsed.headers));
      setMatches(null);
      setOverrides({});
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read that file");
    }
  }

  function onPaste() {
    const parsed = parseCsvText(pasted);
    if (!parsed.rows.length) return toast.error("Could not parse that CSV text");
    setFileName("pasted-bom.csv");
    setSheet(parsed);
    setMapping(guessMapping(parsed.headers));
    setMatches(null);
    setOverrides({});
  }

  function runMatch() {
    if (!sheet || !mapping) return;
    if (!mapping.mpn) return toast.error("Pick the part number column first");
    const lines = toLines(sheet.rows, mapping);
    if (!lines.length) return toast.error("No usable BOM lines");
    setMatches(matchBom(lines, parts, substituteMap));
    setOverrides({});
  }

  function reset() {
    setSheet(null); setMapping(null); setMatches(null); setOverrides({}); setFileName(""); setPasted("");
  }

  async function saveSubstituteLinks() {
    const links = resolved.filter((m) => m.kind === "substitute" && m.part && m.viaFor && m.part.id !== m.viaFor.id);
    if (!links.length) return toast.error("No substitute-resolved lines to link");
    setLinking(true);
    try {
      const note = `From BOM ${fileName} (${new Date().toLocaleDateString()})`;
      for (const m of links) await linkSubstitute(m.viaFor!.id, m.part!.id, note);
      toast.success(`Linked ${links.length} substitute${links.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save substitute links");
    } finally {
      setLinking(false);
    }
  }

  const base = fileName.replace(/\.[^.]+$/, "") || "bom";

  function compatibilityRows() {
    const picked = resolved.map((m) => m.part).filter(Boolean) as StockPart[];
    const unique = Array.from(new Map(picked.map((p) => [p.id, p])).values());
    return shareRows(
      unique.map((p) => ({ ...p, category_name: p.category_name ?? null })),
      substituteMap,
    );
  }

  async function copyCompatibility() {
    const rows = compatibilityRows();
    if (!rows.length) return toast.error("No matched components to copy");
    try {
      await navigator.clipboard.writeText(rowsToMarkdown(rows));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard not available");
    }
  }

  function shortageDraft(): PoDraftLine[] {
    const byMpn = new Map<string, PoDraftLine>();
    for (const m of resolved) {
      const need = m.kind === "missing" ? m.line.quantity : m.shortage;
      if (need <= 0) continue;
      const mpn = (m.line.mpn || m.part?.part_number || m.line.description || "").trim();
      if (!mpn) continue;
      const existing = byMpn.get(mpn);
      if (existing) {
        existing.quantity_ordered += need;
        continue;
      }
      byMpn.set(mpn, {
        component_id: m.part?.id ?? null,
        mpn,
        description: m.part?.name ?? m.line.description ?? "",
        quantity_ordered: need,
        unit_cost: m.line.unitCost ?? 0,
        on_hand: m.part?.total_quantity ?? 0,
      });
    }
    return Array.from(byMpn.values());
  }

  function generatePo() {
    const draft = shortageDraft();
    if (!draft.length) return toast.error("No shortages to order");
    setPoLines(draft);
    setPoOpen(true);
  }

  async function linkMatchedToProject() {
    if (!activeProject) return toast.error("Pick a project first");
    const ids = Array.from(new Set(resolved.map((m) => m.part?.id).filter(Boolean) as string[]));
    if (!ids.length) return toast.error("No matched parts to link");
    setLinkingProject(true);
    try {
      const { error } = await (supabase as any)
        .from("component_projects")
        .upsert(
          ids.map((component_id) => ({ component_id, project_id: activeProject.id })),
          { onConflict: "component_id,project_id" },
        );
      if (error) throw error;
      toast.success(`Linked ${ids.length} part(s) to ${activeProject.name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not link parts to the project");
    } finally {
      setLinkingProject(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BOM &amp; purchase import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Import a project BOM from Altium or Excel, or read a purchase invoice straight into stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setInvoiceOpen(true)}>
            <Sparkles className="h-4 w-4" /> Smart purchase import
          </Button>
          <Button variant="outline" onClick={() => setInventoryCsvOpen(true)}>
            <ClipboardCheck className="h-4 w-4" /> Review inventory CSV
          </Button>
          <Button variant="outline" onClick={() => downloadCsv(inventoryRows(parts, substituteMap), "inventory.csv")}>
            <Download className="h-4 w-4" /> Inventory CSV
          </Button>
          <Button variant="outline" onClick={() => downloadXlsx(inventoryRows(parts, substituteMap), "inventory.xlsx", "Inventory")}>
            <Download className="h-4 w-4" /> Inventory Excel
          </Button>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[260px]">
          <div className="text-xs text-muted-foreground">Project this BOM belongs to</div>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Pick a project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">One-off check (no project)</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.code} · {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground pb-2">
          {activeProject
            ? `Matched parts can be linked to ${activeProject.name} in one click after matching.`
            : "Pick a project to link matched parts to it, or keep it as a one-off stock check."}
        </p>
      </Card>


      {!sheet && (
        <Card className="p-6 space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          >
            <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="mt-2 font-medium">Drop a BOM file or click to browse</div>
            <div className="text-xs text-muted-foreground">CSV, XLSX or XLS</div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Need the format? Get a sample template:</span>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(sampleTemplateRows(), "bom-template.csv")}>
              <Download className="h-4 w-4" /> Template CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadXlsx(sampleTemplateRows(), "bom-template.xlsx", "BOM")}>
              <Download className="h-4 w-4" /> Template Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const parsed = parseCsvText(toCsv(sampleTemplateRows()));
                setFileName("bom-template.csv");
                setSheet(parsed);
                setMapping(guessMapping(parsed.headers));
                setMatches(null);
                setOverrides({});
              }}
            >
              <Upload className="h-4 w-4" /> Load sample now
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">…or paste CSV text</div>
            <Textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Comment(value),Manufacturer-Part-Number,Manufacturer,Description,Designator,Footprint,Quantity,Remark,Unit-Cost,Total-Cost" />
            <Button variant="secondary" disabled={!pasted.trim()} onClick={onPaste}>
              <Upload className="h-4 w-4" /> Use pasted CSV
            </Button>
          </div>
        </Card>
      )}

      {sheet && mapping && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="font-medium">{fileName}</span>{" "}
              <span className="text-muted-foreground">· {sheet.rows.length} rows</span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /> Start over</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MAP_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <div className="text-xs text-muted-foreground">{f.label}</div>
                <Select
                  value={mapping[f.key] || "__none"}
                  onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "__none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Not mapped" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not mapped</SelectItem>
                    {sheet.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <Button onClick={runMatch}><Search className="h-4 w-4" /> Match against stock</Button>
        </Card>
      )}

      {matches && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-success text-success-foreground">{stats.exact} exact</Badge>
            <Badge variant="secondary">{stats.close} close</Badge>
            <Badge className="bg-warning text-warning-foreground">{stats.substitute} via substitute</Badge>
            <Badge variant="destructive">{stats.missing} missing</Badge>
            <span className="text-sm text-muted-foreground">{stats.short} line(s) short on stock</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCsv(shortageRows(resolved), `${base}-shortages.csv`)}>
                <Download className="h-4 w-4" /> Shortage CSV
              </Button>
              <Button variant="outline" size="sm" onClick={generatePo}>
                <ShoppingCart className="h-4 w-4" /> Generate PO from shortages
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadCsv(matchesToRows(resolved), `${base}-matched.csv`)}>
                <Download className="h-4 w-4" /> Matched CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadXlsx(matchesToRows(resolved), `${base}-matched.xlsx`, "BOM")}>
                <Download className="h-4 w-4" /> Matched Excel
              </Button>
              <Button variant="outline" size="sm" onClick={copyCompatibility}>
                <Copy className="h-4 w-4" /> Copy with substitutes
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSharing(compatibilityRows())}>
                <Share2 className="h-4 w-4" /> Share link
              </Button>
              {activeProject && (
                <Button variant="outline" size="sm" disabled={linkingProject} onClick={linkMatchedToProject}>
                  <FolderPlus className="h-4 w-4" /> Link matched to {activeProject.code}
                </Button>
              )}
              <Button
                size="sm"
                disabled={!activeProject || saving}
                onClick={() => { setSaveName(fileName.replace(/\.[^.]+$/, "") || "BOM"); setSaveRevision(""); setSaveOpen(true); }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save BOM to project
              </Button>
              <Button size="sm" disabled={linking} onClick={saveSubstituteLinks}>
                <Link2 className="h-4 w-4" /> Save substitute links
              </Button>
            </div>

          </div>

          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Refs</TableHead>
                  <TableHead>BOM part</TableHead>
                  <TableHead className="text-right">Need</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Matched component</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Short</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolved.map((m) => (
                  <TableRow key={m.line.index}>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{m.line.refs || "—"}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{m.line.mpn || "—"}</div>
                      <div className="text-xs text-muted-foreground">{m.line.manufacturer || m.line.description || m.line.value}</div>
                    </TableCell>
                    <TableCell className="text-right">{m.line.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px]">{m.line.remark || "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap text-xs">
                      {m.line.unitCost == null ? "—" : (
                        <>
                          <div>{m.line.unitCost.toFixed(2)} each</div>
                          <div className={hasTotalCostMismatch(m.line) ? "text-destructive font-semibold" : "text-muted-foreground"}>
                            {calculatedLineCost(m.line)?.toFixed(2)} total
                            {hasTotalCostMismatch(m.line) ? ` · supplied ${m.line.totalCost?.toFixed(2)}` : ""}
                          </div>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.part ? (
                        <>
                          <div className="font-medium text-sm">{m.part.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{m.part.part_number}</div>
                          {m.viaFor && <div className="text-xs text-warning">substitute for {m.viaFor.part_number}</div>}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No match in stock</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{m.part?.total_quantity ?? 0}</TableCell>
                    <TableCell className="text-right">{m.shortage > 0 ? <span className="text-destructive font-semibold">{m.shortage}</span> : "—"}</TableCell>
                    <TableCell><KindBadge kind={m.kind} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setPicking(m)}>Pick…</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {picking && (
        <PickDialog
          match={picking}
          parts={parts}
          onClose={() => setPicking(null)}
          onPick={(id) => {
            setOverrides((o) => ({ ...o, [picking.line.index]: id }));
            setPicking(null);
          }}
        />
      )}

      {sharing && (
        <ShareLinkDialog
          rows={sharing}
          defaultTitle={`${base} — matched parts with substitutes`}
          onOpenChange={(o) => { if (!o) setSharing(null); }}
        />
      )}

      <CreatePODialog open={poOpen} onOpenChange={setPoOpen} prefill={poLines} />
      <InvoiceImportDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        parts={parts}
        categories={categoryOptions}
        projects={projects}
        defaultProjectId={projectId === "__none" ? null : projectId}
      />
      <InventoryCsvReviewDialog
        open={inventoryCsvOpen}
        onOpenChange={setInventoryCsvOpen}
        parts={parts}
        categories={categoryOptions}
      />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save BOM to project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Project</div>
              <div className="text-sm font-medium">{activeProject ? `${activeProject.code} · ${activeProject.name}` : "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">BOM name</div>
              <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Mainboard BOM" />
              <div className="text-[11px] text-muted-foreground">Saving again with the same name updates that BOM in place.</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Revision (optional)</div>
              <Input value={saveRevision} onChange={(e) => setSaveRevision(e.target.value)} placeholder="e.g. A, B, Rev 2" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmSaveBom} disabled={saving || !saveName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {savedLink && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2 shadow-lg">
            <Save className="h-4 w-4 text-success" />
            <span className="text-sm">Saved <span className="font-mono">{savedLink.bom_number}</span></span>
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link to="/projects/$projectId" params={{ projectId: savedLink.project_id }}>View on project →</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-auto p-0 px-1" onClick={() => setSavedLink(null)}>×</Button>
          </div>
        </div>
      )}

    </div>
  );
}

function KindBadge({ kind }: { kind: BomMatch["kind"] }) {
  if (kind === "exact") return <Badge className="bg-success text-success-foreground hover:bg-success/90">Exact</Badge>;
  if (kind === "close") return <Badge variant="secondary">Close</Badge>;
  if (kind === "substitute") return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Substitute</Badge>;
  return <Badge variant="destructive">Missing</Badge>;
}

function PickDialog({
  match, parts, onClose, onPick,
}: { match: BomMatch; parts: StockPart[]; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    if (!q.trim()) return match.candidates.length ? match.candidates : parts.slice(0, 30);
    const s = q.toLowerCase();
    return parts
      .filter((p) => p.name.toLowerCase().includes(s) || p.part_number.toLowerCase().includes(s) || (p.manufacturer ?? "").toLowerCase().includes(s))
      .slice(0, 50);
  }, [q, parts, match.candidates]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a part for {match.line.mpn || match.line.description}</DialogTitle>
        </DialogHeader>
        <Input autoFocus placeholder="Search inventory…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-[50vh] overflow-y-auto divide-y">
          {list.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No components found</div>}
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="w-full text-left py-2 px-1 hover:bg-accent flex items-center justify-between gap-3"
            >
              <span>
                <span className="font-medium text-sm">{p.name}</span>{" "}
                <span className="font-mono text-xs text-muted-foreground">{p.part_number}</span>
                <span className="block text-xs text-muted-foreground">{p.manufacturer ?? "—"} · {p.footprint ?? p.package_case ?? "—"}</span>
              </span>
              <span className={`text-sm font-semibold ${p.total_quantity >= match.line.quantity ? "text-success" : "text-destructive"}`}>
                {p.total_quantity}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
