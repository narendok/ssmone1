import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/inventory/InventoryView";

export const Route = createFileRoute("/_authenticated/")({
  component: () => <InventoryView title="All inventory" subtitle="Every component across categories" />,
});
