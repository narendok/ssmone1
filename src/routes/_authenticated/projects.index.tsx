import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchProjects } from "@/lib/projects";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — PartsBench" },
      { name: "description", content: "Every hardware project with its files, firmware builds and CAD models." },
      { property: "og:title", content: "Projects — PartsBench" },
      {
        property: "og:description",
        content: "Every hardware project with its files, firmware builds and CAD models.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Open a project for its files, firmware and mechanical parts.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/settings/projects"><Settings className="h-4 w-4 mr-1" /> Manage</Link>
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
      ) : projects.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No projects yet — add one under Manage and its folder tree is created automatically.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
              <Card className="p-4 h-full hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="h-8 w-2 rounded-sm" style={{ background: p.color }} />
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{p.code}</span>
                  {p.status === "archived" && <Badge variant="secondary">archived</Badge>}
                </div>
                <p className="mt-2 font-medium">{p.name}</p>
                {p.revision && <p className="text-xs text-muted-foreground">rev {p.revision}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
