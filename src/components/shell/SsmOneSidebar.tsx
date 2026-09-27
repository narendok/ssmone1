import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BriefcaseBusiness, Building2, CircuitBoard, ClipboardList, FileSpreadsheet, FolderKanban, FolderOpen,
  GraduationCap, History, LayoutGrid, ListChecks, MapPin, PackageCheck, PlaneTakeoff, Settings2, ShoppingCart,
    Truck, Users, Wrench, WalletCards, ShieldCheck, Boxes, FileText, Factory, ClipboardCheck, Send, Gauge, Armchair, ChartNoAxesCombined, Headset, Handshake, ChartColumnIncreasing, ChevronDown, type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

type NavItem = { label: string; to: string; icon: LucideIcon; permission?: string };
type NavGroup = { label: string; items: NavItem[]; collapsible?: boolean; department?: string };

const groups: NavGroup[] = [
  { label: "Department center", collapsible: true, items: [{ label: "Department dashboard", to: "/dashboards", icon: ChartColumnIncreasing }] },
  { label: "Work", items: [
    { label: "Projects", to: "/projects", icon: FolderKanban, permission: "projects.view" },
    { label: "Task board", to: "/tasks", icon: ListChecks, permission: "my_work.view" },
  ] },
  { label: "Sales", collapsible: true, department: "sales", items: [
    { label: "Sales overview", to: "/sales", icon: BriefcaseBusiness, permission: "sales.view" },
    { label: "Customers", to: "/customers", icon: Building2, permission: "sales.view" },
  ] },
  { label: "Engineering", collapsible: true, department: "engineering", items: [
    { label: "R&D / PartsBench", to: "/", icon: CircuitBoard, permission: "engineering.view" },
    { label: "Inventory", to: "/locations", icon: MapPin, permission: "engineering.view" },
    { label: "BOM import", to: "/bom", icon: FileSpreadsheet, permission: "engineering.edit" },
    { label: "Drive", to: "/drive", icon: FolderOpen, permission: "documents.view" },
    { label: "PCB repair", to: "/pcb", icon: Wrench, permission: "engineering.edit" },
    { label: "Assignments", to: "/assignments", icon: ClipboardList, permission: "engineering.view" },
    { label: "R&D team", to: "/rd-team", icon: Users, permission: "engineering.view" },
  ] },
  { label: "Operations", collapsible: true, department: "operations", items: [
    { label: "Purchase requests", to: "/procurement/requests", icon: ClipboardList, permission: "procurement.view" },
    { label: "RFQs & quotations", to: "/procurement/rfqs", icon: FileText, permission: "procurement.view" },
    { label: "Purchase orders", to: "/procurement/orders", icon: ShoppingCart, permission: "procurement.view" },
     { label: "Delivery revisions", to: "/procurement/delivery-revisions", icon: History, permission: "procurement.view" },
    { label: "Pending deliveries", to: "/procurement/pending", icon: Truck, permission: "procurement.view" },
    { label: "Supplier shipments", to: "/procurement/shipments", icon: Truck, permission: "procurement.view" },
    { label: "Inwarding (GRN)", to: "/procurement/inward", icon: PackageCheck, permission: "procurement.view" },
    { label: "Vendors", to: "/procurement/vendors", icon: Building2, permission: "procurement.view" },
    { label: "Supplier quality", to: "/procurement/supplier-quality", icon: ShieldCheck, permission: "quality.view" },
     { label: "Supplier returns", to: "/procurement/returns", icon: Truck, permission: "quality.view" },
    { label: "Stores inventory", to: "/stores/inventory", icon: Boxes, permission: "stores.view" },
     { label: "Production control", to: "/production", icon: Factory, permission: "production.view" },
     { label: "Shop floor", to: "/production/shopfloor", icon: Factory, permission: "production.view" },
     { label: "Finished goods", to: "/production/release", icon: ClipboardCheck, permission: "production.view" },
     { label: "PPAP packages", to: "/production/ppap", icon: FileText, permission: "production.view" },
     { label: "Production dispatch", to: "/production/dispatch", icon: Send, permission: "production.view" },
    { label: "Incoming quality", to: "/quality/incoming", icon: ShieldCheck, permission: "quality.view" },
    { label: "Finance", to: "/finance/expenses", icon: WalletCards, permission: "finance.view" },
    { label: "Payment milestones", to: "/finance/payment-plans", icon: WalletCards, permission: "finance.view" },
      { label: "Facility", to: "/facility", icon: Building2, permission: "facility.view" },
      { label: "Assets", to: "/assets", icon: Boxes, permission: "assets.view" },
      { label: "Maintenance", to: "/maintenance", icon: Wrench, permission: "maintenance.view" },
      { label: "Calibration", to: "/calibration", icon: Gauge, permission: "calibration.view" },
      { label: "Security desk", to: "/security", icon: ShieldCheck, permission: "security.view" },
      { label: "Workplace", to: "/workplace", icon: Armchair, permission: "workplace.view" },
       { label: "QMS", to: "/qms", icon: ChartNoAxesCombined, permission: "qms.view" },
       { label: "Customer service", to: "/customer-service", icon: Headset, permission: "customer_service.view" },
        { label: "External collaboration", to: "/external-collaboration", icon: Handshake, permission: "external_collaboration.view" },
        { label: "Transmittals", to: "/external-collaboration/transmittals", icon: Send, permission: "external_collaboration.view" },
        { label: "External actions", to: "/external-collaboration/actions", icon: ClipboardList, permission: "external_collaboration.view" },
        { label: "Upload requests", to: "/external-collaboration/uploads", icon: FileText, permission: "external_collaboration.view" },
  ] },
   { label: "People & HR", collapsible: true, department: "hr", items: [
    { label: "HR overview", to: "/hr", icon: Users, permission: "hr.view" },
    { label: "Recruitment", to: "/hr/recruitment", icon: ClipboardList, permission: "recruitment.manage" },
    { label: "Leave desk", to: "/hr/leave", icon: PlaneTakeoff, permission: "hr.view" },
    { label: "Learning", to: "/hr/training", icon: GraduationCap, permission: "training.manage" },
    { label: "Onboarding", to: "/hr/onboarding", icon: ClipboardList, permission: "training.manage" },
    { label: "Policies", to: "/hr/policies", icon: FileSpreadsheet, permission: "hr.view" },
  ] },
   { label: "System", collapsible: true, items: [
    { label: "PartsBench history", to: "/history", icon: History, permission: "engineering.view" },
    { label: "Administration", to: "/admin", icon: Settings2, permission: "admin.view" },
  ] },
];

