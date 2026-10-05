import { describe, expect, it, vi } from "vitest";
import { createLifecycleTemplateManagementStore } from "./lifecycle-template-management.server";

const id = "11111111-1111-4111-8111-111111111111";
const input = { departmentId: id, templateKey: "PRS", title: "Product requirements", description: null };
function fixture(data: unknown = id, error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { rpc, store: createLifecycleTemplateManagementStore({ rpc }) };
}

describe("existing governed template management", () => {
  it("returns only the actual server-issued ID and never supplies an actor", async () => {
    const f = fixture();
    await expect(f.store.create(input)).resolves.toBe(id);
    const [operation, args] = f.rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(operation).toBe("create_department_process_template");
    expect(args).not.toHaveProperty("actor_id");
    expect(args).not.toHaveProperty("created_by");
    expect(args).toMatchObject({ p_department_id: id, p_description: null });
  });
  it.each([null, "", "not-a-uuid", [], { id }])("rejects a false success response: %o", async (data) => {
    await expect(fixture(data).store.create(input)).rejects.toThrow("valid saved template/stage ID");
  });
  it("does not retry a non-idempotent creation after authorization failure", async () => {
    const f = fixture(null, { message: "Not authorized" });
    await expect(f.store.create(input)).rejects.toThrow("Not authorized");
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("preserves new-stage null ID and server validation of company-stage provenance", async () => {
    const f = fixture(null, { message: "Source company stage is inactive" });
    await expect(f.store.stage({ templateId: id, stageId: null, stageKey: "FEASIBILITY",
      title: "Feasibility", description: null, sortOrder: 1,
      sourceCompanyProcessStageId: id, taskDepartment: "hardware", required: true,
    })).rejects.toThrow("Source company stage is inactive");
    expect(f.rpc).toHaveBeenCalledWith("upsert_department_process_template_stage", expect.objectContaining({
      p_stage_id: null, p_source_company_process_stage_id: id, p_required: true,
    }));
  });
  it("cloning returns the new draft ID rather than echoing the source template", async () => {
    const newId = "22222222-2222-4222-8222-222222222222";
    const f = fixture(newId);
    await expect(f.store.clone(id)).resolves.toBe(newId);
  });
});
