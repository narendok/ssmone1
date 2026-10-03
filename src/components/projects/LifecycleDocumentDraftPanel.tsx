import { FilePlus2, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { planLifecycleDocumentDraft } from "@/lib/lifecycle-document-generation.contract";
import type { Project } from "@/lib/projects";

export function LifecycleDocumentDraftPanel({ project }: { project: Project }) {
  const plan = planLifecycleDocumentDraft({
    projectId: project.id,
    projectRevision: project.revision,
    projectDriveRootId: project.project_drive_node_id,
    departmentId: project.department_id,
    templateId: null,
    templateVersion: null,
    targetFolderId: null,
    sourceFields: {
      projectId: project.id,
      projectRevision: project.revision,
      departmentId: project.department_id,
      projectDriveRootId: project.project_drive_node_id,
    },
  });

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><FilePlus2 className="size-4 text-primary" /><h3 className="font-semibold">Template-backed document draft</h3></div>
          <p className="mt-1 text-sm text-muted-foreground">A protected server action will render a draft, persist its Drive revision, and record its template pin and audit receipt atomically.</p>
        </div>
        <Badge variant="secondary">ACCEPTANCE PENDING</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Required mapping</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.requiredProvenance.map((field) => <Badge key={field} variant={plan.missingProvenance.includes(field) ? "secondary" : "outline"}>{field}{plan.missingProvenance.includes(field) ? " · missing" : " · linked"}</Badge>)}
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><LockKeyhole className="size-3.5 text-muted-foreground" /><span>Template pin: {plan.immutableTemplatePin ? `v${plan.immutableTemplatePin.templateVersion}` : "not selected"}</span></div>
          <div className="flex items-center gap-2"><RotateCcw className="size-3.5 text-muted-foreground" /><span>Retry mode: {plan.retryMode.replaceAll("_", " ")}</span></div>
          <div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-muted-foreground" /><span>Manual edits and approved versions stay preserved.</span></div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{plan.unavailableReason ?? "The generated action remains unavailable until the protected workflow is accepted."}</p>
      <Button className="mt-4" size="sm" disabled title="Requires isolated acceptance before any document is rendered or saved"><FilePlus2 className="size-3.5" /> Generate draft</Button>
    </Card>
  );
}