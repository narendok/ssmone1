import { describe, expect, it } from "vitest";
import {
  canRunScopedObservation,
  classifyConfiguredLifecycleBackend,
} from "./lifecycle-acceptance-diagnostics-state";
import {
  ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND,
  ORIGINAL_LIFECYCLE_BACKEND,
} from "./lifecycle-deployment-observation";

describe("lifecycle diagnostics configuration state", () => {
  it("marks the configured original backend unavailable before any scoped input", () => {
    const configuration = classifyConfiguredLifecycleBackend(ORIGINAL_LIFECYCLE_BACKEND);
    expect(configuration).toEqual({ status: "ORIGINAL_UNAVAILABLE", backendRef: ORIGINAL_LIFECYCLE_BACKEND });
    expect(canRunScopedObservation(configuration, true, false)).toBe(false);
  });

  it("permits only the configured isolated backend after a complete explicit scope", () => {
    const configuration = classifyConfiguredLifecycleBackend(ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND);
    expect(configuration).toEqual({ status: "ISOLATED_READY", backendRef: ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND });
    expect(canRunScopedObservation(configuration, false, false)).toBe(false);
    expect(canRunScopedObservation(configuration, true, true)).toBe(false);
    expect(canRunScopedObservation(configuration, true, false)).toBe(true);
  });

  it("keeps unknown or absent configuration unavailable without inferring a target", () => {
    expect(classifyConfiguredLifecycleBackend(null)).toEqual({ status: "UNKNOWN_CONFIGURATION" });
    expect(classifyConfiguredLifecycleBackend("abcdefghijklmnopqrst")).toEqual({ status: "UNKNOWN_CONFIGURATION" });
  });

  it("does not authorize observation while configuration is loading", () => {
    expect(canRunScopedObservation({ status: "LOADING_CONFIGURATION" }, true, false)).toBe(false);
  });
});