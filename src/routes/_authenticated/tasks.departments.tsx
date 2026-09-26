import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, TASK_STATUSES, fetchTasks } from "@/lib/tasks";
import type { RDMember } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/tasks/departments")({
  head: () => ({
    meta: [
      { title: "Departments — PartsBench" },
      { name: "description", content: "Workload by department: hardware, firmware, mechanical, QA, procurement, production and PM." },
      { property: "og:title", content: "Departments — PartsBench" },
      { property: "og:description", content: "Workload by department: hardware, firmware, mechanical, QA, procurement, production and PM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { data: tasks = [] } = useQuery({ queryKey: ["project_tasks", "all"], queryFn: () => fetchTasks() });
  const { data: members = [] } = useQuery({
    queryKey: ["rd_members_all"],
    queryFn: async () => {
      const { data } = await supabase.from("rd_members").select("*").order("name");
      return (data ?? []) as (RDMember & { department: string | null })[];
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> Departments
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Workload and responsible people by department.
          </p>
        </div>
        <Button asChild variant="outline"><Link to="/rd-team">Manage team</Link></Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENTS.map((d) => {
          const mine = tasks.filter((t) => t.department === d.value);
          const done = mine.filter((t) => t.status === "done").length;
          const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
          const people = members.filter((m) => m.department === d.value);
          return (
            <Card key={d.value} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", d.dot)} />
                <h2 className="font-semibold">{d.label}</h2>
                <Badge variant="outline" className={cn("ml-auto", d.pill)}>{mine.length} tasks</Badge>
              </div>
              <Progress value={pct} className="h-1.5" />
              <div className="text-xs text-muted-foreground">{done} of {mine.length} done</div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {TASK_STATUSES.filter((s) => s.value !== "done").map((s) => (
                  <span key={s.value} className="rounded bg-muted px-1.5 py-0.5">
                    {s.label}: {mine.filter((t) => t.status === s.value).length}
                  </span>
                ))}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Team: </span>
                {people.length ? people.map((p) => p.name).join(", ") : <Link className="text-primary hover:underline" to="/rd-team">Create a responsible member</Link>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
