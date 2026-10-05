import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export function PermissionGate({ permission, children, fallback = null }: { permission: string | string[]; children: ReactNode; fallback?: ReactNode }) {
  const { role, permissions, employeeStatus, loading } = useAuth();
  const requestedPermissions = Array.isArray(permission) ? permission : [permission];
  const allowed = role === "admin" || requestedPermissions.some((key) => permissions.includes(key));
  if (loading) return null;
  if (employeeStatus !== "SUSPENDED" && employeeStatus !== "EXITED" && allowed) return <>{children}</>;
  return <>{fallback}</>;
}