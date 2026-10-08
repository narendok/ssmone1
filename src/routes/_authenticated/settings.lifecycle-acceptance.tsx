import { createFileRoute } from "@tanstack/react-router";
import { LifecycleAcceptanceDiagnostics } from "@/components/lifecycle/LifecycleAcceptanceDiagnostics";

export const Route = createFileRoute("/_authenticated/settings/lifecycle-acceptance")({
  head: () => ({ meta: [
    { title: "Lifecycle Acceptance Diagnostics — SSM One" },
    { name: "description", content: "Manual, scoped read-only lifecycle acceptance diagnostics for the isolated environment." },
    { property: "og:title", content: "Lifecycle Acceptance Diagnostics — SSM One" },
    { property: "og:description", content: "Manual, scoped read-only lifecycle acceptance diagnostics for the isolated environment." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LifecycleAcceptanceDiagnostics,
});