import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, FolderInput, ChevronRight, ArrowLeft } from "lucide-react";
import { fetchProjectBoms, fetchProjectBomItems, type ProjectBomSummary, type ProjectBomItemRow } from "@/lib/project-bom.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const KIND_STYLE: Record<string, string> = {
  exact: "bg-success text-success-foreground",
  close: "",
  substitute: "bg-warning text-warning-foreground",
  missing: "bg-destructive text-destructive-foreground",
};

function money(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProjectBomsTab({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const listFn = useServerFn(fetchProjectBoms);
  const itemsFn = useServerFn(fetchProjectBomItems);
  const [openBomId, setOpenBomId] = useState<string | null>(null);

  const { data: boms = [], isLoading } = useQuery({
    queryKey: ["project_boms", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const { data: detail } = useQuery({
    queryKey: ["project_bom_detail", openBomId],
    queryFn: () => itemsFn({ data: { bomId: openBomId! } }),
    enabled: !!openBomId,
  });

  if (openBomId && detail) {
    const h = detail.header as any;
    const items = detail.items as ProjectBomItemRow[];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpenBomId(null)}>
            <ArrowLeft className="h-4 w-4" /> Back to BOM list
          </Button>
        </div>
        <Card className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-semibold">{h.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{h.bom_number}</span>
            {h.revision && <Badge variant="secondary">Rev {h.revision}</Badge>}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{items.length} line items</span>
            <span>Total cost: <span className="font-medium text-foreground">{money(h.total_cost)}</span></span>
            {h.source_filename && <span>Source: <span className="font-mono text-xs">{h.source_filename}</span></span>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => navigate({ to: "/bom", search: { loadBom: h.id } as any })}>
              <FolderInput className="h-4 w-4" /> Load in BOM tool
            </Button>
          </div>
        </Card>
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Refs</TableHead>
                <TableHead>MPN</TableHead>
                <TableHead>Value / description</TableHead>
                <TableHead>Footprint</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Matched part</TableHead>
                <TableHead className="text-right">Short</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{it.refs || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{it.mpn || "—"}</TableCell>
                  <TableCell>
                    <div className="text-xs">{it.value || "—"}</div>
                    <div className="text-xs text-muted-foreground">{it.description}</div>
                  </TableCell>
                  <TableCell className="text-xs">{it.footprint || "—"}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right text-xs">{money(it.unit_cost)}</TableCell>
                  <TableCell className="text-right text-xs">{money(it.total_cost)}</TableCell>
                  <TableCell>
                    {it.matched_part_number ? (
                      <>
                        <div className="text-xs font-medium">{it.matched_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{it.matched_part_number}</div>
                      </>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">{it.shortage > 0 ? <span className="text-destructive font-semibold">{it.shortage}</span> : "—"}</TableCell>
                  <TableCell>
                    <Badge className={KIND_STYLE[it.match_status ?? ""] ?? "variant=secondary"} variant="secondary">
                      {it.match_status ?? "—"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Saved BOMs for this project. Open one to review its lines, or load it back into the BOM tool to re-match against current stock.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : boms.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No saved BOMs yet. Import a BOM on the <Button asChild variant="link" className="h-auto p-0 align-baseline"><Link to="/bom">BOM page</Link></Button> and click “Save BOM to project”.
        </Card>
      ) : (
        <Card className="divide-y">
          {(boms as ProjectBomSummary[]).map((b) => (
            <button
              key={b.id}
              onClick={() => setOpenBomId(b.id)}
              className="w-full text-left p-4 hover:bg-accent/50 flex items-center gap-4"
            >
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{b.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{b.bom_number}</span>
                  {b.revision && <Badge variant="secondary">Rev {b.revision}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {b.line_count} line items · {money(b.total_cost)} total
                  {b.source_filename ? ` · ${b.source_filename}` : ""}
                  {" · saved " + new Date(b.created_at).toLocaleString()}
                </div>
              </div>
              <span
                role="button"
                tabIndex={0}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                onClick={(e) => { e.stopPropagation(); navigate({ to: "/bom", search: { loadBom: b.id } as any }); }}
              >
                <FolderInput className="h-3.5 w-3.5" /> Load in BOM tool
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

