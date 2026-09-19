import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, Loader2, Upload, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  downloadNode, fetchProjectFilesByType, folderIdBySlug, formatBytes, updateNodeMetadata, uploadFile,
  type DriveNode,
} from "@/lib/drive";

export function FirmwareVault({ projectId }: { projectId: string }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<DriveNode | null>(null);

  const { data: files = [], refetch, isLoading } = useQuery({
    queryKey: ["firmware_files", projectId],
    queryFn: () => fetchProjectFilesByType(projectId, ["FIRMWARE"]),
  });

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const parentId = (await folderIdBySlug(projectId, "golden-prod")) ?? (await folderIdBySlug(projectId, "firmware"));
      const node = await uploadFile({ file, parentId, projectId });
      toast.success(`${file.name} uploaded — checksum recorded`);
      await refetch();
      setEditing(node);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the build");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Binary releases (.bin, .hex, .elf, .uf2). Each upload is checksummed in your browser before it leaves.
        </p>
        <Button onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Upload build
        </Button>
        <input
          ref={input}
          type="file"
          accept=".bin,.hex,.elf,.uf2"
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
        <Card className="p-8 text-center text-muted-foreground">No firmware builds uploaded yet.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="px-3 py-2 text-left">File</th>
                <th className="px-3 py-2 text-left">Version</th>
                <th className="px-3 py-2 text-left">Target MCU</th>
                <th className="px-3 py-2 text-left">Flash offset</th>
                <th className="px-3 py-2 text-left">Size</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      {f.metadata?.golden && (
                        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30" variant="outline">
                          <Star className="h-3 w-3 mr-1 fill-amber-500" /> Golden production
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-2">{f.metadata?.version || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.metadata?.mcu || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.metadata?.flash_offset || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatBytes(f.file_size_bytes)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!f.sha256_checksum}
                        onClick={() => {
                          navigator.clipboard.writeText(f.sha256_checksum ?? "");
                          toast.success("Checksum copied");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Checksum
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadNode(f)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(f)}>
                        Details
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <FirmwareDetailsDialog node={editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={refetch} />
    </div>
  );
}

function FirmwareDetailsDialog({
  node,
  onOpenChange,
  onSaved,
}: {
  node: DriveNode | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!node) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await updateNodeMetadata(node.id, {
        ...node.metadata,
        version: String(fd.get("version") ?? ""),
        mcu: String(fd.get("mcu") ?? ""),
        flash_offset: String(fd.get("flash_offset") ?? ""),
        golden: fd.get("golden") === "on",
      });
      toast.success("Build details saved");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Build details — {node?.name}</DialogTitle>
        </DialogHeader>
        {node && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Version</Label>
                <Input name="version" defaultValue={node.metadata?.version ?? ""} placeholder="1.4.2" />
              </div>
              <div className="space-y-1.5">
                <Label>Target MCU</Label>
                <Input name="mcu" defaultValue={node.metadata?.mcu ?? ""} placeholder="STM32G474" />
              </div>
              <div className="space-y-1.5">
                <Label>Flash offset</Label>
                <Input name="flash_offset" defaultValue={node.metadata?.flash_offset ?? ""} placeholder="0x08000000" />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" name="golden" defaultChecked={!!node.metadata?.golden} />
                Golden production build
              </label>
            </div>
            <p className="break-all text-xs text-muted-foreground">sha256 {node.sha256_checksum}</p>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
