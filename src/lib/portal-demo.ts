export type DemoPriority = "Urgent" | "High" | "Medium";

export type DemoWorkItem = {
  id: string;
  title: string;
  area: string;
  owner: string;
  due: string;
  priority: DemoPriority;
  status: "Blocked" | "In progress" | "Waiting approval";
  project: string;
  progress: number;
  notes: string;
};

export const DEMO_WORK_ITEMS: DemoWorkItem[] = [
  { id: "demo-rd", title: "Approve prototype enclosure revision", area: "R&D & Projects", owner: "Aarav", due: "Today", priority: "Urgent", status: "Waiting approval", project: "City mobility pilot", progress: 72, notes: "Confirm the revised enclosure clearances before the design pack moves to the pilot build." },
  { id: "demo-buy", title: "Confirm supplier lead-time for controller board", area: "Supply & Stores", owner: "Meera", due: "Today", priority: "High", status: "Blocked", project: "City mobility pilot", progress: 45, notes: "Supplier confirmation is needed before the purchasing plan can be released." },
  { id: "demo-build", title: "Release pilot build pack", area: "Production & Quality", owner: "Rohan", due: "Tomorrow", priority: "High", status: "Waiting approval", project: "Pilot device build", progress: 58, notes: "Check material readiness and obtain the release decision for the first pilot batch." },
  { id: "demo-sales", title: "Send milestone update to customer", area: "Sales & Customer", owner: "Nisha", due: "Tomorrow", priority: "Medium", status: "In progress", project: "City mobility pilot", progress: 60, notes: "Prepare the approved milestone summary and share only the customer-visible progress." },
];

export const DEMO_PROGRESS = [
  { label: "City mobility pilot", detail: "Design validation", value: 72, area: "R&D & Projects" },
  { label: "Controller replenishment", detail: "Supplier confirmation", value: 45, area: "Supply & Stores" },
  { label: "Pilot device build", detail: "Material readiness", value: 58, area: "Production & Quality" },
];