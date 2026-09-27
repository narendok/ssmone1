import { createFileRoute } from "@tanstack/react-router";
import { UnifiedRecordsSearch } from "@/components/records/UnifiedRecordsSearch";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({
    meta: [
      { title: "Unified records search — SSM One" },
      { name: "description", content: "Search clients, projects, audit packs, and controlled documents across SSM One." },
      { property: "og:title", content: "Unified records search — SSM One" },
      { property: "og:description", content: "Search clients, projects, audit packs, and controlled documents across SSM One." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnifiedRecordsSearch,
});