import { useState } from "react";
import { toast } from "sonner";
import { Download, Copy, Link2, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/bom";
import { downloadShareXlsx, rowsToMarkdown, type ShareRow } from "@/lib/bom-share";
import { ShareLinkDialog } from "./ShareLinkDialog";

export function ShareSelectionBar({
  count,
  buildRows,
  baseName,
  onClear,
  onAssign,
}: {
  count: number;
  buildRows: () => ShareRow[];
  baseName: string;
  onClear: () => void;
  onAssign?: () => void;
}) {
  const [sharing, setSharing] = useState<ShareRow[] | null>(null);
  if (count === 0) return null;

  async function copy() {
    const md = rowsToMarkdown(buildRows());
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard not available");
    }
  }

  return (
    <>
      <div className="sticky bottom-4 z-30 mx-auto w-fit max-w-full">
        <div className="flex flex-wrap items-center gap-2 rounded-full border bg-card px-4 py-2 shadow-lg">
          <span className="text-sm font-medium">{count} selected</span>
          <Button variant="ghost" size="sm" onClick={() => downloadCsv(buildRows(), `${baseName}.csv`)}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => downloadShareXlsx(buildRows(), `${baseName}.xlsx`)}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
          {onAssign && (
            <Button variant="secondary" size="sm" onClick={onAssign}>
              <UserPlus className="h-4 w-4" /> Assign bundle
            </Button>
          )}
          <Button size="sm" onClick={() => setSharing(buildRows())}>
            <Link2 className="h-4 w-4" /> Share link
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Clear selection" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {sharing && (
        <ShareLinkDialog
          rows={sharing}
          defaultTitle={`${baseName} (${sharing.length} parts)`}
          onOpenChange={(o) => { if (!o) setSharing(null); }}
        />
      )}
    </>
  );
}
