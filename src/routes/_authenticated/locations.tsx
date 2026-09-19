import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Package, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/locations")({
  head: () => ({ meta: [{ title: "Inventory Locations — SSM One" }, { name: "description", content: "Component stock by storage location." }, { property: "og:title", content: "Inventory Locations — SSM One" }, { property: "og:description", content: "Component stock by storage location." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: LocationsPage,
});

interface LocRow {
  id: string;
  component_id: string;
  location_type: string;
  label: string;
  quantity: number;
  component: {
    id: string;
    name: string;
    part_number: string;
    manufacturer: string | null;
    value: string | null;
    package_case: string | null;
    category: { name: string } | null;
  };
}

interface Bucket {
  key: string;
  location_type: string;
  label: string;
  total: number;
  rows: LocRow[];
}

const TYPE_TONE: Record<string, string> = {
  bag: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  box: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rack: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  shelf: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

function typeTone(t: string) {
  return TYPE_TONE[t.toLowerCase()] ?? "bg-muted text-muted-foreground";
}

function LocationsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ["locations_buckets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*, component:components(id, name, part_number, manufacturer, value, package_case, category:categories(name))")
        .order("label");
      if (error) throw error;
      const map = new Map<string, Bucket>();
      for (const r of (data as LocRow[])) {
        const key = `${r.location_type}::${r.label}`;
        const b = map.get(key) ?? {
          key,
          location_type: r.location_type,
          label: r.label,
          total: 0,
          rows: [],
        };
        b.total += r.quantity;
        b.rows.push(r);
        map.set(key, b);
      }
      return Array.from(map.values()).sort((a, b) =>
        a.location_type.localeCompare(b.location_type) || a.label.localeCompare(b.label)
      );
    },
  });

  const current = useMemo(
    () => buckets.find((b) => b.key === selected) ?? buckets[0] ?? null,
    [buckets, selected]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Racks, shelves, boxes, and bags — and what's in each.
        </p>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
      ) : buckets.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No locations yet. Add stock to a component to create one.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="space-y-2">
            {buckets.map((b) => {
              const active = current?.key === b.key;
              return (
                <button
                  key={b.key}
                  onClick={() => setSelected(b.key)}
                  className={cn(
                    "w-full text-left rounded-lg border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm",
                    active && "border-primary ring-2 ring-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Badge variant="secondary" className={cn("font-medium capitalize", typeTone(b.location_type))}>
                        {b.location_type}
                      </Badge>
                      <div className="font-semibold mt-1.5 truncate">{b.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {b.rows.length} distinct part{b.rows.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-lg font-bold tabular-nums">{b.total}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <Card className="overflow-hidden">
            {current && (
              <>
                <div className="flex items-center gap-3 border-b p-4">
                  <div className="rounded-lg bg-accent p-2 text-primary">
                    <Box className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{current.label}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {current.location_type} · {current.total} units across {current.rows.length} part
                      {current.rows.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.component?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.component?.category?.name ?? ""}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.component?.part_number ?? "—"}</TableCell>
                        <TableCell>{r.component?.manufacturer ?? "—"}</TableCell>
                        <TableCell>{r.component?.package_case ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{r.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
