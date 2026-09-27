import { createFileRoute } from "@tanstack/react-router";
import { DepartmentLeadDashboard } from "@/components/dashboards/DepartmentLeadDashboard";

export const Route = createFileRoute("/_authenticated/dashboards/")({
  head: () => ({ meta: [{ title: "Department command center — SSM One" }, { name: "description", content: "Department-led work queues, operational actions, and workload summaries for SSM One." }, { property: "og:title", content: "Department command center — SSM One" }, { property: "og:description", content: "Department-led work queues, operational actions, and workload summaries for SSM One." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: DepartmentLeadDashboard,
});