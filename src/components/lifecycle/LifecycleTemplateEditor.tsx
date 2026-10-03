import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createLifecycleTemplateContentRevision, activateLifecycleTemplate } from "@/lib/lifecycle-actions.functions";
import { fetchLifecycleTemplateContent, lifecycleTemplateMutationStatus, type LifecycleTemplateRead } from "@/lib/lifecycle-template-settings";
import { renderLifecycleDocument } from "@/lib/lifecycle-document-renderer";

const exampleFields = {
  PROJECT_CODE: "SAMPLE-001",
  PROJECT_NAME: "OEM tracker example",
  PROJECT_REVISION: "DEMO-01",
  DEPARTMENT: "Example department",
};

export function LifecycleTemplateEditor({ template, departmentName, onClose }: {
  template: LifecycleTemplateRead;
  departmentName: string;
  onClose(): void;
}) {
  const [content, setContent] = useState("");
  const [chosenRevisionId, setChosenRevisionId] = useState("");
  const [savedRevisionId, setSavedRevisionId] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const status = lifecycleTemplateMutationStatus();
  const queryClient = useQueryClient();
  const saveBody = useServerFn(createLifecycleTemplateContentRevision);
  const activateBody = useServerFn(activateLifecycleTemplate);
  const revisions = useQuery({
    queryKey: ["lifecycle-template-content", template.id],
    queryFn: () => fetchLifecycleTemplateContent(template.id),
    // Do not query an undeployed table or mistake its absence for no content.
    enabled: status.available,
  });
  const editable = template.status === "DRAFT";
  const preview = useMemo(() => {
    if (!content.trim()) return { text: "", error: null };
    try {
      return { text: renderLifecycleDocument({
        templateKey: template.template_key, version: template.version,
        title: template.title, content, documentRevisionId: "local-preview-only",
      }, { ...exampleFields, DEPARTMENT: departmentName }).content, error: null };
    } catch (error) {
      return { text: "", error: error instanceof Error ? error.message : "Invalid template content." };
    }
  }, [content, template, departmentName]);
  const save = useMutation({
    mutationFn: async () => {
      if (!status.available || !editable || !content.trim() || preview.error) throw new Error("Template saving is unavailable.");
      const exactContent = content;
      const result = await saveBody({ data: { templateId: template.id, content: exactContent } });
      return { result, exactContent };
    },
    onSuccess: async ({ result, exactContent }) => {
      setSavedRevisionId(result.templateDocumentRevisionId);
      setSavedContent(exactContent);
      setChosenRevisionId(result.templateDocumentRevisionId);
      toast.success(`Saved immutable content revision ${result.revisionNumber}`);
      await queryClient.invalidateQueries({ queryKey: ["lifecycle-template-content", template.id] });
    },
    onError: (error) => toast.error(error.message),
  });
  const activate = useMutation({
    mutationFn: async () => {
      if (!status.available || !editable || !savedRevisionId || content !== savedContent || preview.error) {
        throw new Error("Save or load the exact content revision before activation.");
      }
      return activateBody({ data: { templateId: template.id, templateDocumentRevisionId: savedRevisionId } });
    },
    onSuccess: async () => {
      toast.success("Template activated with the selected content revision");
      await queryClient.invalidateQueries({ queryKey: ["lifecycle-template-settings", template.department_id] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  const busy = save.isPending || activate.isPending;
  const selectedRevision = revisions.data?.find((revision) => revision.id === chosenRevisionId);

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>{editable ? "Prepare template body" : "Template body"} · {template.title}</DialogTitle>
        <DialogDescription>
          {template.template_key} · v{template.version}. Text is local until a save succeeds. Closing discards unsaved text.
          {!editable && " Active and retired bodies are read-only."}
        </DialogDescription>
      </DialogHeader>
      {!status.available && <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        Local preview is available. Backend saving and stored revisions are unavailable until protected template acceptance passes.
      </p>}
      {status.available && <div className="space-y-2">
        <Label htmlFor="template-revision">Stored immutable content revisions</Label>
        {revisions.isLoading ? <p className="text-sm">Loading revisions…</p> : revisions.isError
          ? <p role="alert" className="text-sm text-destructive">Content could not be loaded with your current access.</p>
          : <div className="flex gap-2">
            <select id="template-revision" className="min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" value={chosenRevisionId} onChange={(event) => setChosenRevisionId(event.target.value)} disabled={busy}>
              <option value="">Choose a revision</option>
              {revisions.data?.map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.revision_number} · {new Date(revision.created_at).toLocaleDateString()}</option>)}
            </select>
            <Button type="button" variant="outline" disabled={!selectedRevision || busy} onClick={() => {
              if (!selectedRevision) return;
              setContent(selectedRevision.content);
              setSavedContent(selectedRevision.content);
              setSavedRevisionId(selectedRevision.id);
            }}>Load selected revision</Button>
          </div>}
        <p className="text-xs text-muted-foreground">Loading replaces unsaved text in this editor. Saving appends a revision; it preserves existing bodies.</p>
      </div>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="template-content">Template body · plain text</Label>
          <Textarea id="template-content" className="min-h-64 font-mono text-sm" value={content} onChange={(event) => setContent(event.target.value)} readOnly={!editable} disabled={busy} maxLength={200_000} placeholder="Enter document text and supported placeholders…" />
          <p className="text-xs text-muted-foreground">Supported placeholders:</p>
          <div className="flex flex-wrap gap-1">
            {Object.keys(exampleFields).map((field) => <Button key={field} type="button" size="sm" variant="outline" className="h-7 px-2 font-mono text-xs" disabled={!editable || busy} onClick={() => setContent((value) => `${value}{{${field}}}`)}>{`{{${field}}}`}</Button>)}
          </div>
          {preview.error && <p role="alert" className="text-sm text-destructive">{preview.error}</p>}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Sample preview · never saved</p>
          <p className="text-xs text-muted-foreground">Example values are shown here. Actual generation reads the project's verified backend fields.</p>
          <pre className="min-h-64 whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-sm">{preview.text || "Enter valid template text to preview it."}</pre>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button>
        <Button type="button" variant="outline" disabled={!status.available || !editable || !savedRevisionId || content !== savedContent || Boolean(preview.error) || busy} onClick={() => activate.mutate()}>{activate.isPending ? "Activating…" : "Activate saved revision"}</Button>
        <Button type="button" disabled={!status.available || !editable || !content.trim() || Boolean(preview.error) || busy} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save content revision"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
