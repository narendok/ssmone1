import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign, Boxes, BriefcaseBusiness, Building2, ClipboardCheck, ClipboardList,
  FileSearch, FileSpreadsheet, FileText, FolderKanban, Gauge, GraduationCap, Handshake, HardHat,
  PackageCheck, PlaneTakeoff, ReceiptText, Search, Send, ShieldCheck, ShoppingCart,
  Truck, Users, WalletCards, Wrench,
} from "lucide-react";

export type WorkspaceKind = "rnd" | "procurement" | "production" | "facility" | "operations" | "hr" | "sales" | "finance";
export type WorkspaceNavItem = { label: string; to: string; icon: LucideIcon; permission?: string };

export type WorkspaceDefinition = {
  id: WorkspaceKind;
  terms: string[];
  label: string;
  summary: string;
  items: WorkspaceNavItem[];
};

export const workspaceDefinitions: WorkspaceDefinition[] = [
  { id: "rnd", terms: ["rnd", "hardware & r&d"], label: "Hardware & R&D", summary: "Requirements, engineering disciplines, validation, and release evidence.", items: [
    { label: "Project tracker", to: "/workspace/projects", icon: FolderKanban, permission: "projects.view" }, { label: "Engineering workspace", to: "/", icon: HardHat, permission: "engineering.view" }, { label: "BOM sourcing", to: "/bom", icon: FileSpreadsheet, permission: "engineering.edit" }, { label: "Validation & repair", to: "/pcb", icon: Wrench, permission: "engineering.edit" }, { label: "Engineering assignments", to: "/assignments", icon: ClipboardList, permission: "engineering.view" }, { label: "Release documents", to: "/drive", icon: FileText, permission: "documents.view" },
  ] },
  { id: "procurement", terms: ["proc", "procurement", "purchase", "stores", "incoming quality", "qa"], label: "Procurement", summary: "Supplier data, sourcing, orders, incoming quality, Stores records, and controlled BOM sourcing.", items: [
    { label: "Purchase requests", to: "/procurement/requests", icon: ClipboardList, permission: "procurement.view" }, { label: "RFQs & quotations", to: "/procurement/rfqs", icon: FileSearch, permission: "procurement.view" }, { label: "Purchase orders", to: "/procurement/orders", icon: ShoppingCart, permission: "procurement.view" }, { label: "Supplier shipments", to: "/procurement/shipments", icon: Truck, permission: "procurement.view" }, { label: "Incoming quality", to: "/quality/incoming", icon: ShieldCheck, permission: "quality.view" }, { label: "Stores records", to: "/stores/inventory", icon: Boxes, permission: "stores.view" }, { label: "BOM sourcing", to: "/bom", icon: FileSpreadsheet, permission: "engineering.edit" },
  ] },
  { id: "production", terms: ["prod", "production", "calibration", "engineering production"], label: "Production", summary: "Manufacturing instructions, calibration, assembly/testing, release, and dispatch evidence.", items: [
    { label: "Production control", to: "/production", icon: HardHat, permission: "production.view" }, { label: "Shop floor", to: "/production/shopfloor", icon: Wrench, permission: "production.view" }, { label: "Calibration", to: "/calibration", icon: Gauge, permission: "calibration.view" }, { label: "Finished goods release", to: "/production/release", icon: ClipboardCheck, permission: "production.view" }, { label: "Dispatch evidence", to: "/production/dispatch", icon: Send, permission: "production.view" }, { label: "Production documents", to: "/drive", icon: FileText, permission: "documents.view" },
  ] },
  { id: "facility", terms: ["fac", "facility", "maintenance", "security", "electrical", "utilities", "assets"], label: "Facility / Maintenance", summary: "Assets, security, gate passes, utilities, electrical, and maintenance records.", items: [
    { label: "Facilities", to: "/facility", icon: Building2, permission: "facility.view" }, { label: "Assets", to: "/assets", icon: Boxes, permission: "assets.view" }, { label: "Maintenance", to: "/maintenance", icon: Wrench, permission: "maintenance.view" }, { label: "Security desk", to: "/security", icon: ShieldCheck, permission: "security.view" }, { label: "Workplace", to: "/workplace", icon: HardHat, permission: "workplace.view" }, { label: "Facility documents", to: "/drive", icon: FileText, permission: "documents.view" },
  ] },
  { id: "operations", terms: ["ops", "operations", "qms", "management review"], label: "Operations / QMS", summary: "Audits, CAPA, risks, KPIs, governance, and final quality-release records.", items: [
    { label: "QMS", to: "/qms", icon: ClipboardCheck, permission: "qms.view" }, { label: "Incoming quality", to: "/quality/incoming", icon: ShieldCheck, permission: "quality.view" }, { label: "Customer quality", to: "/customer-service", icon: Handshake, permission: "customer_service.view" }, { label: "Governance records", to: "/records", icon: FileSearch, permission: "documents.view" }, { label: "Quality documents", to: "/drive", icon: FileText, permission: "documents.view" },
  ] },
  { id: "hr", terms: ["hr", "human resources"], label: "HR", summary: "Employee, recruitment, onboarding, policy, and training documents.", items: [
    { label: "HR overview", to: "/hr", icon: Users, permission: "hr.view" }, { label: "Employees & access", to: "/hr/access", icon: ShieldCheck, permission: "admin.view" }, { label: "Recruitment", to: "/hr/recruitment", icon: ClipboardList, permission: "recruitment.manage" }, { label: "Onboarding", to: "/hr/onboarding", icon: PlaneTakeoff, permission: "training.manage" }, { label: "Training", to: "/hr/training", icon: GraduationCap, permission: "training.manage" }, { label: "Policies", to: "/hr/policies", icon: FileText, permission: "hr.view" },
  ] },
  { id: "sales", terms: ["sal", "sales"], label: "Sales", summary: "Customer requirements, quotations, commercial handover, and client documents.", items: [
    { label: "Sales overview", to: "/sales", icon: BriefcaseBusiness, permission: "sales.view" }, { label: "Customers", to: "/customers", icon: Building2, permission: "sales.view" }, { label: "Customer service", to: "/customer-service", icon: Handshake, permission: "customer_service.view" }, { label: "Commercial records", to: "/records", icon: FileSearch, permission: "documents.view" }, { label: "Client documents", to: "/drive", icon: FileText, permission: "documents.view" },
  ] },
  { id: "finance", terms: ["fin", "finance"], label: "Finance", summary: "Payment, expense, and finance-only commercial records.", items: [
    { label: "Expenses", to: "/finance/expenses", icon: ReceiptText, permission: "finance.view" }, { label: "Payment milestones", to: "/finance/payment-plans", icon: WalletCards, permission: "finance.view" }, { label: "Finance records", to: "/records", icon: FileSearch, permission: "documents.view" }, { label: "Finance documents", to: "/drive", icon: FileText, permission: "documents.view" },
  ] },
];

export function workspaceForDepartment(department: { name: string; code: string | null; aliases: string[] } | null) {
  if (!department) return null;
  const terms = [department.name, department.code ?? "", ...department.aliases].map((value) => value.trim().toLowerCase());
  return workspaceDefinitions.find((workspace) => workspace.terms.some((term) => terms.includes(term))) ?? null;
}