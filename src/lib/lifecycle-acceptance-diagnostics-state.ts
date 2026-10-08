import {
  ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND,
  ORIGINAL_LIFECYCLE_BACKEND,
} from "./lifecycle-deployment-observation";

export type LifecycleDiagnosticsConfiguration =
  | { status: "ISOLATED_READY"; backendRef: typeof ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND }
  | { status: "ORIGINAL_UNAVAILABLE"; backendRef: typeof ORIGINAL_LIFECYCLE_BACKEND }
  | { status: "UNKNOWN_CONFIGURATION" };

export type LifecycleDiagnosticsViewState = LifecycleDiagnosticsConfiguration | { status: "LOADING_CONFIGURATION" };

export function classifyConfiguredLifecycleBackend(backendRef: string | null): LifecycleDiagnosticsConfiguration {
  if (backendRef === ORIGINAL_LIFECYCLE_BACKEND) {
    return { status: "ORIGINAL_UNAVAILABLE", backendRef };
  }
  if (backendRef === ISOLATED_LIFECYCLE_ACCEPTANCE_BACKEND) {
    return { status: "ISOLATED_READY", backendRef };
  }
  return { status: "UNKNOWN_CONFIGURATION" };
}

export function canRunScopedObservation(
  configuration: LifecycleDiagnosticsViewState,
  completeScope: boolean,
  busy: boolean,
): configuration is Extract<LifecycleDiagnosticsConfiguration, { status: "ISOLATED_READY" }> {
  return configuration.status === "ISOLATED_READY" && completeScope && !busy;
}