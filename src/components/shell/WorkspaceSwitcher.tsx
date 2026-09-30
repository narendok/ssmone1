import { useEffect, useState } from "react";
import { Building2, Check, Layers3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchCanonicalDepartments, type CanonicalDepartment } from "@/lib/tasks";
import { readWorkspaceDepartmentId, setWorkspaceDepartmentId, WORKSPACE_CONTEXT_EVENT } from "@/lib/workspace-context";
import { workspaceForDepartment } from "@/lib/department-workspace-navigation";
import { useAuth } from "@/hooks/useAuth";

export function WorkspaceSwitcher() {
  const { role, permissions, employeeStatus } = useAuth();
  const departments = useQuery({ queryKey: ["active-departments"], queryFn: fetchCanonicalDepartments });
  const [departmentId, setDepartmentId] = useState<string | null>(() => readWorkspaceDepartmentId());

  useEffect(() => {
    const syncWorkspace = () => setDepartmentId(readWorkspaceDepartmentId());
    window.addEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspace);
    window.addEventListener("storage", syncWorkspace);
    return () => {
      window.removeEventListener(WORKSPACE_CONTEXT_EVENT, syncWorkspace);
      window.removeEventListener("storage", syncWorkspace);
    };
  }, []);

  const selectedDepartment = (departments.data ?? []).find((department) => department.id === departmentId) ?? null;
  const workspace = workspaceForDepartment(selectedDepartment);
  const hasWorkspaceAccess = (department: CanonicalDepartment) => role === "admin" || Boolean(workspaceForDepartment(department)?.items.some((item) => !item.permission || permissions.includes(item.permission)));
  const availableDepartments = (departments.data ?? []).filter(hasWorkspaceAccess);
  const triggerLabel = workspace?.label ?? "All workspaces";
  const chooseWorkspace = (nextDepartmentId: string | null) => {
    setWorkspaceDepartmentId(nextDepartmentId);
    setDepartmentId(nextDepartmentId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 max-w-44 gap-1.5 px-2" title="Change department workspace" aria-label={`Department workspace: ${triggerLabel}`}>
          <Building2 className="size-4 shrink-0" />
          <span className="hidden truncate text-xs font-medium lg:inline">{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Department workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {role === "admin" && <WorkspaceItem label="All workspaces" active={!departmentId} onSelect={() => chooseWorkspace(null)} icon={<Layers3 className="size-4" />} />}
        {availableDepartments.map((department) => (
          <WorkspaceItem
            key={department.id}
            label={workspaceForDepartment(department)?.label ?? department.name}
            active={department.id === departmentId}
            onSelect={() => chooseWorkspace(department.id)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceItem({ label, active, onSelect, icon }: { label: string; active: boolean; onSelect: () => void; icon?: React.ReactNode }) {
  return <DropdownMenuItem onSelect={onSelect} className="flex items-center gap-2">{icon ?? <Building2 className="size-4" />}<span className="flex-1">{label}</span>{active && <Check className="size-4 text-primary" />}</DropdownMenuItem>;
}