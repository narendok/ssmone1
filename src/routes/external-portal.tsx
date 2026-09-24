import { createFileRoute } from "@tanstack/react-router";
import { ExternalPortalWorkspace } from "@/routes/external-portal.$token";
export const Route = createFileRoute("/external-portal")({
  head: () => ({ meta: [{ title: "External portal — SSM One" }, { name: "description", content: "Secure external collaboration workspace." }, { property: "og:title", content: "External portal — SSM One" }, { property: "og:description", content: "Secure external collaboration workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ExternalPortalWorkspace,
});
