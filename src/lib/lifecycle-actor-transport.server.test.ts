import { describe, expect, it, vi } from "vitest";
import { createLifecycleActorTransport } from "./lifecycle-actor-transport.server";

const actor = "00000000-0000-0000-0000-000000000001";
describe("server-only lifecycle actor transport", () => {
  it("pins the verified identity separately from request arguments", async () => {
    const rpc = vi.fn(async () => ({ data: "receipt", error: null }));
    const storage = {};
    const transport = createLifecycleActorTransport({ rpc, storage } as never, actor);
    const args = { p_template_id: "template", p_verified_actor_id: "browser spoof" };
    await expect(transport.rpc("retire_lifecycle_document_template", args)).resolves.toEqual({ data: "receipt", error: null });
    expect(rpc).toHaveBeenCalledWith("execute_lifecycle_document_action", {
      p_verified_actor_id: actor, p_operation: "retire_lifecycle_document_template", p_arguments: args,
    });
    expect(transport.storage).toBe(storage);
    expect(transport).not.toHaveProperty("from");
  });
  it("rejects arbitrary RPCs before contacting the privileged client", async () => {
    const rpc = vi.fn();
    const transport = createLifecycleActorTransport({ rpc, storage: {} } as never, actor);
    await expect(transport.rpc("unrelated_admin_rpc", {})).rejects.toThrow("Unsupported");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects missing verified identity", () => {
    expect(() => createLifecycleActorTransport({} as never, "")).toThrow("verified");
  });
  it("retains backend errors instead of presenting a successful save", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "Not authorized" } }));
    const transport = createLifecycleActorTransport({ rpc, storage: {} } as never, actor);
    await expect(transport.rpc("activate_lifecycle_document_template", {})).resolves.toEqual({ data: null, error: { message: "Not authorized" } });
  });
});
