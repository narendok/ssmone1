import { createFileRoute } from "@tanstack/react-router";
import { CircuitBoard, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveSharedFile } from "@/lib/drive-share.functions";
import { formatBytes } from "@/lib/drive";

export const Route = createFileRoute("/file/$token")({
  loader: ({ params }) => resolveSharedFile({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Shared document — PartsBench" },
      { name: "description", content: "A document shared from the PartsBench engineering document vault." },
      { property: "og:title", content: "Shared document — PartsBench" },
      { property: "og:description", content: "A document shared from the PartsBench engineering document vault." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">This link could not be opened.</p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">This link could not be found.</p>
    </Shell>
  ),
  component: SharedFilePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <CircuitBoard className="h-5 w-5 text-primary" /> PartsBench
      </div>
      <Card className="w-full max-w-md p-6 space-y-4 text-center">{children}</Card>
    </div>
  );
}

function SharedFilePage() {
  const result = Route.useLoaderData();

  if (!result.ok) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Link unavailable</h1>
        <p className="text-sm text-muted-foreground">{result.reason}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <FileText className="mx-auto h-10 w-10 text-primary" />
      <h1 className="text-lg font-semibold break-words">{result.name}</h1>
      <p className="text-xs text-muted-foreground">
        {formatBytes(result.sizeBytes ?? 0)}
        {result.checksum ? ` · sha256 ${result.checksum.slice(0, 16)}…` : ""}
      </p>
      <Button asChild className="w-full">
        <a href={result.url} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4 mr-1" />
          {result.permission === "VIEW" ? "Open document" : "Open / download"}
        </a>
      </Button>
      <p className="text-[11px] text-muted-foreground">This link expires automatically.</p>
    </Shell>
  );
}
