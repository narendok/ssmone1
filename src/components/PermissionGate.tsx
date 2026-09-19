import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export function PermissionGate({ permission, children, fallback = null }: { permission: string; children: ReactNode; fallback?: ReactNode }) {
  const { role, permissions } = useAuth();
  if (role === "admin" || permissions.includes(permission)) return <>{children}</>;
  return <>{fallback}</>;
}