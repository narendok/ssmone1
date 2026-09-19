import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/inventory/InventoryView";

export const Route = createFileRoute("/_authenticated/category/$slug")({
  head: ({ params }) => {
    const category = params.slug.replace(/-/g, " ");
    const title = category.charAt(0).toUpperCase() + category.slice(1);
    return { meta: [{ title: `${title} Inventory — SSM One` }, { name: "description", content: `PartsBench inventory for the ${category} category.` }, { property: "og:title", content: `${title} Inventory — SSM One` }, { property: "og:description", content: `PartsBench inventory for the ${category} category.` }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const title = slug.charAt(0).toUpperCase() + slug.slice(1);
  return <InventoryView categorySlug={slug} title={title} subtitle={`Showing parts in the ${slug} category`} />;
}
