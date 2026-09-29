import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircuitBoard, LayoutGrid, Users, ClipboardList, History, Zap, Activity, Cpu, Triangle, GitBranch, Box, MapPin, Wrench, ChevronRight, FileSpreadsheet, ShoppingCart, PackageCheck, Truck, FolderOpen, FolderKanban, ListChecks, Building2, AlarmClock } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub,
  SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/inventory";
import { fetchOpenPcbTaskCount } from "@/lib/pcb";
import { fetchOpenTaskCount } from "@/lib/tasks";
import { PermissionGate } from "@/components/PermissionGate";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Activity, Cpu, Triangle, GitBranch, Box, CircuitBoard,
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const parents = allCategories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => allCategories.filter((c) => c.parent_id === id);

  // Auto-expand the parent of the active category route
  useEffect(() => {
    const match = pathname.match(/^\/category\/([^/]+)$/);
    if (!match) return;
    const slug = match[1];
    const current = allCategories.find((c) => c.slug === slug);
    if (current?.parent_id) {
      setExpanded((prev) => {
        if (prev.has(current.parent_id!)) return prev;
        const next = new Set(prev);
        next.add(current.parent_id!);
        return next;
      });
    }
  }, [pathname, allCategories]);

  const { data: openCount = 0 } = useQuery({
    queryKey: ["pcb_open_count"],
    queryFn: fetchOpenPcbTaskCount,
    refetchInterval: 60_000,
  });

  const { data: openTaskCount = 0 } = useQuery({
    queryKey: ["open_task_count"],
    queryFn: fetchOpenTaskCount,
    refetchInterval: 60_000,
  });

  const isActive = (path: string) => pathname === path;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link to="/" className="flex items-center gap-2 px-2 py-2 font-semibold">
          <CircuitBoard className="h-5 w-5 text-primary flex-shrink-0" />
          {!collapsed && <span>PartsBench</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <PermissionGate permission="inventory.view">
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/")}>
                  <Link to="/"><LayoutGrid className="h-4 w-4" /><span>All inventory</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/locations")}>
                  <Link to="/locations"><MapPin className="h-4 w-4" /><span>Locations</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/bom")}>
                  <Link to="/bom"><FileSpreadsheet className="h-4 w-4" /><span>BOM import</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/drive")}>
                  <Link to="/drive" search={{ node: undefined }}><FolderOpen className="h-4 w-4" /><span>Drive</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/pcb")}>
                  <Link to="/pcb">
                    <Wrench className="h-4 w-4" />
                    <span className="flex-1">PCB Repair</span>
                    {openCount > 0 && !collapsed && (
                      <span className="ml-auto rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">
                        {openCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {parents.map((cat) => {
                const Icon = ICONS[cat.icon ?? "Box"] ?? Box;
                const path = `/category/${cat.slug}`;
                const subs = childrenOf(cat.id);
                const hasSubs = subs.length > 0;
                const isOpen = expanded.has(cat.id);
                return (
                  <SidebarMenuItem key={cat.id}>
                    <div className="flex items-center w-full">
                      <SidebarMenuButton asChild isActive={isActive(path)} className="flex-1">
                        <Link to="/category/$slug" params={{ slug: cat.slug }}>
                          <Icon className="h-4 w-4" /><span>{cat.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {hasSubs && !collapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggle(cat.id);
                          }}
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          className="p-1 mr-1 rounded hover:bg-sidebar-accent text-muted-foreground"
                        >
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        </button>
                      )}
                    </div>
                    {hasSubs && isOpen && !collapsed && (
                      <SidebarMenuSub>
                        {subs.map((sub) => {
                          const subPath = `/category/${sub.slug}`;
                          return (
                            <SidebarMenuSubItem key={sub.id}>
                              <SidebarMenuSubButton asChild isActive={isActive(subPath)}>
                                <Link to="/category/$slug" params={{ slug: sub.slug }}>
                                  <span>{sub.name}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        </PermissionGate>

        <SidebarGroup>
          <SidebarGroupLabel>R&amp;D</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/assignments")}>
                  <Link to="/assignments"><ClipboardList className="h-4 w-4" /><span>Assignments</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/rd-team")}>
                  <Link to="/rd-team"><Users className="h-4 w-4" /><span>R&amp;D team</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/projects")}>
                  <Link to="/projects"><FolderKanban className="h-4 w-4" /><span>Projects</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/history")}>
                  <Link to="/history"><History className="h-4 w-4" /><span>Activity log</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tasks &amp; Departments</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/tasks")}>
                  <Link to="/tasks" search={{ assignee: undefined, task: undefined }}>
                    <ListChecks className="h-4 w-4" />
                    <span className="flex-1">Task board</span>
                    {openTaskCount > 0 && !collapsed && (
                      <span className="ml-auto rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">
                        {openTaskCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/tasks/departments")}>
                  <Link to="/tasks/departments"><Building2 className="h-4 w-4" /><span>Departments</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Procurement</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/procurement/orders")}>
                  <Link to="/procurement/orders"><ShoppingCart className="h-4 w-4" /><span>Purchase orders</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/procurement/pending")}>
                  <Link to="/procurement/pending"><AlarmClock className="h-4 w-4" /><span>Pending deliveries</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/procurement/inward")}>
                  <Link to="/procurement/inward"><PackageCheck className="h-4 w-4" /><span>Inwarding (GRN)</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/procurement/vendors")}>
                  <Link to="/procurement/vendors"><Truck className="h-4 w-4" /><span>Vendors</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
