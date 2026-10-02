import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Folder, FileText, FileCode2, Box, Image as ImageIcon, FileSpreadsheet, File as FileIcon,
  Star, MoreVertical, Upload, FolderPlus, Search, LayoutGrid, List, Loader2, Download,
  Link2, History, Pencil, Trash2, ChevronRight, Home, Lock, FolderTree, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  createFolder, downloadNode, extOf, fetchBreadcrumbs, fetchChildren, fetchDriveCategoryTemplates, fetchFavorites, formatBytes,
  fetchDepartmentDriveRoots, renameNode, toggleStar, trashNode, uploadFile, FOLDER_COLOR, type DriveNode,
} from "@/lib/drive";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { RevisionsDialog } from "./RevisionsDialog";
import { ShareNodeDialog } from "./ShareNodeDialog";
import { fetchDriveProjectBoms, type DriveProjectBomSummary } from "@/lib/project-bom.functions";
import { readWorkspaceDepartmentId, WORKSPACE_CONTEXT_EVENT } from "@/lib/workspace-context";
import { useAuth } from "@/hooks/useAuth";
import { buildDepartmentDriveTaxonomy } from "@/lib/department-drive-navigation";
import { canPresentProjectBoms, shouldRequestProjectBoms } from "@/lib/drive-presentation-policy";
import { fetchCanonicalDepartments } from "@/lib/tasks";

type Filter = "all" | "common" | "internal" | "client" | "starred" | "ppap" | "boms";

function iconFor(node: DriveNode) {
  if (node.node_type === "FOLDER") return Folder;
  const e = extOf(node.name);
  if (e === "pdf") return FileText;
  if (["bin", "hex", "elf", "uf2"].includes(e)) return FileCode2;
  if (["stl", "step", "stp"].includes(e)) return Box;
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(e)) return ImageIcon;
  if (["csv", "xls", "xlsx"].includes(e)) return FileSpreadsheet;
  return FileIcon;
}

