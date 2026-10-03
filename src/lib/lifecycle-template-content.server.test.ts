import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createLifecycleTemplateContentStore } from "./lifecycle-template-content.server";
const id = "00000000-0000-0000-0000-000000000001";
const revision = "00000000-0000-0000-0000-000000000002";
const checksum = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");
const row = { id: revision, template_id: id, revision_number: 2, content_sha256: checksum("OEM") };
function fixture(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { rpc, store: createLifecycleTemplateContentStore({ rpc } as never) };
}
describe("pending template content store", () => {
  it("preserves exact source bytes and validates the pinned receipt", async () => {
    const f = fixture([{ ...row, content_sha256: checksum("  OEM {{PROJECT_NAME}}\n") }]);
    await expect(f.store.append(id, "  OEM {{PROJECT_NAME}}\n")).resolves.toMatchObject({ id: revision, revisionNumber: 2 });
    expect(f.rpc).toHaveBeenCalledWith("create_lifecycle_document_template_revision", { p_template_id: id, p_content: "  OEM {{PROJECT_NAME}}\n" });
  });
  it("rejects a syntactically valid checksum for different stored content", async () => {
    await expect(fixture([{ ...row, content_sha256: checksum("Different content") }]).store.append(id, "OEM")).rejects.toThrow("Invalid immutable template revision receipt");
  });
  it.each([null, [], [row, row], [{ ...row, template_id: revision }], [{ ...row, revision_number: 0 }], [{ ...row, content_sha256: "bad" }]])("rejects unverified revision receipts: %o", async (data) => {
    await expect(fixture(data).store.append(id, "OEM")).rejects.toThrow();
  });
  it("propagates backend authorization denial", async () => {
    await expect(fixture(null, { message: "Not authorized" }).store.append(id, "OEM")).rejects.toThrow("Not authorized");
  });
  it("does not call the backend for invalid content", async () => {
    const f = fixture([row]);
    await expect(f.store.append(id, "  ")).rejects.toThrow();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("activates only a pinned revision and propagates denied retirement", async () => {
    const f = fixture(null);
    await f.store.activate(id, revision);
    expect(f.rpc).toHaveBeenCalledWith("activate_lifecycle_document_template", { p_template_id: id, p_template_document_revision_id: revision });
    await expect(fixture(null, { message: "Denied" }).store.retire(id)).rejects.toThrow("Denied");
  });
});
