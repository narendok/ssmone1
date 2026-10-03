import { describe, expect, it, vi } from "vitest";

// Test handler behavior with middleware context fixtures. JWT verification is
// owned by the existing auth middleware; these are not live auth acceptance.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (data: unknown) => unknown = (data) => data;
    const builder = {
      middleware: () => builder,
      inputValidator: (validator: typeof validate) => { validate = validator; return builder; },
      handler: (handler: (value: unknown) => Promise<unknown>) =>
        ({ data, context }: { data: unknown; context: unknown }) => handler({ data: validate(data), context }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => {
  throw new Error("Privileged client must not be instantiated before acceptance");
});

import { createLifecycleTemplateContentRevision, generateLifecycleDocumentDraft } from "./lifecycle-actions.functions";

const id = (value: number) => `00000000-0000-0000-0000-${String(value).padStart(12, "0")}`;
function context(permitted = true) {
  const from = vi.fn((table: string) => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: table === "projects"
      ? { id: id(1), department_id: id(2), revision: "TEST", project_drive_node_id: id(3) }
      : { department_id: id(2), status: "DRAFT" }, error: null }),
  }) }) }));
  return { userId: id(10), supabase: { from, rpc: vi.fn(async () => ({ data: permitted, error: null })) } };
}
const invoke = (handler: unknown, data: unknown, ctx: unknown) =>
  (handler as (input: { data: unknown; context: unknown }) => Promise<unknown>)({ data, context: ctx });

describe("lifecycle handler acceptance boundary", () => {
  it("save fails before creating a privileged client while acceptance is pending", async () => {
    const ctx = context();
    await expect(invoke(createLifecycleTemplateContentRevision, { templateId: id(4), content: "OEM {{PROJECT_NAME}}" }, ctx)).rejects.toThrow("disabled pending reviewed database acceptance");
    expect(ctx.supabase.from).toHaveBeenCalledTimes(1);
  });
  it("generation stops before reading undeployed template content or uploading bytes", async () => {
    const ctx = context();
    await expect(invoke(generateLifecycleDocumentDraft, {
      projectId: id(1), templateId: id(4), templateVersion: 1,
      templateDocumentRevisionId: id(5), targetFolderId: id(6), requestKey: id(7),
    }, ctx)).rejects.toThrow("disabled pending reviewed database acceptance");
    expect(ctx.supabase.from.mock.calls).toEqual([["projects"]]);
  });
  it("a department/permission denial blocks the save before the acceptance boundary", async () => {
    await expect(invoke(createLifecycleTemplateContentRevision, { templateId: id(4), content: "OEM" }, context(false))).rejects.toThrow("do not have permission");
  });
});
