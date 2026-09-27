import { supabase } from "@/integrations/supabase/client";
import { fetchTasks, OPEN_TASK_STATUSES, type ProjectTask } from "@/lib/tasks";

const sb = supabase as any;

export type DashboardDepartment = "engineering" | "operations" | "production" | "hr" | "sales" | "quality";

export type DashboardMetric = {
  label: string;
  value: number;
  detail: string;
  tone?: "default" | "attention" | "critical";
};

export type DashboardAction = {
  label: string;
  detail: string;
  to: string;
  tone?: "default" | "attention" | "critical";
};

export type DepartmentDashboardData = {
  metrics: DashboardMetric[];
  actions: DashboardAction[];
  workload: { label: string; open: number; blocked: number; overdue: number }[];
};

const departmentTaskMap: Record<DashboardDepartment, string[]> = {
  engineering: ["hardware", "firmware", "mechanical"],
  operations: ["procurement"],
  production: ["production"],
  hr: [],
  sales: ["executive"],
  quality: ["qa"],
};

function taskPulse(tasks: ProjectTask[]) {
  const today = new Date().toISOString().slice(0, 10);
  const open = tasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status));
  return {
    open,
    blocked: open.filter((task) => task.status === "blocked"),
    overdue: open.filter((task) => Boolean(task.due_date && task.due_date < today)),
    urgent: open.filter((task) => task.priority === "urgent" || task.priority === "high"),
  };
}

async function count(table: string, apply?: (query: any) => any) {
  let query = sb.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count: total, error } = await query;
  if (error) return 0;
  return total ?? 0;
}

