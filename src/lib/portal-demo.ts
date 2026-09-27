export type DemoPriority = "Urgent" | "High" | "Medium";

export type DemoWorkItem = {
  id: string;
  title: string;
  area: string;
  owner: string;
  due: string;
  priority: DemoPriority;
  status: "Blocked" | "In progress" | "Waiting approval";
};

export const DEMO_WORK_ITEMS: DemoWorkItem[] = [
  { id: "demo-rd", title: "Approve prototype enclosure revision", area: "R&D & Projects", owner: "Aarav", due: "Today", priority: "Urgent", status: "Waiting approval" },
  { id: "demo-buy", title: "Confirm supplier lead-time for controller board", area: "Supply & Stores", owner: "Meera", due: "Today", priority: "High", status: "Blocked" },
  { id: "demo-build", title: "Release pilot build pack", area: "Production & Quality", owner: "Rohan", due: "Tomorrow", priority: "High", status: "Waiting approval" },
  { id: "demo-sales", title: "Send milestone update to customer", area: "Sales & Customer", owner: "Nisha", due: "Tomorrow", priority: "Medium", status: "In progress" },
];

export const DEMO_PROGRESS = [
  { label: "City mobility pilot", detail: "Design validation", value: 72, area: "R&D & Projects" },
  { label: "Controller replenishment", detail: "Supplier confirmation", value: 45, area: "Supply & Stores" },
  { label: "Pilot device build", detail: "Material readiness", value: 58, area: "Production & Quality" },
];