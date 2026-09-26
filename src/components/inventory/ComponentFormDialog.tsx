import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Search, Loader2, Eye, ExternalLink, Sparkles, CheckCircle2 } from "lucide-react";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supplierLookup, datasheetAiSearch, classifyCategory, type SupplierPart, type DatasheetCandidate } from "@/lib/supplier.functions";
import { recordProvenance } from "@/lib/automation.functions";
import type { Category, Component, Location } from "@/lib/inventory";
import { fetchProjects, fetchComponentProjectIds, syncComponentProjects } from "@/lib/projects";
import { fetchComponentSubstitutes, syncComponentSubstitutes } from "@/lib/substitutes";
import { SubstitutePicker, type SubstituteLink } from "./SubstitutePicker";
import { ProjectMultiSelect } from "./ProjectMultiSelect";
import { saveComponentWithStock } from "@/lib/component-save.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: (Component & { locations: Location[] }) | null;
  onSaved: (id: string) => void;
  defaultCategorySlug?: string;
}

interface LocRow { id?: string; location_type: string; label: string; quantity: number; _delete?: boolean }

const EMPTY_CATEGORIES: Category[] = [];

export function ComponentFormDialog({ open, onOpenChange, component, onSaved, defaultCategorySlug }: Props) {

  const isEdit = !!component;
  const [form, setForm] = useState({
    category_id: "",
    name: "",
    part_number: "",
    manufacturer: "",
    footprint: "",
    bom_compatibility: "",
    voltage_rating: "",
    current_rating: "",
    temperature_rating: "",
    cost: "",
    supplier: "",
    supplier_url: "",
    datasheet_url: "",
    notes: "",
    low_stock_threshold: 10,
  });
  const [locs, setLocs] = useState<LocRow[]>([{ location_type: "bag", label: "Bag 1", quantity: 0 }]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [substitutes, setSubstitutes] = useState<SubstituteLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [stockRequestKeys, setStockRequestKeys] = useState<Record<string, string>>({});
  const [looking, setLooking] = useState(false);
  const [fetchedPart, setFetchedPart] = useState<SupplierPart | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const lookup = useServerFn(supplierLookup);
  const classify = useServerFn(classifyCategory);
  const recordSource = useServerFn(recordProvenance);
  const saveWithStock = useServerFn(saveComponentWithStock);
  const [supplierSuggested, setSupplierSuggested] = useState(false);
  const [categorySuggested, setCategorySuggested] = useState(false);

  async function handleLookup() {
    if (!form.part_number.trim()) {
      toast.error("Enter a part number first");
      return;
    }
    setLooking(true);
    try {
      const res = await lookup({ data: { mpn: form.part_number.trim() } });
      if (!res.found) {
        toast.error("No match on Octopart");
        return;
      }
      const p = res.part;
      const specMatch = (re: RegExp) =>
        (p.specs ?? []).find((s: { name: string; value: string }) => re.test(s.name))?.value ?? "";
      setForm((f) => ({
        ...f,
        name: f.name || (p.description ?? p.mpn ?? ""),
        manufacturer: f.manufacturer || (p.manufacturer ?? ""),
        footprint: f.footprint || (p.package ?? ""),
        datasheet_url: f.datasheet_url || (p.datasheet_url ?? ""),
        supplier: f.supplier || "Mouser",
        supplier_url: f.supplier_url || (p.octopart_url ?? ""),
        notes: f.notes || (p.description ?? ""),
        voltage_rating: f.voltage_rating || specMatch(/voltage/i),
        current_rating: f.current_rating || specMatch(/current/i),
        temperature_rating: f.temperature_rating || specMatch(/temperature/i),
        cost: f.cost || specMatch(/price|cost/i),
      }));
      setFetchedPart(p);
      setSupplierSuggested(true);
      toast.success(`Found ${p.mpn} — ${p.manufacturer ?? ""}`);

      // Auto-select the closest matching category.
      try {
        const match = await classify({
          data: {
            mpn: p.mpn,
            manufacturer: p.manufacturer,
            description: p.description,
            category: p.category,
            package: p.package,
          },
        });
        if (match.categoryId) {
          setForm((f) => ({ ...f, category_id: match.categoryId ?? f.category_id }));
          setCategorySuggested(true);
          toast.success(`Category set to ${match.label}`);
        }
      } catch {
        // Category matching is best-effort.
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLooking(false);
    }
  }


  const { data: categories = EMPTY_CATEGORIES } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return (data ?? []) as Category[];
    },
  });

  const { data: allProjects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  useEffect(() => {
    setFetchedPart(null);
    setSupplierSuggested(false);
    setCategorySuggested(false);
    if (component) {
      setForm({
        category_id: component.category_id,
        name: component.name,
        part_number: component.part_number,
        manufacturer: component.manufacturer ?? "",
        footprint: component.footprint ?? component.package_case ?? "",
        bom_compatibility: component.bom_compatibility ?? "",
        voltage_rating: component.voltage_rating ?? "",
        current_rating: component.current_rating ?? "",
        temperature_rating: component.temperature_rating ?? "",
        cost: component.cost != null ? String(component.cost) : "",
        supplier: component.supplier ?? "",
        supplier_url: component.supplier_url ?? "",
        datasheet_url: component.datasheet_url ?? "",
        notes: component.notes ?? "",
        low_stock_threshold: component.low_stock_threshold,
      });
      setLocs(component.locations.map((l) => ({ id: l.id, location_type: l.location_type, label: l.label, quantity: l.quantity })));
      setStockRequestKeys({});
      fetchComponentProjectIds(component.id).then(setProjectIds).catch(() => setProjectIds([]));
      fetchComponentSubstitutes(component.id)
        .then((subs) =>
          setSubstitutes(
            subs.map((s) => ({ id: s.id, name: s.name, part_number: s.part_number, manufacturer: s.manufacturer, note: s.note }))
          )
        )
        .catch(() => setSubstitutes([]));
    } else {
      const preferred = defaultCategorySlug
        ? categories.find((c) => c.slug === defaultCategorySlug)?.id
        : undefined;
      setForm((f) => ({ ...f, category_id: preferred ?? categories[0]?.id ?? "" }));
      setProjectIds([]);
      setSubstitutes([]);
      setStockRequestKeys({});
    }
  }, [component, categories, defaultCategorySlug]);


  const preview = useMemo(() => {
    if (fetchedPart) {
      return {
        datasheetUrl: fetchedPart.datasheet_url,
        imageUrl: fetchedPart.image_url,
        description: fetchedPart.description,
        specs: fetchedPart.specs,
      };
    }
    if (component) {
      return {
        datasheetUrl: form.datasheet_url || component.datasheet_url,
        imageUrl: component.image_url,
        description: component.short_description || component.notes,
        specs: Array.isArray(component.specs) ? component.specs : [],
      };
    }
    return {
      datasheetUrl: form.datasheet_url,
      imageUrl: null,
      description: form.notes,
      specs: [],
    };
  }, [fetchedPart, component, form.datasheet_url, form.notes]);
  const previewAvailable = !!(preview.datasheetUrl || preview.specs.length > 0 || preview.description);

  async function handleSave() {
    if (!form.name || !form.part_number || !form.category_id) {
      toast.error("Name, part number, and category are required");
      return;
    }
    setSaving(true);
    try {
      const nextStockRequestKeys = { ...stockRequestKeys };
      if (component) {
        for (const location of locs) {
          const original = component.locations.find((saved) => saved.id === location.id);
          if (location.id && original && original.quantity !== location.quantity && !nextStockRequestKeys[location.id]) {
            nextStockRequestKeys[location.id] = crypto.randomUUID();
          }
        }
      }
      setStockRequestKeys(nextStockRequestKeys);
      const costNum = form.cost.trim() === "" ? null : Number(form.cost);
      const result = await saveWithStock({
        data: {
          id: component?.id,
          categoryId: form.category_id,
          name: form.name,
          partNumber: form.part_number,
          manufacturer: form.manufacturer.trim() || null,
          footprint: form.footprint.trim() || null,
          bomCompatibility: form.bom_compatibility.trim() || null,
          voltageRating: form.voltage_rating.trim() || null,
          currentRating: form.current_rating.trim() || null,
          temperatureRating: form.temperature_rating.trim() || null,
          cost: Number.isFinite(costNum) ? costNum : null,
          supplier: form.supplier.trim() || null,
          supplierUrl: form.supplier_url.trim() || null,
          datasheetUrl: form.datasheet_url.trim() || null,
          notes: form.notes.trim() || null,
          lowStockThreshold: form.low_stock_threshold,
          stockReason: "Component form stock update",
          stockRequestKeys: nextStockRequestKeys,
          locations: locs.filter((location) => location._delete || location.label.trim()).map((location) => ({
            id: location.id,
            locationType: location.location_type,
            label: location.label,
            quantity: location.quantity,
            delete: location._delete,
          })),
        },
      });
      const componentId = result.componentId;
      await syncComponentProjects(componentId, projectIds);
      try {
        await syncComponentSubstitutes(componentId, substitutes.map((s) => ({ id: s.id, note: s.note })));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save substitutes");
      }
      if (fetchedPart) {
        const sourceState = supplierSuggested ? "suggested" : "confirmed";
        await Promise.all([
          recordSource({ data: { entityType: "component", entityId: componentId, fieldKey: "supplier_lookup", sourceKind: "external", provider: "Mouser", sourceIdentifier: fetchedPart.mpn, sourceUrl: fetchedPart.octopart_url, valueSnapshot: fetchedPart, confidence: 1, state: sourceState } }),
          ...(categorySuggested ? [recordSource({ data: { entityType: "component", entityId: componentId, fieldKey: "category_id", sourceKind: "ai", provider: "Lovable AI", sourceIdentifier: fetchedPart.mpn, sourceUrl: null, valueSnapshot: { categoryId: form.category_id }, confidence: 0.6, state: "needs_review" } })] : []),
        ]);
      }
      toast.success(isEdit ? "Component updated" : "Component added");
      setStockRequestKeys({});
      onSaved(componentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Component could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!component) return;
    if (!confirm(`Delete ${component.name}? This removes all locations and history.`)) return;
    const { error } = await supabase.from("components").delete().eq("id", component.id);
    if (error) return toast.error(error.message);
    toast.success("Component deleted");
    onSaved(component.id);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { setPreviewOpen(false); onOpenChange(o); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit component" : "Add component"}</DialogTitle>
            <DialogDescription>PCB engineer-friendly fields including footprint, BOM compatibility, and supplier.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Category *">
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const parents = categories.filter((c) => !c.parent_id);
                    const byParent = new Map<string, Category[]>();
                    categories.forEach((c) => { if (c.parent_id) { const arr = byParent.get(c.parent_id) ?? []; arr.push(c); byParent.set(c.parent_id, arr); } });
                    return parents.flatMap((p) => [
                      <SelectItem key={p.id} value={p.id} className="font-semibold">{p.name}</SelectItem>,
                      ...(byParent.get(p.id) ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id} className="pl-8">{p.name} / {s.name}</SelectItem>
                      )),
                    ]);
                  })()}
                </SelectContent>
              </Select>
              {categorySuggested && <p className="mt-1 text-xs text-muted-foreground">AI suggestion — review before relying on it.</p>}
            </Field>
            <Field label="Component name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Part number * (MPN)">
              <div className="flex gap-2">
                <Input value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} className="font-mono" />
                <Button type="button" variant="outline" size="sm" onClick={handleLookup} disabled={looking} title="Lookup on Octopart (Nexar)">
                  {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </Field>
            <Field label="Manufacturer"><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></Field>
            <Field label="Footprint reference (package / case)"><Input value={form.footprint} onChange={(e) => setForm({ ...form, footprint: e.target.value })} placeholder="e.g., Capacitor_SMD:C_0603_1608Metric or 0603" /></Field>
            <Field label="External cross-reference"><Input value={form.bom_compatibility} onChange={(e) => setForm({ ...form, bom_compatibility: e.target.value })} placeholder="Equivalent parts you don't stock" /></Field>
            <Field label="Voltage rating"><Input value={form.voltage_rating} onChange={(e) => setForm({ ...form, voltage_rating: e.target.value })} placeholder="e.g., 50 V" /></Field>
            <Field label="Current rating"><Input value={form.current_rating} onChange={(e) => setForm({ ...form, current_rating: e.target.value })} placeholder="e.g., 2 A" /></Field>
            <Field label="Temperature rating"><Input value={form.temperature_rating} onChange={(e) => setForm({ ...form, temperature_rating: e.target.value })} placeholder="e.g., -40°C to 125°C" /></Field>
            <Field label="Cost (per unit)"><Input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="e.g., 0.45" inputMode="decimal" /></Field>
            <Field label="Supplier"><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="DigiKey, Mouser…" /></Field>
            <Field label="Supplier URL"><Input value={form.supplier_url} onChange={(e) => setForm({ ...form, supplier_url: e.target.value })} /></Field>
            <Field label="Datasheet URL">
              <div className="flex gap-2">
                <Input value={form.datasheet_url} onChange={(e) => setForm({ ...form, datasheet_url: e.target.value })} />
                <Button type="button" variant="outline" size="icon" onClick={() => setAiSearchOpen(true)} title="Find datasheet with AI">
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => setPreviewOpen(true)} disabled={!previewAvailable} title="Preview datasheet & specs">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </Field>

            <Field label="Low-stock threshold"><Input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></Field>
            <div className="md:col-span-2">
              <Field label="Projects">
                <ProjectMultiSelect projects={allProjects} value={projectIds} onChange={setProjectIds} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Compatible / substitute parts">
                <SubstitutePicker excludeId={component?.id} value={substitutes} onChange={setSubstitutes} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
          </div>
          {supplierSuggested && <p className="text-xs text-muted-foreground">Supplier details were suggested from Mouser. Review and save to keep them as part of this component record.</p>}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Storage locations</h3>
              <Button variant="outline" size="sm" onClick={() => setLocs([...locs, { location_type: "bag", label: "", quantity: 0 }])}>
                <Plus className="h-3.5 w-3.5" /> Add location
              </Button>
            </div>
            <div className="space-y-2">
              {locs.filter((l) => !l._delete).map((l, idx) => {
                const realIdx = locs.indexOf(l);
                return (
                  <div key={realIdx} className="grid grid-cols-12 gap-2 items-center">
                    <Select value={l.location_type} onValueChange={(v) => { const c = [...locs]; c[realIdx].location_type = v; setLocs(c); }}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bag">Bag</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="rack">Rack</SelectItem>
                        <SelectItem value="shelf">Shelf</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input className="col-span-5" placeholder="Label (e.g., Bag 1, Rack A)" value={l.label} onChange={(e) => { const c = [...locs]; c[realIdx].label = e.target.value; setLocs(c); }} />
                    <Input className="col-span-3" type="number" min={0} value={l.quantity} onChange={(e) => { const c = [...locs]; c[realIdx].quantity = Number(e.target.value); setLocs(c); }} />
                    <Button variant="ghost" size="icon" className="col-span-1" onClick={() => { const c = [...locs]; if (c[realIdx].id) c[realIdx]._delete = true; else c.splice(realIdx, 1); setLocs(c); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {isEdit && <Button variant="destructive" onClick={handleDelete} className="mr-auto">Delete</Button>}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-5 py-3 border-b">
            <DialogTitle>Datasheet & specs</DialogTitle>
            <DialogDescription>
              {form.part_number || "No part number"} · {form.manufacturer || "Unknown manufacturer"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 min-w-0 bg-muted/30 flex flex-col">
              {preview.datasheetUrl ? (
                <PdfViewer url={preview.datasheetUrl} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  No datasheet URL.
                </div>
              )}
            </div>
            <div className="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4">
              {preview.imageUrl && (
                <img src={preview.imageUrl} alt={`${form.part_number} preview`} className="max-h-40 rounded-md border mx-auto" />
              )}
              {preview.description && (
                <p className="text-sm text-muted-foreground">{preview.description}</p>
              )}
              {preview.specs.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-xs font-semibold">Key specs</div>
                  <div>
                    {preview.specs.map((s: { name: string; value: string }, i: number) => (
                      <div key={i} className="flex justify-between items-start gap-3 px-3 py-2 text-sm border-b last:border-0">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className="font-medium text-right">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cached specs.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DatasheetAiSearchDialog
        open={aiSearchOpen}
        onOpenChange={setAiSearchOpen}
        defaultQuery={[form.manufacturer, form.part_number || form.name].filter(Boolean).join(" ").trim()}
        onPick={(url) => {
          setForm((f) => ({ ...f, datasheet_url: url }));
          setAiSearchOpen(false);
          toast.success("Datasheet URL set");
        }}
      />
    </>
  );
}

function DatasheetAiSearchDialog({
  open,
  onOpenChange,
  defaultQuery,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultQuery: string;
  onPick: (url: string) => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DatasheetCandidate[] | null>(null);
  const search = useServerFn(datasheetAiSearch);

  useEffect(() => {
    if (open) {
      setQuery(defaultQuery);
      setResults(null);
    }
  }, [open, defaultQuery]);

  async function run() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResults(null);
    try {
      const res = await search({ data: { query: q } });
      setResults(res.results);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI datasheet search
          </DialogTitle>
          <DialogDescription>
            Search by part number, manufacturer or description. Links are verified as real PDFs.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void run();
              }
            }}
            placeholder="e.g. STM32G0B1KET6 STMicroelectronics"
          />
          <Button type="button" onClick={() => void run()} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <div className="max-h-72 overflow-y-auto space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Searching datasheets…</p>}
          {!loading && results?.length === 0 && (
            <p className="text-sm text-muted-foreground">No datasheet PDFs found. Try a different query.</p>
          )}
          {results?.map((r) => (
            <div key={r.url} className="flex items-center gap-2 rounded-md border p-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                  {r.verified && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <span className="truncate">{r.label}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.url}</p>
              </div>
              <Button asChild size="icon" variant="ghost" title="Open in new tab">
                <a href={r.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
              </Button>
              <Button type="button" size="sm" onClick={() => onPick(r.url)}>Use</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function makeAbsoluteProxyUrl(url: string): string {
  const path = `/api/public/datasheet-proxy?url=${encodeURIComponent(url)}`;
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

// Hosts known to send X-Frame-Options / CSP frame-ancestors that block
// direct <iframe> embedding. For these we default to the app proxy renderer.
const EMBED_BLOCKED_HOSTS = [
  "st.com",
  "ti.com",
  "analog.com",
  "nxp.com",
  "infineon.com",
  "onsemi.com",
  "microchip.com",
  "renesas.com",
  "rohm.com",
  "vishay.com",
  "littelfuse.com",
  "diodes.com",
  "toshiba.semicon-storage.com",
];
function isEmbedBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return EMBED_BLOCKED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
type PdfMode = "proxy-frame" | "pdfjs" | "google" | "direct";
function PdfViewer({ url }: { url: string }) {
  const isPdf = url.split(/[?#]/)[0].toLowerCase().endsWith(".pdf");
  // Default to PDF.js canvas rendering. The Lovable preview iframe uses
  // `sandbox`, which disables Chrome's built-in PDF plugin — so any
  // <iframe src=...pdf> shows "This page has been blocked by Chrome" even
  // when the URL is fine in a normal tab. Canvas rendering bypasses the
  // plugin entirely and works inside the sandboxed preview.
  const [mode, setMode] = useState<PdfMode>(isPdf ? "pdfjs" : "direct");
  useEffect(() => {
    setMode(isPdf ? "pdfjs" : "direct");
  }, [isPdf, url]);
  const proxied = makeAbsoluteProxyUrl(url);
  const src = mode === "google"
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : mode === "proxy-frame"
      ? proxied
    : url;
  const btn = (m: PdfMode, label: string, title: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`px-2 py-1 ${mode === m ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"} ${m !== "proxy-frame" ? "border-l" : ""}`}
      title={title}
    >
      {label}
    </button>
  );
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-background">
        <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{url}</span>
        <div className="flex items-center gap-2 shrink-0">
          {isPdf && (
            <div className="inline-flex rounded-md border overflow-hidden text-xs">
              {btn("proxy-frame", "Proxy", "Open through the app proxy")}
              {btn("pdfjs", "Canvas", "Render through PDF.js")}
              {btn("google", "Google", "Use Google Docs viewer")}
              {btn("direct", "Direct", "Load the PDF directly from its host")}
            </div>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>
      {isPdf && mode === "pdfjs" ? (
        <PdfCanvasViewer proxiedUrl={proxied} originalUrl={url} />
      ) : (
        <iframe
          key={src}
          src={src}
          title="Datasheet preview"
          className="flex-1 w-full bg-background"
          referrerPolicy="no-referrer"
        />
      )}
    </>
  );
}

function PdfCanvasViewer({ proxiedUrl, originalUrl }: { proxiedUrl: string; originalUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.15);
  const [status, setStatus] = useState("Loading datasheet…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { promise: Promise<any>; destroy?: () => void } | null = null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);

    async function loadPdf() {
      setError(null);
      setPdfDoc(null);
      setPageCount(0);
      setPageNumber(1);
      setStatus("Fetching datasheet…");
      try {
        const response = await fetch(proxiedUrl, { signal: controller.signal });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(detail || `Proxy returned ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer.slice(0, 4));
        if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
          throw new Error("The proxy did not return a valid PDF file.");
        }
        if (cancelled) return;
        setStatus("Rendering datasheet…");

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
        loadingTask = pdfjs.getDocument({ data: buffer });
        const doc = await loadingTask.promise;
        if (cancelled) {
          await doc.destroy?.();
          return;
        }
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setStatus("");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unable to render datasheet preview");
        setStatus("");
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      loadingTask?.destroy?.();
    };
  }, [proxiedUrl]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: { cancel?: () => void; promise: Promise<unknown> } | null = null;

    async function renderPage() {
      setStatus("Rendering page…");
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const task = page.render({ canvasContext: context, viewport });
        renderTask = task;
        await task.promise;
        if (!cancelled) setStatus("");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unable to render PDF page");
        setStatus("");
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-muted/30">
      <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!pdfDoc || pageNumber <= 1} onClick={() => setPageNumber((p) => Math.max(1, p - 1))}>Prev</Button>
          <span className="text-muted-foreground">Page {pageCount ? pageNumber : "—"} / {pageCount || "—"}</span>
          <Button type="button" variant="outline" size="sm" disabled={!pdfDoc || pageNumber >= pageCount} onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}>Next</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!pdfDoc} onClick={() => setScale((s) => Math.max(0.7, Number((s - 0.15).toFixed(2))))}>−</Button>
          <span className="w-12 text-center text-muted-foreground">{Math.round(scale * 100)}%</span>
          <Button type="button" variant="outline" size="sm" disabled={!pdfDoc} onClick={() => setScale((s) => Math.min(2.2, Number((s + 0.15).toFixed(2))))}>+</Button>
        </div>
      </div>
      <div className="relative flex-1 overflow-auto p-4">
        {status && (
          <div className="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
            {status}
          </div>
        )}
        {error ? (
          <div className="mx-auto mt-16 max-w-lg rounded-md border bg-background p-5 text-sm shadow-sm">
            <p className="font-medium">Preview could not load through the proxy.</p>
            <p className="mt-2 text-muted-foreground break-words">{error}</p>
            <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Open datasheet in new tab
            </a>
          </div>
        ) : (
          <canvas ref={canvasRef} className="mx-auto block bg-background shadow-sm" />
        )}
      </div>
    </div>
  );
}
