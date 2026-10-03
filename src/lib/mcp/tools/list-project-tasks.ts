import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_project_tasks",
  title: "List project tasks",
  description: "List tasks visible to the signed-in user for one accessible project.",
  inputSchema: { projectId: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ projectId }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("project_tasks")
      .select("id,title,description,status,priority,due_date,department,updated_at")
      .eq("project_id", projectId)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const tasks = (data ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      department: task.department,
      updatedAt: task.updated_at,
    }));
    return {
      content: [{ type: "text", text: tasks.length ? `Found ${tasks.length} task(s).` : "No visible tasks found for this project." }],
      structuredContent: { tasks },
    };
  },
});
