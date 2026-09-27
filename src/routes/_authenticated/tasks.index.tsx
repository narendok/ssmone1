import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { TaskBoard } from "@/components/tasks/TaskBoard";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({
    meta: [
      { title: "Task board — SSM One" },
      { name: "description", content: "Cross-department task planning with due dates, status, projects, owners, and document references." },
      { property: "og:title", content: "Task board — SSM One" },
      { property: "og:description", content: "Cross-department task planning with due dates, status, projects, owners, and document references." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ListChecks className="h-6 w-6" /> Tasks
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
            Search and manage project work or standalone jobs. Use the board only when you need to move work between stages.
        </p>
      </div>
      <TaskBoard />
    </div>
  );
}
