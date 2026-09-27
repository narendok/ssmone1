import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/dashboards/CommandCenter";

export const Route = createFileRoute("/_authenticated/command-center")({
  head: () => ({ meta: [{ title: "My day — SSM One" }, { name: "description", content: "Department task workspace for due work, priorities, owners, projects, and document references." }, { property: "og:title", content: "My day — SSM One" }, { property: "og:description", content: "Department task workspace for due work, priorities, owners, projects, and document references." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CommandCenter,
});