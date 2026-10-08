import { describe, expect, it, vi } from "vitest";
import { createSalesReviewerResponseReadbackAdapter } from "./sales-bound-requirement-readback";

const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
const request = {
  kind: "sales-reviewer-response-read" as const,
  assertion: "reviewer-response-readback" as const,
  scope: { reviewId: ids[0], requirementId: ids[1], sourceRevisionId: ids[2], masterSpecificationVersionId: ids[3], requestKey: ids[4] },
};
const row = { review_id: ids[0], requirement_id: ids[1], source_revision_id: ids[2], master_specification_version_id: ids[3], request_key: ids[4], audit_id: ids[5] };

describe("reviewer receipt adapter boundary", () => {
  it("does not call the RPC while disabled", async () => {
    const rpc = vi.fn();
    const adapter = createSalesReviewerResponseReadbackAdapter({ callerRlsRpc: { rpc }, enabled: false });
    expect((await adapter.observe(request)).status).toBe("BLOCKED");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("binds every immutable scope field to the exact RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const adapter = createSalesReviewerResponseReadbackAdapter({ callerRlsRpc: { rpc }, enabled: true });
    expect((await adapter.observe(request)).status).toBe("OBSERVED");
    expect(rpc).toHaveBeenCalledWith("read_requirement_feasibility_response_receipt", {
      p_review_id: ids[0], p_requirement_id: ids[1], p_source_revision_id: ids[2], p_master_specification_version_id: ids[3], p_request_key: ids[4],
    });
  });

  it("rejects denied, missing, duplicate, malformed and individually mismatched evidence", async () => {
    const responses = [
      { data: [row], error: { message: "denied" } },
      ...[[], [row, row], [{ ...row, audit_id: "invalid" }], ...Object.keys(request.scope).map((key) => {
        const fields = { reviewId: "review_id", requirementId: "requirement_id", sourceRevisionId: "source_revision_id", masterSpecificationVersionId: "master_specification_version_id", requestKey: "request_key" };
        return [{ ...row, [fields[key as keyof typeof fields]]: ids[5] }];
      })].map((data) => ({ data, error: null })),
    ];
    for (const response of responses) {
      const rpc = vi.fn().mockResolvedValue(response);
      const adapter = createSalesReviewerResponseReadbackAdapter({ callerRlsRpc: { rpc }, enabled: true });
      expect((await adapter.observe(request)).status).toBe("BLOCKED");
    }
  });
});
