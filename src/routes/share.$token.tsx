import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSharedBom } from "@/lib/shared-bom.functions";

export const Route = createFileRoute("/share/$token")({
  loader: ({ params }) => getSharedBom({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Shared component list — PartsBench" },
      { name: "description", content: "A read-only shared list of components with their in-stock substitutes and notes." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Shared component list — PartsBench" },
      { property: "og:description", content: "Components with substitutes, stock and notes, shared read-only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <Centered>Could not load this shared list.</Centered>,
  notFoundComponent: () => <Centered>This shared list does not exist.</Centered>,
  component: SharePage,
});

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center p-8 text-sm text-muted-foreground">{children}</div>
  );
}

function SharePage() {
  const data = Route.useLoaderData();

  if (!data) return <Centered>This link is invalid, revoked or expired.</Centered>;

  const headers = data.columns.length ? data.columns : data.rows.length ? Object.keys(data.rows[0]) : [];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Read-only snapshot · {data.rows.length} components · created{" "}
            {new Date(data.created_at).toLocaleString()}
          </p>
        </div>
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r, i) => (
                <TableRow key={i}>
                  {headers.map((h) => (
                    <TableCell key={h} className={h === "Part number" ? "font-mono text-xs" : "text-sm"}>
                      {String(r[h] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
