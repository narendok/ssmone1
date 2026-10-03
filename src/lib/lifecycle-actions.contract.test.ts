import { describe, expect, it } from "vitest";
import { lifecycleActionContracts, lifecycleActionMayRun } from "./lifecycle-actions.contract";

describe("lifecycle protected-action contract", () => {
  it("keeps only generation replay-safe by request key", () => {
    expect(lifecycleActionContracts.materialize.idempotent).toBe(true);
    expect(lifecycleActionContracts.documentDraft.idempotent).toBe(true);
    expect(Object.values(lifecycleActionContracts).filter((item) => item.idempotent)).toHaveLength(2);
  });

  it("requires deployment review and isolated database acceptance before mutation can be enabled", () => {
    const completeEvidence = {
      authorization: true,
      rollback: true,
      replayAndConcurrency: true,
      nonAdminRls: true,
    };

    expect(lifecycleActionMayRun({ approvedForDeployment: false, evidence: completeEvidence })).toBe(false);
    expect(lifecycleActionMayRun({ approvedForDeployment: true, evidence: { ...completeEvidence, authorization: false } })).toBe(false);
    expect(lifecycleActionMayRun({ approvedForDeployment: true, evidence: { ...completeEvidence, rollback: false } })).toBe(false);
    expect(lifecycleActionMayRun({ approvedForDeployment: true, evidence: { ...completeEvidence, replayAndConcurrency: false } })).toBe(false);
    expect(lifecycleActionMayRun({ approvedForDeployment: true, evidence: { ...completeEvidence, nonAdminRls: false } })).toBe(false);
    expect(lifecycleActionMayRun({ approvedForDeployment: true, evidence: completeEvidence })).toBe(true);
  });
});