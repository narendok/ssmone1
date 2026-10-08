import { createFileRoute } from "@tanstack/react-router";
import { LifecycleAcceptanceDiagnostics } from "@/components/admin/LifecycleAcceptanceDiagnostics";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/_authenticated/admin/lifecycle-observation")({
  head: () => ({ meta: [
    { title: "Lifecycle Acceptance Diagnostics — SSM One" },
    { name: "description", content: "Manual, scoped read-only lifecycle acceptance diagnostics for the isolated environment." },
    { property: "og:title", content: "Lifecycle Acceptance Diagnostics — SSM One" },
    { property: "og:description", content: "Manual, scoped read-only lifecycle acceptance diagnostics for the isolated environment." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LifecycleAcceptanceDiagnosticsRoute,
});

function LifecycleAcceptanceDiagnosticsRoute() {
  return <PermissionGate permission="admin.view" fallback={<section className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">Only a Platform Owner can run lifecycle acceptance diagnostics.</p></section>}><div className="mx-auto max-w-4xl"><LifecycleAcceptanceDiagnostics /></div></PermissionGate>;
}