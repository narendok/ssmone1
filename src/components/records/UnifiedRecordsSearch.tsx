import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkPlus, Building2, ClipboardCheck, FileText, FolderKanban, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sb = supabase as any;

type RecordKind = "all" | "client" | "project" | "audit" | "document";
type UnifiedRecord = {
  id: string;
  kind: Exclude<RecordKind, "all">;
  title: string;
  reference: string;
  detail: string;
  status: string | null;
  updatedAt: string;
  to: "/customers" | "/projects" | "/qms/audits" | "/drive";
};

type SavedSearch = {
  id: string;
  name: string;
  query_text: string;
  record_kind: RecordKind;
  status_filter: string;
};

const recordKinds: Array<{ value: RecordKind; label: string }> = [
  { value: "all", label: "All records" },
  { value: "client", label: "Clients" },
  { value: "project", label: "Projects" },
  { value: "audit", label: "Audit packs" },
  { value: "document", label: "Controlled documents" },
];

const iconFor = {
  client: Building2,
  project: FolderKanban,
  audit: ClipboardCheck,
  document: FileText,
};

function normalize(value: unknown) {
  return String(value ?? "").replaceAll("_", " ");
}

async function fetchUnifiedRecords(): Promise<UnifiedRecord[]> {
  const [customers, projects, audits, nodes] = await Promise.all([
    sb.from("customers").select("id,customer_code,legal_name,display_name,customer_type,industry,status,updated_at").neq("status", "archived").order("updated_at", { ascending: false }),
    sb.from("projects").select("id,code,name,project_type,project_stage,health_status,status,updated_at").order("updated_at", { ascending: false }),
    sb.from("qms_audits").select("id,audit_code,audit_type,scope,process_name,status,planned_date,updated_at").order("updated_at", { ascending: false }),
    sb.from("drive_nodes").select("id,name,slug,node_type,file_type,mime_type,metadata,is_locked,updated_at").eq("is_trashed", false).order("updated_at", { ascending: false }),
  ]);

  for (const result of [customers, projects, audits, nodes]) if (result.error) throw result.error;

  const documents = (nodes.data ?? [])
    .filter((node: any) => Boolean(node.metadata?.controlled_document || node.mime_type === "application/x-ssm-controlled-document-placeholder"))
    .map((node: any): UnifiedRecord => ({
      id: node.id,
      kind: "document",
      title: node.name,
      reference: node.slug,
      detail: node.metadata?.phase ? `Phase ${node.metadata.phase}${node.metadata?.placeholder ? " · Placeholder" : ""}` : node.file_type ?? "Controlled document",
      status: node.is_locked ? "CONTROLLED" : null,
      updatedAt: node.updated_at,
      to: "/drive",
    }));

  return [
    ...(customers.data ?? []).map((customer: any): UnifiedRecord => ({
      id: customer.id,
      kind: "client",
      title: customer.display_name || customer.legal_name,
      reference: customer.customer_code,
      detail: [customer.customer_type, customer.industry].filter(Boolean).join(" · ") || "Client record",
      status: customer.status,
      updatedAt: customer.updated_at,
      to: "/customers",
    })),
    ...(projects.data ?? []).map((project: any): UnifiedRecord => ({
      id: project.id,
      kind: "project",
      title: project.name,
      reference: project.code,
      detail: [project.project_type, project.project_stage].filter(Boolean).map(normalize).join(" · "),
      status: project.status,
      updatedAt: project.updated_at,
      to: "/projects",
    })),
    ...(audits.data ?? []).map((audit: any): UnifiedRecord => ({
      id: audit.id,
      kind: "audit",
      title: audit.process_name || audit.scope || audit.audit_code,
      reference: audit.audit_code,
      detail: [audit.audit_type, audit.planned_date ? `Planned ${audit.planned_date}` : null].filter(Boolean).map(normalize).join(" · "),
      status: audit.status,
      updatedAt: audit.updated_at,
      to: "/qms/audits",
    })),
    ...documents,
  ];
}

async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await sb
    .from("user_saved_record_searches")
    .select("id,name,query_text,record_kind,status_filter")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedSearch[];
}

