import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { generateLifecycleDocumentDraft, generateProjectLifecycleDocumentDrafts } from "@/lib/lifecycle-actions.functions";
import { isLifecycleTemplateActionAvailable } from "@/lib/lifecycle-template-settings";
import { lifecycleDocumentIntentKey, selectLifecycleDocumentRequest, type DocumentTemplateSelection, type DocumentFolderSelection } from "@/lib/lifecycle-document-selection";
import type { DocumentDraftReceipt } from "@/lib/lifecycle-document-persistence";
import type { Project } from "@/lib/projects";

export function LifecycleDocumentDraftPanel({ project }: { project: Project }) {
  const available = isLifecycleTemplateActionAvailable();
  const saveDraft = useServerFn(generateLifecycleDocumentDraft);
  const refreshDrafts = useServerFn(generateProjectLifecycleDocumentDrafts);
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ identity: string; receipt: DocumentDraftReceipt } | null>(null);
  const attempt = useRef<{ identity: string; requestKey: string } | null>(null);
  const scope = JSON.stringify([project.id, project.code, project.name, project.revision, project.department_id, project.project_drive_node_id]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  useEffect(() => { setTemplateId(""); setFolderId(""); setError(null); setSaved(null); attempt.current = null; }, [scope]);
  const options = useQuery({
    queryKey: ["lifecycle-document-options", project.id, project.department_id],
    enabled: available && Boolean(project.department_id && project.project_drive_node_id),
    queryFn: async () => {
      const [templates, folders] = await Promise.all([
        supabase.from("department_process_templates").select("id,department_id,template_key,version,title,status,active_document_revision_id")
          .eq("department_id", project.department_id!).eq("status", "ACTIVE").order("title"),
        supabase.from("drive_nodes").select("id,name,project_id,department_id,node_type,is_trashed")
          .eq("project_id", project.id).eq("department_id", project.department_id!).eq("node_type", "FOLDER").eq("is_trashed", false).order("name"),
      ]);
      if (templates.error) throw templates.error;
      if (folders.error) throw folders.error;
      // Revision pin is in the accepted pending schema, ahead of generated types.
      return { templates: (templates.data ?? []) as unknown as DocumentTemplateSelection[], folders: (folders.data ?? []) as DocumentFolderSelection[] };
    },
  });
  const documents = useQuery({
    queryKey: ["lifecycle-generated-documents", project.id],
    enabled: available,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_lifecycle_document_drafts" as never)
        .select("id,generated_drive_node_id,template_version,created_at,result")
        .eq("project_id", project.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; generated_drive_node_id: string; template_version: number; created_at: string; result: { document_number?: string } }>;
    },
  });
  let selected: ReturnType<typeof selectLifecycleDocumentRequest> | null = null;
  let selectionError: string | null = null;
  try { selected = selectLifecycleDocumentRequest(project, options.data?.templates.find((t) => t.id === templateId), options.data?.folders.find((f) => f.id === folderId)); }
  catch (cause) { selectionError = cause instanceof Error ? cause.message : "Choose a template and folder."; }
  const identity = selected ? lifecycleDocumentIntentKey(project, selected) : null;
  const receipt = saved?.identity === identity ? saved.receipt : null;
  async function generate() {
    if (!available || !selected || !identity || busy || receipt) return;
    const startedScope = scope;
    if (attempt.current?.identity !== identity) attempt.current = { identity, requestKey: crypto.randomUUID() };
    const requestKey = attempt.current.requestKey;
    setBusy(true); setError(null);
    try {
      const { result } = await saveDraft({ data: { ...selected, requestKey } });
      if (currentScope.current === startedScope) setSaved({ identity, receipt: result.receipt });
      await queryClient.invalidateQueries({ queryKey: ["drive_children"] });
      await queryClient.invalidateQueries({ queryKey: ["lifecycle-generated-documents", project.id] });
    } catch (cause) {
      if (currentScope.current === startedScope) setError(cause instanceof Error ? cause.message : "Draft could not be saved. Retry keeps the same request.");
    } finally { setBusy(false); }
  }
  async function refreshDepartmentDrafts() {
    if (!available || busy || !project.revision || !project.project_drive_node_id) return;
    const startedScope = scope;
    setBusy(true); setError(null);
    try {
      const outcome = await refreshDrafts({ data: { projectId: project.id } });
      if (currentScope.current === startedScope && outcome.failures.length) {
        setError(`${outcome.failures.length} drafts need attention: ${outcome.failures[0].message}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["lifecycle-generated-documents", project.id] });
      await queryClient.invalidateQueries({ queryKey: ["drive_children"] });
    } catch (cause) {
      if (currentScope.current === startedScope) setError(cause instanceof Error ? cause.message : "Department drafts could not be generated.");
    } finally { setBusy(false); }
  }
  return <Card className="space-y-4 p-5">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold"><FilePlus2 className="size-4" />Template-backed document draft</h3>
      <Badge variant="secondary">{available ? "DRAFT ONLY" : "ACCEPTANCE PENDING"}</Badge>
    </div>
    <p className="text-sm text-muted-foreground">Generate from an active department template using the project's current details. Saved drafts include a file revision, document register and audit trail.</p>
    {!available ? <p role="status" className="text-sm text-muted-foreground">Saving is unavailable until the protected workflow passes authenticated acceptance.</p>
      : options.isError ? <p role="alert" className="text-sm text-destructive">Templates or folders could not be loaded with your current access. <Button size="sm" variant="ghost" onClick={() => void options.refetch()}>Retry</Button></p>
      : options.isLoading ? <p role="status">Loading templates and folders…</p>
      : <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="draft-template">Active template</Label><select id="draft-template" className="mt-1 w-full rounded-md border bg-background p-2" value={templateId} disabled={busy} onChange={(e) => { setTemplateId(e.target.value); setError(null); }}>
          <option value="">Choose template</option>{options.data?.templates.filter((t) => t.active_document_revision_id).map((t) => <option key={t.id} value={t.id}>{t.title} · v{t.version}</option>)}
        </select></div>
        <div><Label htmlFor="draft-folder">Project Drive folder</Label><select id="draft-folder" className="mt-1 w-full rounded-md border bg-background p-2" value={folderId} disabled={busy} onChange={(e) => { setFolderId(e.target.value); setError(null); }}>
          <option value="">Choose folder</option>{options.data?.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select></div>
      </div>}
    {available && selectionError && <p className="text-xs text-muted-foreground">{selectionError}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {receipt ? <div role="status" className="space-y-1 text-sm"><p>Draft saved. The original files and approved versions remain preserved.</p>
      <Link className="text-primary underline" to="/drive" search={{ node: receipt.nodeId, department: project.department_id ?? undefined }}>Open saved draft in Drive</Link>
      <p className="text-xs text-muted-foreground">Revision: {receipt.revisionId} · Register: {receipt.registerId}</p>
    </div> : <Button size="sm" onClick={() => void generate()} disabled={!available || !selected || busy}>{busy ? "Saving draft…" : error ? "Retry save" : "Generate draft"}</Button>}
    {available && <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-medium">Recent generated documents</h4>
        <Button size="sm" variant="outline" disabled={busy || !project.revision || !project.project_drive_node_id} onClick={() => void refreshDepartmentDrafts()}>Refresh department drafts</Button>
      </div>
      <p className="text-xs text-muted-foreground">Active department templates are generated into the project Drive. Unchanged snapshots reuse their saved documents.</p>
      {documents.isError ? <p role="alert" className="text-xs text-destructive">Generated document history could not be loaded with your current access.</p>
        : documents.isLoading ? <p className="text-xs text-muted-foreground">Loading saved documents…</p>
        : !documents.data?.length ? <p className="text-xs text-muted-foreground">No generated documents are visible for this project yet.</p>
        : documents.data.map((document) => <Link key={document.id} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted"
          to="/drive" search={{ node: document.generated_drive_node_id, department: project.department_id ?? undefined }}>
          {document.result?.document_number ?? "Generated document"} · template v{document.template_version}
          <span className="ml-2 text-xs text-muted-foreground">{new Date(document.created_at).toLocaleString()}</span>
        </Link>)}
    </div>}
  </Card>;
}
