import { Link } from "@tanstack/react-router";
import { FileSpreadsheet, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type ProjectBomSummary } from "@/lib/project-bom.functions";

type SelectedProjectBomReviewProps = { projectName: string; boms: ProjectBomSummary[]; loading: boolean; error: unknown };

function readError(error: unknown) { return error instanceof Error ? error.message : "Unexpected read error"; }

export function savedBomReviewSearch(bomId: string) {
  return { loadBom: bomId, readOnly: true as const };
}

export function SelectedProjectBomReview({ projectName, boms, loading, error }: SelectedProjectBomReviewProps) {
  if (loading) return <Card className="p-4 text-sm text-muted-foreground">Loading saved BOMs for {projectName}…</Card>;
  if (error) return <Card role="alert" className="border-destructive/40 p-4 text-sm text-destructive">Saved BOMs for {projectName} could not be read: {readError(error)}. No saved BOM or inventory state is assumed.</Card>;
  if (!boms.length) return <Card className="p-4 text-sm text-muted-foreground">No saved BOMs are visible for {projectName}.</Card>;
  return <Card className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">Saved BOMs for {projectName}</p><p className="mt-1 text-sm text-muted-foreground">Review an existing saved revision without changing the import workflow or inventory.</p></div><span className="text-sm text-muted-foreground">{boms.length} saved</span></div><div className="mt-3 divide-y border">{boms.map((bom) => <div key={bom.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><FileSpreadsheet className="size-4 text-muted-foreground" /><span className="font-mono text-sm">{bom.bom_number}</span><span className="text-sm">{bom.name}</span></div><p className="mt-1 text-xs text-muted-foreground">Revision {bom.revision ?? "TBC"} · {bom.line_count} saved lines · Drive lineage {bom.source_drive_revision_id ? "linked" : "not linked / unsupported"}</p></div><Button asChild size="sm" variant="outline"><Link to="/bom" search={() => savedBomReviewSearch(bom.id)}><Eye className="size-4" /> Review saved BOM</Link></Button></div>)}</div></Card>;
}