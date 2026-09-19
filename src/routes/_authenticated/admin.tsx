import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ClipboardList, FileText, Layers3, ShieldCheck, Users } from "lucide-react";
import { PermissionGate } from "@/components/PermissionGate";

const areas = [
  { title: "Organization settings", detail: "Brand, legal entity, regional defaults, and document presentation.", icon: Building2 },
  { title: "Departments", detail: "Official department directory, leads, hierarchy, and active status.", icon: Users },
  { title: "Users & assignments", detail: "Employee identity, access state, roles, and department membership.", icon: ShieldCheck },
  { title: "Roles & permissions", detail: "Reusable role catalogue and permission assignments.", icon: Layers3 },
  { title: "Document numbering", detail: "Controlled-document number formats for future workflows.", icon: FileText },
  { title: "Audit log", detail: "Administrative activity and change history.", icon: ClipboardList },
];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administration — SSM One" }, { name: "description", content: "Organization administration for SSM One." },
    { property: "og:title", content: "Administration — SSM One" }, { property: "og:description", content: "Organization administration for SSM One." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminHome,
});

function AdminHome() {
  return <PermissionGate permission="admin.view" fallback={<AccessDenied />}>
    <section className="mx-auto max-w-6xl space-y-8">
      <div><p className="text-sm font-medium text-primary">System</p><h1 className="mt-1 text-2xl font-semibold">Administration</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage the organization foundation, access model, and configuration for SSM One.</p></div>
      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => <div key={area.title} className="bg-card p-5"><area.icon className="size-5 text-primary" /><h2 className="mt-4 text-sm font-semibold">{area.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{area.detail}</p><span className="mt-5 inline-block text-xs font-medium text-muted-foreground">Configuration workspace</span></div>)}
      </div>
    </section>
  </PermissionGate>;
}

function AccessDenied() { return <section className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">Your account does not have access to administration.</p><Link to="/" className="mt-5 inline-block text-sm font-medium text-primary">Return to workspace</Link></section>; }