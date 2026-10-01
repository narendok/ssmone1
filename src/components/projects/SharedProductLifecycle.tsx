import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, FileText, FolderOpen, GitPullRequest, PackageSearch, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Project } from "@/lib/projects";

const sb = supabase as any;

const phases = [
  { title: "Shared requirement", detail: "Customer requirement, current revision, and cross-functional feasibility.", state: "requirements" },
  { title: "Freeze & confirmation", detail: "Customer-authorized baseline and controlled change context.", state: "baseline" },
  { title: "POC & pilot", detail: "Research, sourcing, build, validation, and lab evidence.", state: "poc" },
  { title: "Engineering release", detail: "Design records, gates, changes, and type-approval evidence.", state: "release" },
  { title: "Production readiness", detail: "Exact BOM source, lead-time planning, test/jig and calibration prerequisites.", state: "readiness" },
];

export function SharedProductLifecycle({ project }: { project: Project }) {
  const { data: snapshot } = useQuery({
    queryKey: ["shared_product_lifecycle", project.id, project.requirement_baseline_id],
    queryFn: async () => {
      const [tasks, boms, inputs, research, gates, changes, process] = await Promise.all([
        sb.from("project_tasks").select("id,status,assignee_id,department_id").eq("project_id", project.id),
        sb.from("project_boms").select("id,revision,source_drive_node_id,source_drive_revision_id").eq("project_id", project.id),
        sb.from("project_design_inputs").select("id,status").eq("project_id", project.id),
        sb.from("project_research_records").select("id,decision_status").eq("project_id", project.id),
        sb.from("project_stage_gates").select("id,status").eq("project_id", project.id),
        sb.from("project_change_requests").select("id,status").eq("project_id", project.id),
        sb.from("project_process_stage_records").select("id,status").eq("project_id", project.id),
      ]);
      for (const result of [tasks, boms, inputs, research, gates, changes, process]) if (result.error) throw result.error;
      return { tasks: tasks.data ?? [], boms: boms.data ?? [], inputs: inputs.data ?? [], research: research.data ?? [], gates: gates.data ?? [], changes: changes.data ?? [], process: process.data ?? [] };
    },
  });

  const openTasks = snapshot?.tasks.filter((task: any) => task.status !== "done").length ?? 0;
  const linkedBoms = snapshot?.boms.filter((bom: any) => bom.source_drive_node_id && bom.source_drive_revision_id).length ?? 0;
  const hasBaseline = Boolean(project.requirement_baseline_id);
  const statuses = [
    hasBaseline ? "linked" : "missing",
    hasBaseline ? "frozen source linked" : "customer confirmation required",
    snapshot?.research.length ? `${snapshot.research.length} record${snapshot.research.length === 1 ? "" : "s"}` : "not started",
    snapshot?.gates.length ? `${snapshot.gates.length} gate${snapshot.gates.length === 1 ? "" : "s"}` : "not started",
    linkedBoms ? `${linkedBoms} revision-linked BOM${linkedBoms === 1 ? "" : "s"}` : "BOM source not linked",
  ];

  return <div className="space-y-5">
    <Card className="border-primary/20 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Shared product lifecycle</p>
          <h2 className="mt-1 text-lg font-semibold">Connected project & revision workspace</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">This view connects existing controlled records. It does not approve, release, publish, or create operational work automatically.</p>
        </div>
        <Badge variant="outline">Draft planning view</Badge>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {phases.map((phase, index) => <div key={phase.state} className="min-w-0 border-l-2 border-primary/30 pl-3"><p className="text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</p><p className="mt-1 text-sm font-medium">{phase.title}</p><p className="mt-1 text-xs text-muted-foreground">{phase.detail}</p><Badge variant={statuses[index].includes("missing") || statuses[index].includes("required") || statuses[index].includes("not started") ? "secondary" : "outline"} className="mt-3 text-[10px]">{statuses[index]}</Badge></div>)}
      </div>
    </Card>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <Card className="p-5">
        <div className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" /><h3 className="font-semibold">Handoffs & working queue</h3></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Open tasks" value={openTasks} detail="Existing scoped project work" />
          <Metric label="Design inputs" value={snapshot?.inputs.length ?? 0} detail="Shared PRS analysis inputs" />
          <Metric label="Open changes" value={snapshot?.changes.filter((change: any) => !["closed", "implemented"].includes(String(change.status).toLowerCase())).length ?? 0} detail="Controlled change notes" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to="/tasks"><ClipboardList className="size-3.5" /> Open task queue</Link></Button><Button asChild size="sm" variant="outline"><Link to="/sales"><GitPullRequest className="size-3.5" /> Requirement & handover</Link></Button></div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center gap-2"><PackageSearch className="size-4 text-primary" /><h3 className="font-semibold">Source-controlled delivery inputs</h3></div>
        <p className="mt-3 text-sm text-muted-foreground">Procurement and production planning must use exact revision-linked sources. Missing links remain visible rather than being inferred.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">{snapshot?.boms.length ?? 0} saved BOMs</Badge><Badge variant="outline">{linkedBoms} revision-linked</Badge><Badge variant="outline">{snapshot?.process.length ?? 0} process records</Badge></div>
        <div className="mt-4 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to="/bom" search={{ projectId: project.id } as any}><FileText className="size-3.5" /> Review BOMs</Link></Button><Button asChild size="sm" variant="outline"><Link to="/drive" search={{ node: project.project_drive_node_id ?? undefined, department: project.department_id ?? undefined } as any}><FolderOpen className="size-3.5" /> Open project files</Link></Button></div>
      </Card>
    </div>

    <Card className="p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><div><h3 className="font-semibold">Template and external-sharing safeguards</h3><p className="mt-1 text-sm text-muted-foreground">Department leads continue to use existing Drive templates and controlled document settings. Client sharing remains governed by the existing restricted, expiring access workflow; no link is published from this view.</p></div><ArrowRight className="ml-auto mt-1 size-4 text-muted-foreground" /></div></Card>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="border-l-2 border-muted pl-3"><p className="text-xl font-semibold">{value}</p><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}