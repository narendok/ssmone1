import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  downloadNode, extOf, fetchProjectFilesByType, folderIdBySlug, formatBytes, updateNodeMetadata, uploadFile,
  type DriveNode,
} from "@/lib/drive";
import { FilePreviewDialog } from "./FilePreviewDialog";

const SPECS = [
  { key: "material", label: "Material", placeholder: "Al 6061-T6" },
  { key: "finish", label: "Finish", placeholder: "Anodised black" },
  { key: "ip_rating", label: "IP rating", placeholder: "IP65" },
  { key: "weight", label: "Weight", placeholder: "180 g" },
  { key: "fasteners", label: "Fasteners", placeholder: "4 × M3 × 8 SS" },
] as const;

export function CadVault({ projectId }: { projectId: string }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DriveNode | null>(null);
  const [editing, setEditing] = useState<DriveNode | null>(null);

  const { data: files = [], refetch, isLoading } = useQuery({
    queryKey: ["cad_files", projectId],
    queryFn: () => fetchProjectFilesByType(projectId, ["CAD_STL", "CAD_STEP"]),
  });

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const parentId = await folderIdBySlug(projectId, "cad");
      await uploadFile({ file, parentId, projectId });
      toast.success(`${file.name} uploaded`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the model");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          STL models open in the 3D viewer. STEP and native CAD files are stored for download.
        </p>
        <Button onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Upload model
        </Button>
        <input
          ref={input}
          type="file"
          accept=".stl,.step,.stp,.igs,.iges,.sldprt,.f3d"
          className="hidden"
          onChange={(e) => {
            handleUpload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
      ) : files.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No CAD models uploaded yet.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((f) => (
            <Card key={f.id} className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Box className="h-6 w-6 text-violet-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={f.name}>{f.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(f.file_size_bytes)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {SPECS.filter((s) => f.metadata?.[s.key]).map((s) => (
                  <Badge key={s.key} variant="secondary" className="text-[10px]">
                    {s.label}: {f.metadata[s.key]}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                {extOf(f.name) === "stl" && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview(f)}>
                    View 3D
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(f)}>Specs</Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadNode(f)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FilePreviewDialog node={preview} onOpenChange={(o) => !o && setPreview(null)} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="truncate">Specs — {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const next: Record<string, any> = { ...editing.metadata };
                SPECS.forEach((s) => (next[s.key] = String(fd.get(s.key) ?? "")));
                try {
                  await updateNodeMetadata(editing.id, next);
                  toast.success("Specs saved");
                  refetch();
                  setEditing(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not save");
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                {SPECS.map((s) => (
                  <div key={s.key} className="space-y-1.5">
                    <Label>{s.label}</Label>
                    <Input name={s.key} defaultValue={editing.metadata?.[s.key] ?? ""} placeholder={s.placeholder} />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
