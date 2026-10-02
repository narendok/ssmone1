import { createFileRoute } from "@tanstack/react-router";
import { LegacyDriveOwnershipReview } from "@/components/admin/LegacyDriveOwnershipReview";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/_authenticated/admin/drive-ownership")({
  head: () => ({ meta: [{ title: "Legacy Drive Ownership Review — SSM One" }, { name: "description", content: "Read-only preflight for legacy Drive ownership and provenance gaps." }, { property: "og:title", content: "Legacy Drive Ownership Review — SSM One" }, { property: "og:description", content: "Read-only preflight for legacy Drive ownership and provenance gaps." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: LegacyDriveOwnershipRoute,
});

function LegacyDriveOwnershipRoute() {
  return <PermissionGate permission="admin.view" fallback={<section className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">Only a Platform Owner can review legacy Drive ownership.</p></section>}><div className="mx-auto max-w-6xl"><LegacyDriveOwnershipReview /></div></PermissionGate>;
}