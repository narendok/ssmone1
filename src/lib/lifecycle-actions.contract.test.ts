import { describe, expect, it } from "vitest";
import { lifecycleActionContracts, lifecycleActionMayRun } from "./lifecycle-actions.contract";

describe("lifecycle protected-action contract", () => {
  it("keeps only generation replay-safe by request key", () => {
    expect(lifecycleActionContracts.materialize.idempotent).toBe(true);
    expect(Object.values(lifecycleActionContracts).filter((item) => item.idempotent)).toHaveLength(1);
  });

  it("requires deployment review and isolated database acceptance before mutation can be enabled", () => {
    expect(lifecycleActionMayRun({ approvedForDeployment: false, hasIsolatedDbAcceptance: true })).toBe(false);
    expect(lifecycleActionMayRun({ approvedForDeployment: true, hasIsolatedDbAcceptance: false })).toBe(false);
    expect(lifecycleActionMayRun({ approvedForDeployment: true, hasIsolatedDbAcceptance: true })).toBe(true);
  });
});