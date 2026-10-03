import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectDocuments from "./tools/list-project-documents";
import listProjects from "./tools/list-projects";
import listProjectTasks from "./tools/list-project-tasks";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "ssm-one-phase-8",
  title: "SSM one phase 8",
  version: "0.1.0",
  instructions: "Read-only tools for a signed-in SSM One user. Use the returned identifiers exactly. Every tool is constrained by the user's existing workspace permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, listProjectTasks, listProjectDocuments],
});
