import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateProjectDocumentDrafts, lifecycleAutomaticRequestKey } from "./lifecycle-project-generation.server";
const mocks = vi.hoisted(() => ({ preflight: vi.fn(), workflow: vi.fn() }));
vi.mock("./lifecycle-document-preflight.server", () => ({ loadLifecycleDocumentPreflight: mocks.preflight }));
vi.mock("./lifecycle-document-workflow.server", () => ({ runLifecycleDocumentWorkflow: mocks.workflow }));
beforeEach(() => { vi.clearAllMocks(); });
it("automatic generation reuses a key for the same actor/source and separates revisions/actors", async () => {
  const first = await lifecycleAutomaticRequestKey("manager1", "source1");
  expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  expect(await lifecycleAutomaticRequestKey("manager1", "source1")).toBe(first);
  expect(await lifecycleAutomaticRequestKey("manager1", "source2")).not.toBe(first);
  expect(await lifecycleAutomaticRequestKey("manager2", "source1")).not.toBe(first);
});
it("reports individual failures while completing other templates; retry keeps the successful snapshot's key", async () => {
  const templates = [{ id: "bad", version: 1, active_document_revision_id: "body1", title: "Invalid template" },
    { id: "good", version: 2, active_document_revision_id: "body2", title: "Requirements" }];
  const query: any = {};
  for (const method of ["select", "eq", "not", "order"]) query[method] = vi.fn(() => query);
  query.limit = vi.fn(async () => ({ data: templates, error: null }));
  const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;
  mocks.preflight.mockImplementation(async (_client, input) => {
    if (input.templateId === "bad") throw new Error("Unsupported immutable token");
    return { sourceFingerprint: "canonical-source" };
  });
  mocks.workflow.mockResolvedValue({ mode: "CREATED", receipt: { nodeId: "saved-node" } });
  const project = { id: "project", department_id: "dept", project_drive_node_id: "root" };
  const accepted = vi.fn();
  const first = await generateProjectDocumentDrafts(client, "manager", project, accepted);
  expect(first.failures).toEqual([{ templateId: "bad", title: "Invalid template", message: "Unsupported immutable token" }]);
  expect(first.results[0].nodeId).toBe("saved-node");
  const firstKey = mocks.workflow.mock.calls[0][1].requestKey;
  await generateProjectDocumentDrafts(client, "manager", project, accepted);
  expect(mocks.workflow.mock.calls[1][1].requestKey).toBe(firstKey);
  expect(mocks.workflow.mock.calls[0][1]).toMatchObject({ targetFolderId: "root", templateVersion: 2, templateDocumentRevisionId: "body2" });
  expect(mocks.workflow.mock.calls[0][2]).toBe(accepted);
});
