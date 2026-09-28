import { createFileRoute } from "@tanstack/react-router";
import { HrPage } from "./hr";

export const Route = createFileRoute("/_authenticated/hr/")({
  head: () => ({
    meta: [
      { title: "HR — SSM One" },
      { name: "description", content: "Recruitment, leave, onboarding, and training operations for SSM One." },
      { property: "og:title", content: "HR — SSM One" },
      { property: "og:description", content: "Recruitment, leave, onboarding, and training operations for SSM One." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HrPage,
});