import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_project_documents",
  title: "List project documents",
  description: "List Drive document metadata visible to the signed-in user for one accessible project. File contents and download links are not returned.",
  inputSchema: { projectId: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ projectId }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("drive_nodes")
      .select("id,name,file_type,mime_type,file_size_bytes,current_version,updated_at,folder_kind")
      .eq("project_id", projectId)
      .eq("node_type", "FILE")
      .eq("is_trashed", false)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const documents = (data ?? []).map((node) => ({
      id: node.id,
      name: node.name,
      type: node.file_type,
      mimeType: node.mime_type,
      sizeBytes: node.file_size_bytes,
      version: node.current_version,
      folderKind: node.folder_kind,
      updatedAt: node.updated_at,
    }));
    return {
      content: [{ type: "text", text: documents.length ? `Found ${documents.length} document(s).` : "No visible project documents found." }],
      structuredContent: { documents },
    };
  },
});
