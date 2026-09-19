import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, Repeat2, AlertTriangle, XCircle, CheckCircle2, ArrowUpDown, Box, Factory, FolderTree, MapPin, FolderKanban, Activity, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import type { Category, Component, Location } from "@/lib/inventory";
import { stockStatus } from "@/lib/inventory";
import { fetchProjects, fetchAllComponentProjectMap, type Project } from "@/lib/projects";
import { fetchAllSubstituteMap, type SubstituteRef } from "@/lib/substitutes";
import { shareRows } from "@/lib/bom-share";
import { ShareSelectionBar } from "./ShareSelectionBar";
import { ProjectChips } from "./ProjectMultiSelect";
import { ComponentFormDialog } from "./ComponentFormDialog";
import { StockAdjustDialog } from "./StockAdjustDialog";
import { AssignDialog } from "./AssignDialog";


interface Props {
  categorySlug?: string;
  title: string;
  subtitle?: string;
}

interface Row extends Component {
  category: Category;
  locations: Location[];
  total_quantity: number;
}

export function InventoryView({ categorySlug, title, subtitle }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pkgFilter, setPkgFilter] = useState<string>("all");
  const [mfrFilter, setMfrFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [locFilter, setLocFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [adjusting, setAdjusting] = useState<Row | null>(null);
  const [assigning, setAssigning] = useState<Row[] | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());


  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const categoryIdSet = useMemo(() => {
    if (!categorySlug) return null;
    const root = allCategories.find((c) => c.slug === categorySlug);
    if (!root) return null;
    const ids = new Set<string>([root.id]);
    // Include descendants (one level is current schema, but recurse defensively)
    let added = true;
    while (added) {
      added = false;
      for (const c of allCategories) {
        if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
          ids.add(c.id);
          added = true;
        }
      }
    }
    return ids;
  }, [categorySlug, allCategories]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["components", categorySlug, categoryIdSet ? Array.from(categoryIdSet).sort().join(",") : null],
    enabled: !categorySlug || !!categoryIdSet,
    queryFn: async () => {
      let q = supabase
        .from("components")
        .select("*, category:categories!inner(*), locations(*)");
      if (categoryIdSet) q = q.in("category_id", Array.from(categoryIdSet));
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]).map((c) => ({
        ...c,
        total_quantity: (c.locations ?? []).reduce((s: number, l: Location) => s + l.quantity, 0),
      })) as Row[];
    },
  });


  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: projectMap = new Map<string, Project[]>() } = useQuery({
    queryKey: ["component_project_map"],
    queryFn: fetchAllComponentProjectMap,
  });

  const { data: substituteMap = new Map<string, SubstituteRef[]>() } = useQuery({
    queryKey: ["component_substitutes_map"],
    queryFn: fetchAllSubstituteMap,
  });

  const categoryGroups = useMemo(() => {
    const parents = allCategories.filter((c) => !c.parent_id);
    return parents
      .map((p) => ({
        parent: p,
        children: allCategories.filter((c) => c.parent_id === p.id),
      }))
      .filter((g) => g.children.length > 0 || allCategories.some((c) => c.id === g.parent.id));
  }, [allCategories]);

  const packages = useMemo(
    () => Array.from(new Set(rows.map((r) => r.package_case).filter(Boolean))) as string[],
    [rows]
  );
  const manufacturers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.manufacturer).filter(Boolean))).sort() as string[],
    [rows]
  );
  const locationOptions = useMemo(() => {
    const set = new Map<string, { key: string; type: string; label: string }>();
    for (const r of rows) {
      for (const l of r.locations) {
        const key = `${l.location_type}::${l.label}`;
        if (!set.has(key)) set.set(key, { key, type: l.location_type, label: l.label });
      }
    }
    return Array.from(set.values()).sort((a, b) =>
      a.type.localeCompare(b.type) || a.label.localeCompare(b.label)
    );
  }, [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        if (pkgFilter !== "all" && r.package_case !== pkgFilter) return false;
        if (mfrFilter !== "all" && r.manufacturer !== mfrFilter) return false;
        if (catFilter !== "all") {
          const allowed = new Set<string>([catFilter, ...allCategories.filter((c) => c.parent_id === catFilter).map((c) => c.id)]);
          if (!r.category?.id || !allowed.has(r.category.id)) return false;
        }
        if (locFilter !== "all" && !r.locations.some((l) => `${l.location_type}::${l.label}` === locFilter))
          return false;
        if (projectFilter !== "all") {
          const ps = projectMap.get(r.id) ?? [];
          if (!ps.some((p) => p.id === projectFilter)) return false;
        }
        const status = stockStatus(r.total_quantity, r.low_stock_threshold);
        if (statusFilter === "needs_review") {
          if (!r.needs_review) return false;
        } else if (statusFilter !== "all" && status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !r.name.toLowerCase().includes(q) &&
            !r.part_number.toLowerCase().includes(q) &&
            !(r.manufacturer ?? "").toLowerCase().includes(q) &&
            !(r.value ?? "").toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "quantity") return b.total_quantity - a.total_quantity;
        if (sortBy === "manufacturer") return (a.manufacturer ?? "").localeCompare(b.manufacturer ?? "");
        return a.name.localeCompare(b.name);
      });
  }, [rows, pkgFilter, mfrFilter, catFilter, locFilter, projectFilter, statusFilter, search, sortBy, allCategories, projectMap]);

  const reviewCount = useMemo(() => rows.filter((r) => r.needs_review).length, [rows]);

  const stats = useMemo(() => {
    const inStock = rows.filter((r) => stockStatus(r.total_quantity, r.low_stock_threshold) === "in_stock").length;
    const low = rows.filter((r) => stockStatus(r.total_quantity, r.low_stock_threshold) === "low_stock").length;
    const out = rows.filter((r) => stockStatus(r.total_quantity, r.low_stock_threshold) === "out_of_stock").length;
    return { total: rows.length, inStock, low, out };
  }, [rows]);

  function refresh(id?: string) {
    qc.invalidateQueries({ queryKey: ["components"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["component_project_map"] });
    qc.invalidateQueries({ queryKey: ["component_substitutes_map"] });
    if (id) {
      setFlashId(id);
      setTimeout(() => setFlashId(null), 1500);
    }
  }

  const anyFilterActive =
    pkgFilter !== "all" || mfrFilter !== "all" || catFilter !== "all" ||
    locFilter !== "all" || projectFilter !== "all" || statusFilter !== "all" ||
    sortBy !== "name" || search !== "";

  function clearFilters() {
    setPkgFilter("all"); setMfrFilter("all"); setCatFilter("all");
    setLocFilter("all"); setProjectFilter("all"); setStatusFilter("all");
    setSortBy("name"); setSearch("");
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  const selectedParts = useMemo(
    () =>
      rows
        .filter((r) => selected.has(r.id))
        .map((r) => ({
          id: r.id,
          name: r.name,
          part_number: r.part_number,
          manufacturer: r.manufacturer,
          footprint: r.footprint,
          package_case: r.package_case,
          low_stock_threshold: r.low_stock_threshold,
          total_quantity: r.total_quantity,
          supplier_url: r.supplier_url,
          datasheet_url: r.datasheet_url,
          category_name: r.category?.name ?? null,
        })),
    [rows, selected]
  );




  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add component
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Package} label="Total parts" value={stats.total} tone="default" />
          <StatCard icon={CheckCircle2} label="In stock" value={stats.inStock} tone="success" />
          <StatCard icon={AlertTriangle} label="Low stock" value={stats.low} tone="warning" />
          <StatCard icon={XCircle} label="Out of stock" value={stats.out} tone="destructive" />
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center min-w-0">
            <div className="relative w-full md:flex-1 md:min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search part #, name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto md:min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterSelect icon={Box} label="Package" value={pkgFilter} onValueChange={setPkgFilter} active={pkgFilter !== "all"}>
                <SelectItem value="all">All packages</SelectItem>
                {packages.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </FilterSelect>

              <FilterSelect icon={Factory} label="Mfr" value={mfrFilter} onValueChange={setMfrFilter} active={mfrFilter !== "all"}>
                <SelectItem value="all">All manufacturers</SelectItem>
                {manufacturers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </FilterSelect>

              <FilterSelect icon={FolderTree} label="Category" value={catFilter} onValueChange={setCatFilter} active={catFilter !== "all"} contentClassName="max-h-[360px]">
                <SelectItem value="all">All categories</SelectItem>
                {categoryGroups.map((g) => (
                  <SelectGroup key={g.parent.id}>
                    <SelectLabel className="flex items-center justify-between">
                      <span>{g.parent.name}</span>
                    </SelectLabel>
                    <SelectItem value={g.parent.id}>
                      <span className="text-muted-foreground">All {g.parent.name}</span>
                    </SelectItem>
                    {g.children.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="pl-6">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </FilterSelect>

              <FilterSelect icon={MapPin} label="Location" value={locFilter} onValueChange={setLocFilter} active={locFilter !== "all"}>
                <SelectItem value="all">All locations</SelectItem>
                {locationOptions.map((l) => (
                  <SelectItem key={l.key} value={l.key}>
                    <span className="capitalize text-muted-foreground mr-1">{l.type}:</span>{l.label}
                  </SelectItem>
                ))}
              </FilterSelect>

              <FilterSelect icon={FolderKanban} label="Project" value={projectFilter} onValueChange={setProjectFilter} active={projectFilter !== "all"}>
                <SelectItem value="all">All projects</SelectItem>
                {projects.filter((p) => p.status === "active").map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: p.color }} />
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </FilterSelect>

              <FilterSelect icon={Activity} label="Status" value={statusFilter} onValueChange={setStatusFilter} active={statusFilter !== "all"}>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="in_stock">In stock</SelectItem>
                <SelectItem value="low_stock">Low stock</SelectItem>
                <SelectItem value="out_of_stock">Out of stock</SelectItem>
                <SelectItem value="needs_review">Needs review{reviewCount ? ` (${reviewCount})` : ""}</SelectItem>
              </FilterSelect>

              <FilterSelect icon={ArrowUpDown} label="Sort" value={sortBy} onValueChange={setSortBy} active={sortBy !== "name"}>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
                <SelectItem value="manufacturer">Manufacturer</SelectItem>
              </FilterSelect>

              {anyFilterActive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Clear filters" onClick={clearFilters}>
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear filters</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </Card>


        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36px]">
                  <Checkbox
                    aria-label="Select all filtered components"
                    checked={allFilteredSelected}
                    onCheckedChange={toggleAllFiltered}
                  />
                </TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Part #</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Substitutes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                  No components yet. Click <strong>Add component</strong> to get started.
                </TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const status = stockStatus(r.total_quantity, r.low_stock_threshold);
                return (
                  <TableRow key={r.id} className={flashId === r.id ? "row-flash" : ""}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${r.part_number}`}
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleRow(r.id)}
                      />
                    </TableCell>

                    <TableCell>
                      <button onClick={() => setEditing(r)} className="font-medium hover:text-primary text-left">{r.name}</button>
                      <div className="text-xs text-muted-foreground">{r.category.name}</div>
                      {(r.voltage_rating || r.current_rating || r.temperature_rating || r.cost != null) && (
                        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                          {r.voltage_rating && <span className="rounded bg-muted px-1 py-px">{r.voltage_rating}</span>}
                          {r.current_rating && <span className="rounded bg-muted px-1 py-px">{r.current_rating}</span>}
                          {r.temperature_rating && <span className="rounded bg-muted px-1 py-px">{r.temperature_rating}</span>}
                          {r.cost != null && <span className="rounded bg-muted px-1 py-px">₹{r.cost}</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.part_number}</TableCell>
                    <TableCell>{r.manufacturer ?? "—"}</TableCell>
                    <TableCell>{r.package_case ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{r.total_quantity}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                            {r.locations.length} location{r.locations.length === 1 ? "" : "s"}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {r.locations.length === 0
                            ? <span className="text-xs">No locations</span>
                            : <ul className="text-xs space-y-0.5">
                                {r.locations.map((l) => (
                                  <li key={l.id}>
                                    <span className="text-muted-foreground capitalize">{l.location_type}:</span>{" "}
                                    {l.label} → <strong>{l.quantity}</strong> pcs
                                  </li>
                                ))}
                              </ul>}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell><ProjectChips projects={projectMap.get(r.id) ?? []} /></TableCell>
                    <TableCell><SubstitutesCell subs={substituteMap.get(r.id) ?? []} lowOrOut={status !== "in_stock"} /></TableCell>
                    <TableCell><StatusBadge status={status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setAdjusting(r)}>Adjust</Button>
                        <Button variant="ghost" size="sm" onClick={() => setAssigning([r])}>Assign</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <ShareSelectionBar
          count={selected.size}
          baseName={`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-components`}
          buildRows={() => shareRows(selectedParts, substituteMap)}
          onAssign={() => setAssigning(rows.filter((r) => selected.has(r.id)))}
          onClear={() => setSelected(new Set())}
        />



        {(creating || editing) && (
          <ComponentFormDialog
            open
            onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
            component={editing}
            defaultCategorySlug={categorySlug}
            onSaved={(id) => { refresh(id); setCreating(false); setEditing(null); }}
          />
        )}

        {adjusting && (
          <StockAdjustDialog
            open
            onOpenChange={(o) => { if (!o) setAdjusting(null); }}
            component={adjusting}
            onSaved={(id) => { refresh(id); setAdjusting(null); }}
          />
        )}
        {assigning && (
          <AssignDialog
            open
            onOpenChange={(o) => { if (!o) setAssigning(null); }}
            components={assigning}
            onSaved={(id) => { refresh(id); setAssigning(null); setSelected(new Set()); }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function FilterSelect({
  icon: Icon,
  label,
  value,
  onValueChange,
  active,
  contentClassName,
  children,
}: {
  icon: any;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  active: boolean;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="shrink-0">
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger
              aria-label={label}
              className={`h-9 w-9 justify-center px-0 md:w-auto md:min-w-0 md:max-w-[150px] md:justify-between md:px-3 md:gap-1.5 [&>svg:last-child]:hidden md:[&>svg:last-child]:block ${
                active ? "border-primary text-primary bg-accent" : ""
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="hidden md:block min-w-0 truncate text-left">
                <SelectValue placeholder={label} />
              </div>
            </SelectTrigger>
            <SelectContent className={contentClassName}>{children}</SelectContent>
          </Select>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SubstitutesCell({ subs, lowOrOut }: { subs: SubstituteRef[]; lowOrOut: boolean }) {
  if (subs.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const available = subs.filter((s) => stockStatus(s.total_quantity, s.low_stock_threshold) === "in_stock");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">
          <Repeat2 className="h-3.5 w-3.5 text-muted-foreground" />
          {lowOrOut && available.length > 0 ? (
            <span className="text-success font-medium">{available.length} in stock</span>
          ) : (
            <span className="text-muted-foreground">{subs.length}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <ul className="text-xs space-y-1">
          {subs.map((s) => (
            <li key={s.id}>
              <span className="font-medium">{s.name}</span>{" "}
              <span className="font-mono text-muted-foreground">{s.part_number}</span>
              {" — "}
              <strong>{s.total_quantity}</strong> pcs ({stockStatus(s.total_quantity, s.low_stock_threshold).replace(/_/g, " ")})
              {s.note ? <div className="text-muted-foreground">{s.note}</div> : null}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  const toneClass =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`rounded-lg bg-accent p-2 ${toneClass}`}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "out_of_stock")
    return <Badge variant="destructive" className="font-medium">Out of stock</Badge>;
  if (status === "low_stock")
    return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Low stock</Badge>;
  return <Badge className="bg-success text-success-foreground hover:bg-success/90">In stock</Badge>;
}