export function DriveBrowser({ projectId = null, departmentId = null, initialNodeId }: { projectId?: string | null; departmentId?: string | null; initialNodeId?: string }) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const fetchBoms = useServerFn(fetchDriveProjectBoms);
  const [workspaceDepartmentId, setWorkspaceDepartmentId] = useState<string | null>(() => readWorkspaceDepartmentId());
  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"grid" | "list">("list");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<DriveNode | null>(null);
  const [revisionsFor, setRevisionsFor] = useState<DriveNode | null>(null);
  const [shareFor, setShareFor] = useState<DriveNode | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const { data: initialNode } = useQuery({
    queryKey: ["drive_node", initialNodeId],
    queryFn: async () => {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase.from("drive_nodes").select("*").eq("id", initialNodeId ?? "").maybeSingle();
      if (error) throw error;
      return data as DriveNode | null;
    },
    enabled: Boolean(initialNodeId),
  });
  const activeDepartmentId = departmentId ?? workspaceDepartmentId ?? initialNode?.department_id ?? null;
  const canBrowseAllWorkspaces = role === "admin" && !activeDepartmentId;
  const childrenKey = ["drive_children", projectId, activeDepartmentId, folderId];
  const { data: nodes = [], isLoading, isError, error } = useQuery({
    queryKey: childrenKey,
    queryFn: () => fetchChildren(folderId, projectId, activeDepartmentId),
    enabled: Boolean(projectId || activeDepartmentId || canBrowseAllWorkspaces),
  });
  const { data: crumbs = [] } = useQuery({
    queryKey: ["drive_crumbs", folderId],
    queryFn: () => (folderId ? fetchBreadcrumbs(folderId) : Promise.resolve([])),
    enabled: !!folderId,
  });
  const { data: favorites = new Set<string>() } = useQuery({
    queryKey: ["drive_favorites"],
    queryFn: fetchFavorites,
  });
  const { data: projectBoms = [], isLoading: bomsLoading, isError: bomsError, error: bomsErrorDetail } = useQuery({
    queryKey: ["drive_project_boms", activeDepartmentId],
    queryFn: () => fetchBoms(),
    enabled: shouldRequestProjectBoms({ filter, projectId, department: activeDepartment }),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["drive_category_templates", activeDepartmentId],
    queryFn: () => fetchDriveCategoryTemplates(activeDepartmentId),
    enabled: Boolean(activeDepartmentId),
  });
  const { data: departmentRoots = [] } = useQuery({
    queryKey: ["department_drive_roots", activeDepartmentId],
    queryFn: () => fetchDepartmentDriveRoots(activeDepartmentId ?? ""),
    enabled: Boolean(activeDepartmentId && !projectId),
  });
  const { data: departments = [] } = useQuery({ queryKey: ["active-departments"], queryFn: fetchCanonicalDepartments });
  const activeDepartment = useMemo(() => departments.find((department) => department.id === activeDepartmentId) ?? null, [departments, activeDepartmentId]);
  const canBrowseProjectBoms = Boolean(projectId) || canPresentProjectBoms(activeDepartment);

  useEffect(() => {
    const syncWorkspace = () => setWorkspaceDepartmentId(readWorkspaceDepartmentId());
    window.addEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspace);
    window.addEventListener("storage", syncWorkspace);
    return () => {
      window.removeEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspace);
      window.removeEventListener("storage", syncWorkspace);
    };
  }, []);

  useEffect(() => {
    setFolderId(null);
    setSearch("");
    setFilter("all");
    setPreview(null);
    setRevisionsFor(null);
    setShareFor(null);
  }, [departmentId, workspaceDepartmentId, projectId]);

  useEffect(() => {
    if (!initialNode) return;
    if (initialNode.node_type === "FOLDER") setFolderId(initialNode.id);
    else setPreview(initialNode);
  }, [initialNode, departmentId]);

  useEffect(() => {
    if (!activeDepartmentId || projectId || folderId || filter === "all" || filter === "starred" || filter === "ppap" || filter === "boms") return;
    const folderKind = filter === "common" ? "DEPARTMENT_STANDARDS" : filter === "internal" ? "INTERNAL_PROJECTS" : "CLIENT_PROJECTS";
    const target = departmentRoots.find((root) => root.folder_kind === folderKind);
    if (target) setFolderId(target.id);
  }, [activeDepartmentId, departmentRoots, filter, folderId, projectId]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["drive_children"] });
    qc.invalidateQueries({ queryKey: ["drive_favorites"] });
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nodes.filter((n) => {
      if (q && !n.name.toLowerCase().includes(q)) return false;
      if (filter === "starred" && !(n.is_starred || favorites.has(n.id))) return false;
      if (filter === "ppap" && !n.slug.startsWith("ppap") && !n.name.includes("PPAP")) return false;
      return true;
    });
  }, [nodes, search, filter, favorites]);

  const rootCategories = useMemo(() => {
    if (projectId || folderId) return [];
    return categories.filter((category) => category.placement === "COMMON" && category.is_active);
  }, [categories, folderId, projectId]);
  const departmentTaxonomy = useMemo(() => buildDepartmentDriveTaxonomy(departmentRoots, categories), [departmentRoots, categories]);

  const visibleBoms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projectBoms as DriveProjectBomSummary[];
    return (projectBoms as DriveProjectBomSummary[]).filter((bom) =>
      [bom.bom_number, bom.name, bom.project_name, bom.project_code, bom.source_filename]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(q)),
    );
  }, [projectBoms, search]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        setBusy(`Uploading ${file.name}…`);
        await uploadFile({ file, parentId: folderId, projectId: projectId ?? initialNode?.project_id ?? null, departmentId: activeDepartmentId, onProgress: (l) => setBusy(`${file.name}: ${l}`) });
        toast.success(`${file.name} uploaded`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Could not upload ${file.name}`);
      }
    }
    setBusy(null);
    refresh();
  }

  async function handleNewFolder() {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    try {
      await createFolder({ name: name.trim(), parentId: folderId, projectId: projectId ?? initialNode?.project_id ?? null, departmentId: activeDepartmentId });
      toast.success("Folder created");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the folder");
    }
  }

  async function handleRename(node: DriveNode) {
    const name = window.prompt("New name", node.name);
    if (!name?.trim() || name === node.name) return;
    try {
      await renameNode(node.id, name.trim());
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename");
    }
  }

  async function handleTrash(node: DriveNode) {
    if (!window.confirm(`Move "${node.name}" to trash?`)) return;
    try {
      await trashNode(node);
      toast.success("Moved to trash");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove this item");
    }
  }

  async function handleStar(node: DriveNode) {
    try {
      const on = await toggleStar(node.id);
      qc.setQueryData(["drive_favorites"], (prev: Set<string> | undefined) => {
        const next = new Set(prev ?? []);
        if (on) next.add(node.id);
        else next.delete(node.id);
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the star");
    }
  }

  function openNode(node: DriveNode) {
    if (node.node_type === "FOLDER") {
      setFolderId(node.id);
      setSearch("");
    } else {
      setPreview(node);
    }
  }

  const Row = ({ node }: { node: DriveNode }) => {
    const Icon = iconFor(node);
    const starred = node.is_starred || favorites.has(node.id);
    const menu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => handleStar(node)}>
            <Star className="h-4 w-4 mr-2" /> {starred ? "Remove star" : "Star as audit-critical"}
          </DropdownMenuItem>
          {node.node_type === "FILE" && (
            <>
              <DropdownMenuItem onClick={() => downloadNode(node)}>
                <Download className="h-4 w-4 mr-2" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareFor(node)}>
                <Link2 className="h-4 w-4 mr-2" /> Share link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRevisionsFor(node)}>
                <History className="h-4 w-4 mr-2" /> Versions (v{node.current_version})
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleRename(node)} disabled={node.is_locked}>
            <Pencil className="h-4 w-4 mr-2" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleTrash(node)}
            disabled={node.is_locked}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    if (view === "grid") {
      return (
        <Card
          className="p-3 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => openNode(node)}
        >
          <div className="flex items-start justify-between">
            <Icon className={cn("h-8 w-8", node.node_type === "FOLDER" ? FOLDER_COLOR[node.slug] ?? "text-muted-foreground" : "text-muted-foreground")} />
            <div className="flex items-center">
              {starred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
              {menu}
            </div>
          </div>
          <p className="mt-2 truncate text-sm font-medium" title={node.name}>{node.name}</p>
          <p className="text-xs text-muted-foreground">
            {node.node_type === "FOLDER" ? "Folder" : formatBytes(node.file_size_bytes)}
          </p>
        </Card>
      );
    }

    return (
      <div
        className="flex items-center gap-3 border-b px-3 py-2 text-sm hover:bg-accent/50 cursor-pointer"
        onClick={() => openNode(node)}
      >
        <Icon className={cn("h-4 w-4 flex-shrink-0", node.node_type === "FOLDER" ? FOLDER_COLOR[node.slug] ?? "text-muted-foreground" : "text-muted-foreground")} />
        <span className="flex-1 truncate">{node.name}</span>
        {node.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        {starred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
        {node.node_type === "FILE" && node.current_version > 1 && (
          <Badge variant="secondary" className="text-[10px]">v{node.current_version}</Badge>
        )}
        <span className="hidden sm:block w-20 text-right text-xs text-muted-foreground">
          {node.node_type === "FOLDER" ? "—" : formatBytes(node.file_size_bytes)}
        </span>
        <span className="hidden md:block w-24 text-right text-xs text-muted-foreground">
          {new Date(node.updated_at).toLocaleDateString()}
        </span>
        {menu}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={filter === "boms" ? "Search BOM number, name, or project…" : "Search this folder…"}
            className="pl-8"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {!projectId && activeDepartmentId && <TabsTrigger value="common">Controlled documents</TabsTrigger>}
            {!projectId && activeDepartmentId && <TabsTrigger value="internal">Internal projects</TabsTrigger>}
             {!projectId && activeDepartmentId && <TabsTrigger value="client">Client projects</TabsTrigger>}
            <TabsTrigger value="ppap">PPAP</TabsTrigger>
            <TabsTrigger value="starred">Starred</TabsTrigger>
            {canBrowseProjectBoms && <TabsTrigger value="boms">Project BOMs</TabsTrigger>}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="icon" onClick={() => setView(view === "list" ? "grid" : "list")} disabled={filter === "boms"}>
          {view === "list" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
        </Button>
        <Button variant="outline" onClick={handleNewFolder} disabled={filter === "boms"}>
          <FolderPlus className="h-4 w-4 mr-1" /> Folder
        </Button>
        <Button onClick={() => fileInput.current?.click()} disabled={!!busy || filter === "boms"}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Upload
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => { setFilter("all"); setFolderId(null); }}>
          <Home className="h-3.5 w-3.5" /> {projectId ? "Project files" : "Drive"}
        </button>
        {crumbs.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            <button
              className={cn("hover:text-foreground", c.id === folderId && "text-foreground font-medium")}
              onClick={() => setFolderId(c.id)}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      {!projectId && activeDepartmentId && !folderId && (
        <div className="grid gap-2 sm:grid-cols-3" aria-label="Department Drive taxonomy">
          {departmentTaxonomy.map((entry) => (
            <Card key={entry.key} className="p-3">
              <p className="text-sm font-medium">{entry.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
              {entry.mappingState === "mapped" ? (
                <p className="mt-2 text-xs text-muted-foreground">{entry.categoryCount} configured template{entry.categoryCount === 1 ? "" : "s"}</p>
              ) : (
                <p className="mt-2 text-xs text-destructive">No verified folder mapping</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {!projectId && !activeDepartmentId && !canBrowseAllWorkspaces ? <Card className="p-8 text-center text-muted-foreground">Select a department workspace to open its Drive.</Card> : <>
      {busy && <p className="text-xs text-muted-foreground">{busy}</p>}

       {filter === "boms" ? (
        bomsLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading project BOMs…</Card>
        ) : bomsError ? (
          <Card className="border-destructive/40 bg-destructive/5 p-8 text-center text-sm text-destructive">
            {bomsErrorDetail instanceof Error ? bomsErrorDetail.message : "Project BOMs could not be loaded with your current access."}
          </Card>
        ) : visibleBoms.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No accessible project BOMs match this search.</Card>
        ) : (
          <Card className="overflow-hidden">
            {visibleBoms.map((bom) => (
              <Link
                key={bom.id}
                to="/bom"
                search={{ loadBom: bom.id } as any}
                className="flex items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0 hover:bg-accent/50"
              >
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{bom.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{bom.bom_number}</span>
                    {bom.revision && <Badge variant="secondary">Rev {bom.revision}</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{bom.project_code ? `${bom.project_code} · ` : ""}{bom.project_name}</span>
                    <span>{bom.line_count} line items</span>
                    {bom.source_filename && <span className="truncate">{bom.source_filename}</span>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </Card>
        )
       ) : isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/5 p-8 text-center text-sm text-destructive">{error instanceof Error ? error.message : "This folder could not be loaded with your current access."}</Card>
       ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No accessible items are stored in this folder.
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {visible.map((n) => <Row key={n.id} node={n} />)}
        </div>
      ) : (
        <Card className="overflow-hidden">
          {visible.map((n) => <Row key={n.id} node={n} />)}
        </Card>
      )}

       {rootCategories.length > 0 && filter === "all" && (
         <div className="border-t pt-4">
           <div className="mb-2 flex items-center gap-2 text-sm font-medium"><FolderTree className="h-4 w-4 text-muted-foreground" /> Department document categories</div>
           <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
             {rootCategories.map((category) => (
               <Card key={category.id} className="flex items-center gap-3 p-3">
                 <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                 <div className="min-w-0"><p className="truncate text-sm font-medium">{category.label}</p><p className="text-xs text-muted-foreground">Common department documents</p></div>
               </Card>
             ))}
           </div>
         </div>
       )}

      <FilePreviewDialog node={preview} onOpenChange={(o) => !o && setPreview(null)} />
      <RevisionsDialog
        node={revisionsFor}
        onOpenChange={(o) => !o && setRevisionsFor(null)}
        onChanged={refresh}
      />
      <ShareNodeDialog node={shareFor} onOpenChange={(o) => !o && setShareFor(null)} />
       </>}
    </div>
  );
}
