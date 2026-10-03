import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List accessible projects",
  description: "List the signed-in user's accessible projects, optionally matching by name or code.",
  inputSchema: { query: z.string().trim().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) => {
    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("projects")
      .select("id,name,code,status,revision,project_stage,health_status,priority,drive_project_class,updated_at")
      .order("updated_at", { ascending: false })
      .limit(25);
    if (query) request = request.or(`name.ilike.%${query}%,code.ilike.%${query}%`);
    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const projects = (data ?? []).map((project) => ({
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      revision: project.revision,
      stage: project.project_stage,
      health: project.health_status,
      priority: project.priority,
      projectClass: project.drive_project_class,
      updatedAt: project.updated_at,
    }));
    return {
      content: [{ type: "text", text: projects.length ? `Found ${projects.length} accessible project(s).` : "No accessible projects found." }],
      structuredContent: { projects },
    };
  },
});
