import { expect, it, vi } from "vitest";
import { runLifecycleDocumentWorkflow } from "./lifecycle-document-workflow.server";

it("a denied acceptance boundary never reads source records or stages storage", async () => {
  const from = vi.fn();
  const upload = vi.fn();
  const input = { projectId: "project", templateId: "template", templateVersion: 1,
    templateDocumentRevisionId: "revision", targetFolderId: "target", requestKey: "request" };
  await expect(runLifecycleDocumentWorkflow({ from, storage: { upload } } as never, input,
    async () => { throw new Error("Database acceptance is missing"); })).rejects.toThrow("acceptance");
  expect(from).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});
