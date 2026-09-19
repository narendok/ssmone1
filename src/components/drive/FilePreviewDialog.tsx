import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { downloadNode, extOf, formatBytes, signedUrl, type DriveNode } from "@/lib/drive";

const StlViewer = lazy(() => import("./StlViewer"));

export function FilePreviewDialog({
  node,
  onOpenChange,
}: {
  node: DriveNode | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    setError(null);
    if (!node?.storage_path) return;
    let cancelled = false;
    signedUrl(node.storage_path, 3600)
      .then((u) => !cancelled && setUrl(u))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not open this file"));
    return () => {
      cancelled = true;
    };
  }, [node?.id, node?.storage_path]);

  const ext = node ? extOf(node.name) : "";

  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{node?.name}</DialogTitle>
        </DialogHeader>

        {node && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatBytes(node.file_size_bytes)}</span>
            <span>·</span>
            <span>v{node.current_version}</span>
            {node.sha256_checksum && (
              <>
                <span>·</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-mono hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(node.sha256_checksum!);
                    toast.success("Checksum copied");
                  }}
                >
                  <Copy className="h-3 w-3" /> sha256 {node.sha256_checksum.slice(0, 12)}…
                </button>
              </>
            )}
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => node && downloadNode(node)}>
              <Download className="h-3.5 w-3.5 mr-1" /> Download
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!url && !error && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {url && node && <PreviewBody url={url} ext={ext} name={node.name} />}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ url, ext, name }: { url: string; ext: string; name: string }) {
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
    return <img src={url} alt={name} className="mx-auto max-h-[70vh] rounded-md border" />;
  }
  if (ext === "pdf") return <PdfPreview url={url} />;
  if (ext === "stl") {
    return (
      <Suspense
        fallback={
          <div className="flex h-[420px] items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        }
      >
        <StlViewer url={url} />
      </Suspense>
    );
  }
  if (["csv", "xlsx", "xls"].includes(ext)) return <TablePreview url={url} ext={ext} />;
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      No in-browser preview for .{ext || "this"} files — use Download to open it locally.
    </p>
  );
}

function PdfPreview({ url }: { url: string }) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
        const loaded = await pdfjs.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        setDoc(loaded);
        setPages(loaded.numPages);
        setPage(1);
      } catch {
        if (!cancelled) setError("Could not render this PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!doc || !canvas) return;
    let cancelled = false;
    (async () => {
      const p = await doc.getPage(page);
      if (cancelled) return;
      const viewport = p.getViewport({ scale: 1.4 });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, page, canvas]);

  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-2">
      <div className="max-h-[70vh] overflow-auto rounded-md border bg-muted/20 p-2">
        <canvas ref={setCanvas} className="mx-auto block bg-background shadow-sm" />
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function TablePreview({ url, ext }: { url: string; ext: string }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (ext === "csv") {
          const text = await res.text();
          const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
          if (!cancelled) setRows((parsed.data as string[][]).slice(0, 200));
        } else {
          const buf = await res.arrayBuffer();
          const XLSX = await import("xlsx");
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]!]!;
          const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
          if (!cancelled) setRows(data.slice(0, 200) as string[][]);
        }
      } catch {
        if (!cancelled) setError("Could not read this spreadsheet.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, ext]);

  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>;
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">Empty file.</p>;

  const [header, ...body] = rows;
  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {header!.map((h, i) => (
              <th key={i} className="border-b px-2 py-1.5 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="odd:bg-muted/30">
              {header!.map((_, c) => (
                <td key={c} className="border-b px-2 py-1">
                  {r[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {body.length >= 199 && (
        <p className="p-2 text-center text-xs text-muted-foreground">Showing the first 200 rows.</p>
      )}
    </div>
  );
}
