import { createFileRoute } from "@tanstack/react-router";
import { DriveBrowser } from "@/components/drive/DriveBrowser";

export const Route = createFileRoute("/_authenticated/drive")({
  head: () => ({
    meta: [
      { title: "Drive — PartsBench document vault" },
      {
        name: "description",
        content: "Project files, gerbers, firmware, CAD models and the PPAP audit package in one place.",
      },
      { property: "og:title", content: "Drive — PartsBench document vault" },
      {
        property: "og:description",
        content: "Project files, gerbers, firmware, CAD models and the PPAP audit package in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DrivePage,
});

function DrivePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Drive</h1>
        <p className="text-sm text-muted-foreground">
          Every project gets its own folder tree, including the 18-part PPAP audit package.
        </p>
      </div>
      <DriveBrowser />
    </div>
  );
}