export function SsmOneSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { state } = useSidebar();
  const { role, permissions, employeeStatus } = useAuth();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const collapsed = state === "collapsed";
  const can = (permission?: string) => employeeStatus !== "SUSPENDED" && employeeStatus !== "EXITED" && (role === "admin" || !permission || permissions.includes(permission));
  const toggleGroup = (label: string) => setCollapsedGroups((previous) => {
    const next = new Set(previous);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    return next;
  });

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
          const groupCollapsed = group.collapsible && collapsedGroups.has(group.label);
          const isGroupActive = visibleItems.some((item) => item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`));
          return (
            <SidebarGroup key={group.label}>
              {group.collapsible ? <SidebarMenu><SidebarMenuItem><div className="flex items-center"><SidebarMenuButton asChild isActive={isGroupActive} tooltip={group.label} className="flex-1">
                <Link to="/dashboards" search={{ department: group.department }}><ChartColumnIncreasing /><span>{group.label}</span></Link>
              </SidebarMenuButton><button type="button" aria-label={`Toggle ${group.label} menu`} aria-expanded={!groupCollapsed} onClick={() => toggleGroup(group.label)} className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-sm text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"><ChevronDown className={`size-4 transition-transform ${groupCollapsed ? "-rotate-90" : ""}`} /></button></div></SidebarMenuItem></SidebarMenu> : <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              {!groupCollapsed && <SidebarGroupContent><SidebarMenu>
                {group.collapsible ? <SidebarMenuSub>{visibleItems.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
                  return <SidebarMenuSubItem key={`${group.label}-${item.label}`}><SidebarMenuSubButton asChild isActive={active}>
                    <Link to={item.to}><item.icon /><span>{item.label}</span></Link>
                  </SidebarMenuSubButton></SidebarMenuSubItem>;
                })}</SidebarMenuSub> : visibleItems.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
                  return <SidebarMenuItem key={`${group.label}-${item.label}`}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to}><item.icon /><span>{item.label}</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>;
                })}
              </SidebarMenu></SidebarGroupContent>}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
