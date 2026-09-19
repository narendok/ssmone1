import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchRevisions, formatBytes, signedUrl, uploadRevision, type DriveNode } from "@/lib/drive";

export function RevisionsDialog({
  node,
  onOpenChange,
  onChanged,
}: {
  node: DriveNode | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const { data: revisions = [], refetch } = useQuery({
    queryKey: ["drive_revisions", node?.id],
    queryFn: () => fetchRevisions(node!.id),
    enabled: !!node,
  });

  async function handleUpload(file: File | undefined) {
    if (!file || !node) return;
    setBusy(true);
    try {
      await uploadRevision(node, file, summary);
      toast.success(`Saved as version ${node.current_version + 1}`);
      setSummary("");
      onChanged();
      refetch();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the new version");
    } finally {
      setBusy(false);
    }
  }

  async function openRevision(path: string) {
    try {
      window.open(await signedUrl(path), "_blank", "noopener");
    } catch {
      toast.error("Could not open that version");
    }
  }

  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Versions — {node?.name}</DialogTitle>
          <DialogDescription>Current version is v{node?.current_version}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Upload a new version</Label>
          <Input
            placeholder="What changed? (optional)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <Button onClick={() => input.current?.click()} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Choose file
          </Button>
          <input
            ref={input}
            type="file"
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Previous versions</p>
          {revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No earlier versions yet.</p>
          ) : (
            revisions.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm">
                <span className="font-medium">v{r.version}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  {r.change_summary || "No note"} · {formatBytes(r.file_size_bytes)} ·{" "}
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openRevision(r.storage_path)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
