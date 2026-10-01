import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DepartmentProjectTracker } from "@/components/workspaces/DepartmentProjectTracker";
import { fetchCanonicalDepartments } from "@/lib/tasks";
import { readWorkspaceDepartmentId } from "@/lib/workspace-context";

export const Route = createFileRoute("/_authenticated/workspace/projects")({ component: DepartmentProjectsPage });

function DepartmentProjectsPage() {
  const departmentId = readWorkspaceDepartmentId();
  const departments = useQuery({ queryKey: ["active-departments"], queryFn: fetchCanonicalDepartments });
  const department = departments.data?.find((item) => item.id === departmentId);
  if (!departmentId) return <section className="mx-auto max-w-3xl py-16 text-center"><h1 className="text-xl font-semibold">Select a department</h1><p className="mt-2 text-sm text-muted-foreground">Choose a department from the top bar to open its project tracker.</p></section>;
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-sm font-medium text-primary">{department?.name ?? "Department"}</p><h1 className="mt-1 text-2xl font-semibold">Project tracker</h1></div><DepartmentProjectTracker departmentId={departmentId} /></div>;
}