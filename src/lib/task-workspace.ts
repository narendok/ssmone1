import { OPEN_TASK_STATUSES, type ProjectTask } from "@/lib/tasks";

export type DailyTaskGroup = "today" | "later";

export function taskMatchesDepartment(task: ProjectTask, departments: string[]) {
  return departments.length === 0 || departments.includes(task.department);
}

export function taskDueLabel(dueDate: string | null, today = new Date().toISOString().slice(0, 10)) {
  if (!dueDate) return "No due date";
  if (dueDate < today) return `Overdue · ${dueDate}`;
  if (dueDate === today) return "Due today";
  return `Due ${dueDate}`;
}

export function isTodayTask(task: ProjectTask, today = new Date().toISOString().slice(0, 10)) {
  return task.priority === "urgent" || task.priority === "high" || task.status === "blocked" || task.due_date === today || Boolean(task.due_date && task.due_date < today);
}

export function sortWorkspaceTasks(a: ProjectTask, b: ProjectTask, today = new Date().toISOString().slice(0, 10)) {
  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
  const overdueA = Boolean(a.due_date && a.due_date < today);
  const overdueB = Boolean(b.due_date && b.due_date < today);
  if (overdueA !== overdueB) return overdueA ? -1 : 1;
  if (a.status === "blocked" && b.status !== "blocked") return -1;
  if (b.status === "blocked" && a.status !== "blocked") return 1;
  const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDifference !== 0) return priorityDifference;
  return (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31");
}

export function groupWorkspaceTasks(tasks: ProjectTask[], departments: string[], today = new Date().toISOString().slice(0, 10)) {
  const openTasks = tasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status) && taskMatchesDepartment(task, departments));
  return {
    today: openTasks.filter((task) => isTodayTask(task, today)).sort((a, b) => sortWorkspaceTasks(a, b, today)),
    later: openTasks.filter((task) => !isTodayTask(task, today)).sort((a, b) => sortWorkspaceTasks(a, b, today)),
  };
}