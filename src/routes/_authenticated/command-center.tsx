import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/dashboards/CommandCenter";

export const Route = createFileRoute("/_authenticated/command-center")({
  head: () => ({ meta: [{ title: "Command Center — SSM One" }, { name: "description", content: "Daily operating view for priorities, decisions, and delivery progress in SSM One." }, { property: "og:title", content: "Command Center — SSM One" }, { property: "og:description", content: "Daily operating view for priorities, decisions, and delivery progress in SSM One." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CommandCenter,
});