export function UnifiedRecordsSearch() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<RecordKind>("all");
  const [status, setStatus] = useState("all");
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError } = useQuery({ queryKey: ["unified_records"], queryFn: fetchUnifiedRecords });
  const { data: savedSearches = [] } = useQuery({ queryKey: ["user_saved_record_searches"], queryFn: fetchSavedSearches });

  const statuses = useMemo(() => [...new Set(data.map((record) => record.status).filter(Boolean) as string[])].sort(), [data]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.filter((record) => {
      if (kind !== "all" && record.kind !== kind) return false;
      if (status !== "all" && record.status !== status) return false;
      return !needle || [record.title, record.reference, record.detail, record.status].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [data, kind, query, status]);

  const hasFilters = Boolean(query || kind !== "all" || status !== "all");
  const applySavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query_text);
    setKind(savedSearch.record_kind);
    setStatus(savedSearch.status_filter);
  };

  const saveSearch = async () => {
    const name = savedSearchName.trim();
    if (!name) {
      toast.error("Give this search a name.");
      return;
    }
    setSaving(true);
    const { error } = await sb.from("user_saved_record_searches").insert({ name, query_text: query, record_kind: kind, status_filter: status });
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "You already have a saved search with this name." : error.message);
      return;
    }
    setSavedSearchName("");
    setSaveOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["user_saved_record_searches"] });
    toast.success("Search saved.");
  };

  const removeSavedSearch = async (id: string) => {
    const { error } = await sb.from("user_saved_record_searches").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["user_saved_record_searches"] });
    toast.success("Saved search removed.");
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-medium text-primary">Workspace records</p>
        <h1 className="mt-1 text-2xl font-semibold">Unified search</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Find converted clients, projects, audit packs, and controlled-document records from one place.</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, code, scope, phase, or status" className="pl-9" />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Tabs value={kind} onValueChange={(value) => setKind(value as RecordKind)} className="min-w-0 flex-1">
              <TabsList className="h-auto w-full justify-start overflow-x-auto">
                {recordKinds.map((item) => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2 md:w-52"><SlidersHorizontal className="size-4 text-muted-foreground" /><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger><SelectContent><SelectItem value="all">Any status</SelectItem>{statuses.map((item) => <SelectItem key={item} value={item}>{normalize(item)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="flex items-center gap-1.5 text-sm font-medium"><Bookmark className="size-4 text-muted-foreground" />Saved searches</span>
            {savedSearches.map((savedSearch) => <div key={savedSearch.id} className="flex items-center overflow-hidden rounded-md border"><Button variant="ghost" size="sm" onClick={() => applySavedSearch(savedSearch)}>{savedSearch.name}</Button><Button variant="ghost" size="icon" className="size-8 rounded-none border-l" aria-label={`Remove ${savedSearch.name}`} title={`Remove ${savedSearch.name}`} onClick={() => void removeSavedSearch(savedSearch.id)}><Trash2 className="size-3.5" /></Button></div>)}
            <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}><BookmarkPlus className="size-4" />Save current search</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{isLoading ? "Loading records…" : `${visible.length} matching record${visible.length === 1 ? "" : "s"}`}</span>{hasFilters && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setKind("all"); setStatus("all"); }}>Clear filters</Button>}</div>

      {isError ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Records could not be loaded with your current access.</CardContent></Card> : isLoading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading records…</CardContent></Card> : visible.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No records match these filters.</CardContent></Card> : <div className="space-y-2">
        {visible.map((record) => {
          const Icon = iconFor[record.kind];
          return <Link key={`${record.kind}-${record.id}`} to={record.to} className="block"><Card className="transition-colors hover:border-primary/50"><CardContent className="flex items-start gap-3 p-4"><span className="mt-0.5 text-primary"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{record.title}</p><Badge variant="outline">{recordKinds.find((item) => item.value === record.kind)?.label.slice(0, -1) ?? record.kind}</Badge>{record.status && <Badge variant="secondary">{normalize(record.status)}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{record.reference} · {record.detail || "—"}</p></div><span className="hidden shrink-0 text-xs text-muted-foreground sm:block">Updated {new Date(record.updatedAt).toLocaleDateString()}</span></CardContent></Card></Link>;
        })}
      </div>}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save search</DialogTitle><DialogDescription>Save the current text, record type, and status filters for later.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="saved-search-name">Search name</Label><Input id="saved-search-name" value={savedSearchName} onChange={(event) => setSavedSearchName(event.target.value)} maxLength={80} placeholder="e.g. Open engineering projects" onKeyDown={(event) => { if (event.key === "Enter") void saveSearch(); }} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button><Button onClick={() => void saveSearch()} disabled={saving}>{saving ? "Saving…" : "Save search"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}