export async function fetchDepartmentDashboard(department: DashboardDepartment): Promise<DepartmentDashboardData> {
  const allTasks = await fetchTasks();
  const taskDepartments = departmentTaskMap[department];
  const scopedTasks = taskDepartments.length ? allTasks.filter((task) => taskDepartments.includes(task.department)) : allTasks;
  const pulse = taskPulse(scopedTasks);
  const sharedWorkload = [{ label: "Work queue", open: pulse.open.length, blocked: pulse.blocked.length, overdue: pulse.overdue.length }];

  if (department === "engineering") {
    const lowStock = await count("components", (query) => query.eq("needs_review", true));
    return {
      metrics: [
        { label: "Open engineering work", value: pulse.open.length, detail: "Hardware, firmware and mechanical tasks" },
        { label: "Blocked work", value: pulse.blocked.length, detail: "Needs a lead decision", tone: pulse.blocked.length ? "critical" : "default" },
        { label: "Priority tasks", value: pulse.urgent.length, detail: "High and urgent work", tone: pulse.urgent.length ? "attention" : "default" },
        { label: "Parts to review", value: lowStock, detail: "Inventory items awaiting review", tone: lowStock ? "attention" : "default" },
      ],
      actions: [
        { label: "Review task board", detail: "Assign owners, unblock work and check due dates.", to: "/tasks" },
        { label: "Manage projects", detail: "Review project delivery work and team responsibility.", to: "/projects" },
        { label: "Review inventory", detail: "Check parts, bins and engineering stock.", to: "/locations" },
        { label: "Open BOM workspace", detail: "Import or review a project bill of materials.", to: "/bom" },
      ],
      workload: sharedWorkload,
    };
  }

  if (department === "operations") {
    const [openOrders, pendingReceipts, openRequests] = await Promise.all([
      count("purchase_orders", (query) => query.in("status", ["DRAFT", "SENT", "PARTIALLY_RECEIVED"])),
      count("purchase_orders", (query) => query.in("status", ["SENT", "PARTIALLY_RECEIVED"])),
      count("purchase_requests", (query) => query.in("status", ["DRAFT", "SUBMITTED", "PENDING_APPROVAL"])),
    ]);
    return {
      metrics: [
        { label: "Open purchase orders", value: openOrders, detail: "Draft, sent or partially received" },
        { label: "Receiving queue", value: pendingReceipts, detail: "Orders waiting for inwarding", tone: pendingReceipts ? "attention" : "default" },
        { label: "Purchase requests", value: openRequests, detail: "Requests awaiting processing", tone: openRequests ? "attention" : "default" },
        { label: "Blocked work", value: pulse.blocked.length, detail: "Operations tasks needing attention", tone: pulse.blocked.length ? "critical" : "default" },
      ],
      actions: [
        { label: "Process purchase requests", detail: "Review demand and take the next procurement step.", to: "/procurement/requests" },
        { label: "Manage purchase orders", detail: "Create, send and track supplier orders.", to: "/procurement/orders" },
        { label: "Receive deliveries", detail: "Complete inwarding for delivered order lines.", to: "/procurement/inward" },
        { label: "Check stores inventory", detail: "Review availability and stock locations.", to: "/stores/inventory" },
      ],
      workload: sharedWorkload,
    };
  }

  if (department === "production") {
    const [active, materialReview, ready] = await Promise.all([
      count("work_orders", (query) => query.in("status", ["RELEASED", "IN_PROGRESS", "ON_HOLD"])),
      count("work_orders", (query) => query.eq("status", "MATERIAL_REVIEW")),
      count("work_orders", (query) => query.eq("status", "READY_TO_RELEASE")),
    ]);
    return {
      metrics: [
        { label: "Active work orders", value: active, detail: "Released, in progress or on hold" },
        { label: "Material reviews", value: materialReview, detail: "Orders needing material decisions", tone: materialReview ? "attention" : "default" },
        { label: "Ready to release", value: ready, detail: "Controlled work ready for release" },
        { label: "Blocked work", value: pulse.blocked.length, detail: "Production tasks needing a lead", tone: pulse.blocked.length ? "critical" : "default" },
      ],
      actions: [
        { label: "Control work orders", detail: "Review material readiness and release status.", to: "/production" },
        { label: "Open shop floor", detail: "Track execution and in-process activity.", to: "/production/shopfloor" },
        { label: "Review finished goods", detail: "Manage controlled finished-goods release.", to: "/production/release" },
        { label: "Review tasks", detail: "Assign production work and resolve blockers.", to: "/tasks" },
      ],
      workload: sharedWorkload,
    };
  }

  if (department === "hr") {
    const [openRequisitions, leaveWaiting, learning] = await Promise.all([
      count("hr_job_requisitions", (query) => query.eq("status", "open")),
      count("hr_leave_requests", (query) => query.in("status", ["submitted", "pending_manager", "pending_hr"])),
      count("hr_training_enrollments", (query) => query.neq("status", "completed")),
    ]);
    return {
      metrics: [
        { label: "Open requisitions", value: openRequisitions, detail: "Roles in the hiring pipeline" },
        { label: "Leave approvals", value: leaveWaiting, detail: "Requests waiting for action", tone: leaveWaiting ? "attention" : "default" },
        { label: "Learning in progress", value: learning, detail: "Training assignments still active" },
        { label: "Company work queue", value: pulse.open.length, detail: "Tasks visible to HR leads" },
      ],
      actions: [
        { label: "Open HR overview", detail: "Review people operations at a glance.", to: "/hr" },
        { label: "Manage recruitment", detail: "Move candidates and requisitions forward.", to: "/hr/recruitment" },
        { label: "Review leave desk", detail: "Action leave requests and balances.", to: "/hr/leave" },
        { label: "Manage learning", detail: "Review training assignments and completion.", to: "/hr/training" },
      ],
      workload: sharedWorkload,
    };
  }

  if (department === "sales") {
    const [activeOpportunities, waitingCustomer, pendingRequirements] = await Promise.all([
      count("sales_opportunities", (query) => query.eq("status", "active")),
      count("sales_opportunities", (query) => query.in("stage", ["requirement_pending", "clarification_required", "customer_review", "waiting_customer_authorization"])),
      count("customer_requirements", (query) => query.in("status", ["draft", "under_review", "clarification_required"])),
    ]);
    return {
      metrics: [
        { label: "Active opportunities", value: activeOpportunities, detail: "Customer development in progress" },
        { label: "Waiting on customer", value: waitingCustomer, detail: "Follow-up or customer action needed", tone: waitingCustomer ? "attention" : "default" },
        { label: "Requirements in review", value: pendingRequirements, detail: "Controlled customer inputs" },
        { label: "Priority work", value: pulse.urgent.length, detail: "High and urgent commercial tasks", tone: pulse.urgent.length ? "attention" : "default" },
      ],
      actions: [
        { label: "Open sales overview", detail: "Review pipeline, requirements and handovers.", to: "/sales" },
        { label: "Manage customers", detail: "Open the customer master and contacts.", to: "/customers" },
        { label: "Review tasks", detail: "Assign commercial follow-ups and due work.", to: "/tasks" },
      ],
      workload: sharedWorkload,
    };
  }

  const [openAudits, openCapas, complaints] = await Promise.all([
    count("qms_audits", (query) => query.in("status", ["PLANNED", "IN_PROGRESS"])),
    count("qms_capas", (query) => query.in("status", ["OPEN", "IN_PROGRESS", "PENDING_VERIFICATION"])),
    count("customer_complaints", (query) => query.in("status", ["OPEN", "INVESTIGATING", "PENDING_CUSTOMER"])),
  ]);
  return {
    metrics: [
      { label: "Open audits", value: openAudits, detail: "Planned or in-progress audits" },
      { label: "Open CAPAs", value: openCapas, detail: "Corrective actions still active", tone: openCapas ? "attention" : "default" },
      { label: "Customer complaints", value: complaints, detail: "Complaints requiring control", tone: complaints ? "critical" : "default" },
      { label: "Blocked quality work", value: pulse.blocked.length, detail: "Quality tasks needing a lead", tone: pulse.blocked.length ? "critical" : "default" },
    ],
    actions: [
      { label: "Open QMS", detail: "Review audit, CAPA and quality governance work.", to: "/qms" },
      { label: "Incoming quality", detail: "Review inspection and incoming-material actions.", to: "/quality/incoming" },
      { label: "Customer quality", detail: "Manage complaints, returns and field issues.", to: "/customer-service" },
      { label: "Review tasks", detail: "Assign quality work and resolve blockers.", to: "/tasks" },
    ],
    workload: sharedWorkload,
  };
}