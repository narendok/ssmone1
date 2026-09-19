import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/inventory/InventoryView";

export const Route = createFileRoute("/_authenticated/category/$slug")({
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const title = slug.charAt(0).toUpperCase() + slug.slice(1);
  return <InventoryView categorySlug={slug} title={title} subtitle={`Showing parts in the ${slug} category`} />;
}
