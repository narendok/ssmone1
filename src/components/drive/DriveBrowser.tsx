import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Folder, FileText, FileCode2, Box, Image as ImageIcon, FileSpreadsheet, File as FileIcon,
  Star, MoreVertical, Upload, FolderPlus, Search, LayoutGrid, List, Loader2, Download,
  Link2, History, Pencil, Trash2, ChevronRight, Home, Lock,
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
  createFolder, downloadNode, extOf, fetchBreadcrumbs, fetchChildren, fetchFavorites, formatBytes,
  renameNode, toggleStar, trashNode, uploadFile, FOLDER_COLOR, type DriveNode,
} from "@/lib/drive";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { RevisionsDialog } from "./RevisionsDialog";
import { ShareNodeDialog } from "./ShareNodeDialog";

type Filter = "all" | "starred" | "ppap";

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

export function DriveBrowser({ projectId = null, initialNodeId }: { projectId?: string | null; initialNodeId?: string }) {
  const qc = useQueryClient();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"grid" | "list">("list");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<DriveNode | null>(null);
  const [revisionsFor, setRevisionsFor] = useState<DriveNode | null>(null);
  const [shareFor, setShareFor] = useState<DriveNode | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const childrenKey = ["drive_children", projectId, folderId];
  const { data: nodes = [], isLoading } = useQuery({
    queryKey: childrenKey,
    queryFn: () => fetchChildren(folderId, projectId),
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
  const { data: initialNode } = useQuery({
    queryKey: ["drive_node", initialNodeId],
    queryFn: async () => {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase.from("drive_nodes").select("*").eq("id", initialNodeId ?? "").maybeSingle();
      if (error) throw error;
      return data as DriveNode | null;
    },
    enabled: Boolean(initialNodeId),
  });

  useEffect(() => {
    if (!initialNode) return;
    if (initialNode.node_type === "FOLDER") setFolderId(initialNode.id);
    else setPreview(initialNode);
  }, [initialNode]);

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

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        setBusy(`Uploading ${file.name}…`);
        await uploadFile({ file, parentId: folderId, projectId, onProgress: (l) => setBusy(`${file.name}: ${l}`) });
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
      await createFolder({ name: name.trim(), parentId: folderId, projectId });
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
            placeholder="Search this folder…"
            className="pl-8"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="starred">Starred</TabsTrigger>
            <TabsTrigger value="ppap">PPAP</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="icon" onClick={() => setView(view === "list" ? "grid" : "list")}>
          {view === "list" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
        </Button>
        <Button variant="outline" onClick={handleNewFolder}>
          <FolderPlus className="h-4 w-4 mr-1" /> Folder
        </Button>
        <Button onClick={() => fileInput.current?.click()} disabled={!!busy}>
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
        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setFolderId(null)}>
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

      {busy && <p className="text-xs text-muted-foreground">{busy}</p>}

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nothing here yet — upload a file or create a folder.
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

      <FilePreviewDialog node={preview} onOpenChange={(o) => !o && setPreview(null)} />
      <RevisionsDialog
        node={revisionsFor}
        onOpenChange={(o) => !o && setRevisionsFor(null)}
        onChanged={refresh}
      />
      <ShareNodeDialog node={shareFor} onOpenChange={(o) => !o && setShareFor(null)} />
    </div>
  );
}
