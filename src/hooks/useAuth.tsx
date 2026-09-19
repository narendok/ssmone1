import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "member" | "purchase" | "storekeeper" | "project_manager" | "lead_engineer";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  displayName: string | null;
  employeeStatus: string | null;
  permissions: string[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  role: null,
  displayName: null,
  employeeStatus: null,
  permissions: [],
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIdentity = useCallback(async (user: User) => {
    const [roleResult, profileResult, employeeResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.from("employees").select("id, display_name, employment_status").eq("user_id", user.id).maybeSingle(),
    ]);

    setRole((roleResult.data?.role as Role | undefined) ?? "member");
    setDisplayName(employeeResult.data?.display_name ?? profileResult.data?.display_name ?? user.user_metadata?.display_name ?? null);
    setEmployeeStatus(employeeResult.data?.employment_status ?? null);

    if (!employeeResult.data?.id) {
      setPermissions([]);
      return;
    }

    const { data } = await supabase
      .from("employee_access_roles")
      .select("access_roles(access_role_permissions(permissions(key)))")
      .eq("employee_id", employeeResult.data.id);
    const keys = (data ?? []).flatMap((assignment) => {
      const accessRole = assignment.access_roles as unknown as { access_role_permissions?: { permissions?: { key?: string | null } | null }[] } | null;
      return (accessRole?.access_role_permissions ?? []).flatMap((item) => item.permissions?.key ? [item.permissions.key] : []);
    });
    setPermissions([...new Set(keys)]);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        window.setTimeout(() => { void loadIdentity(s.user); }, 0);
      } else {
        setRole(null);
        setDisplayName(null);
        setEmployeeStatus(null);
        setPermissions([]);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        await loadIdentity(data.session.user);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadIdentity]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, role, displayName, employeeStatus, permissions, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
