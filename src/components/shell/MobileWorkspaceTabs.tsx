import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, LayoutDashboard, Menu, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { useAuth } from "@/hooks/useAuth";

type WorkspaceTarget = { to: string; label: string; permission?: string };

function workTarget(role: string | null, permissions: string[]): WorkspaceTarget {
  if (role === "admin" || permissions.includes("engineering.view")) return { to: "/projects", label: "Engineering work", permission: "engineering.view" };
  if (permissions.includes("hr.view")) return { to: "/hr", label: "People work", permission: "hr.view" };
  if (permissions.includes("procurement.view")) return { to: "/procurement/requests", label: "Purchasing work", permission: "procurement.view" };
  if (permissions.includes("production.view")) return { to: "/production", label: "Production work", permission: "production.view" };
  if (permissions.includes("quality.view") || permissions.includes("qms.view")) return { to: "/qms", label: "Quality work", permission: "quality.view" };
  if (permissions.includes("sales.view")) return { to: "/sales", label: "Sales work", permission: "sales.view" };
  return { to: "/tasks", label: "My work", permission: "my_work.view" };
}

export function MobileWorkspaceTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { role, permissions, employeeStatus } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const work = useMemo(() => workTarget(role, permissions), [permissions, role]);
  const inactive = employeeStatus === "SUSPENDED" || employeeStatus === "EXITED";
  const canScan = role === "admin" || permissions.includes("engineering.view") || permissions.includes("stores.view");
  const isActive = (to: string) => to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

  if (inactive) return null;

  return (
    <nav aria-label="Workspace navigation" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid h-16 grid-cols-5 items-center">
        <TabLink to="/command-center" label="Dashboard" active={isActive("/command-center")}><LayoutDashboard className="size-5" /></TabLink>
        <TabLink to={work.to} label="Work" active={isActive(work.to)}><Wrench className="size-5" /></TabLink>
        <GlobalSearch mobile canScan={canScan} />
        <TabLink to="/drive" label="Drive" active={isActive("/drive")}><FolderOpen className="size-5" /></TabLink>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" className="h-full flex-col gap-1 rounded-none px-1 text-xs"><Menu className="size-5" />More</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-lg">
            <SheetHeader><SheetTitle>More workspace areas</SheetTitle></SheetHeader>
            <div className="mt-5 grid gap-2">
              <MoreLink to="/dashboards" label="Department dashboard" onClick={() => setMoreOpen(false)} />
              <MoreLink to="/tasks" label="Tasks" onClick={() => setMoreOpen(false)} />
              <MoreLink to="/records" label="Records search" onClick={() => setMoreOpen(false)} />
              {(role === "admin" || permissions.includes("admin.view")) && <MoreLink to="/admin" label="Administration" onClick={() => setMoreOpen(false)} />}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

function TabLink({ to, label, active, children }: { to: WorkspaceTarget["to"] | "/command-center" | "/drive"; label: string; active: boolean; children: React.ReactNode }) {
  return <Button asChild variant="ghost" className={`h-full flex-col gap-1 rounded-none px-1 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}><Link to={to}>{children}{label}</Link></Button>;
}

function MoreLink({ to, label, onClick }: { to: "/dashboards" | "/tasks" | "/records" | "/admin"; label: string; onClick: () => void }) {
  return <Button asChild variant="outline" className="justify-start"><Link to={to} onClick={onClick}>{label}</Link></Button>;
}