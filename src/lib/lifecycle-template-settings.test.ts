import { describe, expect, it } from "vitest";
import { isLifecycleTemplateActionAvailable, lifecycleTemplateMutationStatus } from "./lifecycle-template-settings";

describe("lifecycle template settings safety", () => {
  it("does not expose template management until protected action acceptance is complete", () => {
    expect(isLifecycleTemplateActionAvailable()).toBe(false);
  });

  it("labels protected controls as acceptance-pending rather than working actions", () => {
    expect(lifecycleTemplateMutationStatus()).toEqual({
      available: false,
      message: "Protected template actions are acceptance-pending and cannot change records from this register.",
    });
  });
});