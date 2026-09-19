import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { SsmOneSidebar } from "@/components/shell/SsmOneSidebar";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { VoiceAssistant } from "@/components/inventory/VoiceAssistant";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Settings } from "lucide-react";

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
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
         <SsmOneSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-10">
            <SidebarTrigger />
             <div className="flex-1"><GlobalSearch /></div>
             <Button size="icon" variant="ghost" title="Notifications" aria-label="Notifications">
               <Bell className="h-4 w-4" />
            </Button>
             <div className="hidden sm:flex flex-col items-end leading-tight">
               <span className="text-xs font-medium">{displayName ?? user?.email}</span>
               <span className="text-[11px] text-muted-foreground">{employeeStatus === "SUSPENDED" ? "Access suspended" : role === "admin" ? "System Admin" : "Employee"}</span>
             </div>
             {role === "admin" && <Button asChild size="icon" variant="ghost" title="Administration" aria-label="Administration">
               <Link to="/admin"><Settings className="h-4 w-4" /></Link>
             </Button>}
             <Button size="icon" variant="ghost" onClick={signOut} title="Sign out" aria-label="Sign out">
               <LogOut className="h-4 w-4" />
            </Button>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <VoiceAssistant />
      </div>
    </SidebarProvider>

  );
}
