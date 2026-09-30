import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { SsmOneSidebar } from "@/components/shell/SsmOneSidebar";
import { MobileWorkspaceTabs } from "@/components/shell/MobileWorkspaceTabs";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { NotificationCenter } from "@/components/shell/NotificationCenter";
import { VoiceAssistant } from "@/components/inventory/VoiceAssistant";

import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, role, displayName, employeeStatus, signOut } = useAuth();
  const navigate = useNavigate();
  const suspended = employeeStatus === "SUSPENDED" || employeeStatus === "EXITED";
  useEffect(() => { if (suspended) { void signOut().finally(() => navigate({ to: "/auth" })); } }, [navigate, signOut, suspended]);
  if (suspended) return <main className="flex min-h-screen items-center justify-center p-6"><section className="max-w-md text-center"><h1 className="text-xl font-semibold">Access unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Your workspace access is not active. Please contact your system administrator.</p></section></main>;
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
         <SsmOneSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-10">
            <SidebarTrigger />
             <div className="flex-1"><GlobalSearch /></div>
              <div className="flex items-center gap-1"><NotificationCenter />
             <div className="hidden sm:flex flex-col items-end leading-tight">
               <span className="text-xs font-medium">{displayName ?? user?.email}</span>
               <span className="text-[11px] text-muted-foreground">{employeeStatus === "SUSPENDED" ? "Access suspended" : role === "admin" ? "Platform Owner" : "Employee"}</span>
             </div>
             {role === "admin" && <Button asChild size="icon" variant="ghost" title="System controls" aria-label="System controls">
               <Link to="/admin"><Settings className="h-4 w-4" /></Link>
              </Button>}</div>
             <Button size="icon" variant="ghost" onClick={signOut} title="Sign out" aria-label="Sign out">
               <LogOut className="h-4 w-4" />
            </Button>
          </header>
          <main className="flex-1 p-4 pb-20 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <VoiceAssistant />
          <MobileWorkspaceTabs />
      </div>
    </SidebarProvider>

  );
}
