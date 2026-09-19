import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2, CircuitBoard, ClipboardList, FileSpreadsheet, FolderKanban, FolderOpen,
  History, LayoutGrid, ListChecks, MapPin, PackageCheck, Settings2, ShoppingCart,
  Truck, Users, Wrench, type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

type NavItem = { label: string; to: string; icon: LucideIcon; permission?: string };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Home", items: [{ label: "PartsBench overview", to: "/", icon: LayoutGrid, permission: "engineering.view" }] },
  { label: "Work", items: [
    { label: "Projects", to: "/projects", icon: FolderKanban, permission: "projects.view" },
    { label: "Task board", to: "/tasks", icon: ListChecks, permission: "my_work.view" },
  ] },
  { label: "Engineering", items: [
    { label: "R&D / PartsBench", to: "/", icon: CircuitBoard, permission: "engineering.view" },
    { label: "Inventory", to: "/locations", icon: MapPin, permission: "engineering.view" },
    { label: "BOM import", to: "/bom", icon: FileSpreadsheet, permission: "engineering.edit" },
    { label: "Drive", to: "/drive", icon: FolderOpen, permission: "documents.view" },
    { label: "PCB repair", to: "/pcb", icon: Wrench, permission: "engineering.edit" },
    { label: "Assignments", to: "/assignments", icon: ClipboardList, permission: "engineering.view" },
    { label: "R&D team", to: "/rd-team", icon: Users, permission: "engineering.view" },
  ] },
  { label: "Operations", items: [
    { label: "Purchase orders", to: "/procurement/orders", icon: ShoppingCart, permission: "procurement.view" },
    { label: "Pending deliveries", to: "/procurement/pending", icon: Truck, permission: "procurement.view" },
    { label: "Inwarding (GRN)", to: "/procurement/inward", icon: PackageCheck, permission: "procurement.view" },
    { label: "Vendors", to: "/procurement/vendors", icon: Building2, permission: "procurement.view" },
  ] },
  { label: "System", items: [
    { label: "PartsBench history", to: "/history", icon: History, permission: "engineering.view" },
    { label: "Administration", to: "/admin", icon: Settings2, permission: "admin.view" },
  ] },
];

export function SsmOneSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { state } = useSidebar();
  const { role, permissions, employeeStatus } = useAuth();
  const collapsed = state === "collapsed";
  const can = (permission?: string) => employeeStatus !== "SUSPENDED" && employeeStatus !== "EXITED" && (role === "admin" || !permission || permissions.includes(permission));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link to="/" className="flex items-center gap-2 px-2 py-2.5 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><CircuitBoard className="size-4" /></span>
          {!collapsed && <span>SSM One</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => can(item.permission));
          if (!visibleItems.length) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent><SidebarMenu>
                {visibleItems.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
                  return <SidebarMenuItem key={`${group.label}-${item.label}`}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to}><item.icon /><span>{item.label}</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>;
                })}
              </SidebarMenu></SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}