import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/production")({
  component: ProductionLayout,
});

function ProductionLayout() {
  return <Outlet />;
}
