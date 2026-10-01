import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, LayoutDashboard, Menu, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { useAuth } from "@/hooks/useAuth";
import { fetchCanonicalDepartments, type CanonicalDepartment } from "@/lib/tasks";
import { useQuery } from "@tanstack/react-query";
import { readWorkspaceDepartmentId, WORKSPACE_CONTEXT_EVENT } from "@/lib/workspace-context";
import { workspaceForDepartment } from "@/lib/department-workspace-navigation";
import { departmentWorkTarget } from "@/lib/department-workspace";

export function MobileWorkspaceTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { role, permissions, employeeStatus } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [workspaceDepartmentId, setWorkspaceDepartmentId] = useState<string | null>(() => readWorkspaceDepartmentId());
  const departments = useQuery({ queryKey: ["active-departments"], queryFn: fetchCanonicalDepartments });
  const selectedDepartment = (departments.data ?? []).find((department: CanonicalDepartment) => department.id === workspaceDepartmentId) ?? null;
  const workspace = workspaceForDepartment(selectedDepartment);
  const work = selectedDepartment ? departmentWorkTarget(selectedDepartment) : "/command-center";
  const inactive = employeeStatus === "SUSPENDED" || employeeStatus === "EXITED";
  const canScan = role === "admin" || permissions.includes("engineering.view") || permissions.includes("stores.view");
  const isActive = (to: string) => to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  useEffect(() => {
    const syncWorkspace = () => setWorkspaceDepartmentId(readWorkspaceDepartmentId());
    window.addEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspace);
    window.addEventListener("storage", syncWorkspace);
    return () => { window.removeEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspace); window.removeEventListener("storage", syncWorkspace); };
  }, []);
  if (inactive) return null;

  return (
    <nav aria-label="Workspace navigation" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid h-16 grid-cols-5 items-center">
        <TabLink to="/command-center" label="Dashboard" active={isActive("/command-center")}><LayoutDashboard className="size-5" /></TabLink>
        <TabLink to={work} label="Work" active={isActive(work)}><Wrench className="size-5" /></TabLink>
        <GlobalSearch mobile canScan={canScan} />
        <TabLink to="/drive" departmentId={selectedDepartment?.id} label="Drive" active={isActive("/drive")}><FolderOpen className="size-5" /></TabLink>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" className="h-full flex-col gap-1 rounded-none px-1 text-xs"><Menu className="size-5" />More</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-lg">
              <SheetHeader><SheetTitle>{workspace ? `${workspace.label} work` : "More workspace areas"}</SheetTitle></SheetHeader>
            <div className="mt-5 grid gap-2">
               {workspace ? workspace.items.map((item) => <MoreLink key={item.to + item.label} to={item.to} departmentId={item.to === "/drive" ? selectedDepartment?.id : undefined} label={item.label} onClick={() => setMoreOpen(false)} />) : <><MoreLink to="/dashboards" label="Department dashboard" onClick={() => setMoreOpen(false)} /><MoreLink to="/tasks" label="Tasks" onClick={() => setMoreOpen(false)} /><MoreLink to="/records" label="Records search" onClick={() => setMoreOpen(false)} />{(role === "admin" || permissions.includes("admin.view")) && <MoreLink to="/admin" label="System controls" onClick={() => setMoreOpen(false)} />}</>}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

function TabLink({ to, departmentId, label, active, children }: { to: string; departmentId?: string; label: string; active: boolean; children: React.ReactNode }) {
  return <Button asChild variant="ghost" className={`h-full flex-col gap-1 rounded-none px-1 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>{to === "/drive" && departmentId ? <Link to="/drive" search={{ department: departmentId }}>{children}{label}</Link> : <Link to={to}>{children}{label}</Link>}</Button>;
}

function MoreLink({ to, departmentId, label, onClick }: { to: string; departmentId?: string; label: string; onClick: () => void }) {
  return <Button asChild variant="outline" className="justify-start">{to === "/drive" && departmentId ? <Link to="/drive" search={{ department: departmentId }} onClick={onClick}>{label}</Link> : <Link to={to} onClick={onClick}>{label}</Link>}</Button>;
}