import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/inventory/InventoryView";
import { PermissionGate } from "@/components/PermissionGate";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "PartsBench Inventory — SSM One" }, { name: "description", content: "Engineering inventory and component operations for SSM One." },
    { property: "og:title", content: "PartsBench Inventory — SSM One" }, { property: "og:description", content: "Engineering inventory and component operations for SSM One." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <PermissionGate permission="inventory.view" fallback={<AccessDenied />}><InventoryView title="All inventory" subtitle="Every component across categories" /></PermissionGate>,
});

function AccessDenied() {
  return <div className="p-6 text-sm text-muted-foreground">You do not have access to inventory records.</div>;
}
