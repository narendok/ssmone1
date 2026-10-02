import { describe, expect, it } from "vitest";
import { isLifecycleTemplateActionAvailable } from "./lifecycle-template-settings";

describe("lifecycle template settings safety", () => {
  it("does not expose template management until protected action acceptance is complete", () => {
    expect(isLifecycleTemplateActionAvailable()).toBe(false);
  });
});