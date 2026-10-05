import { describe, expect, it } from "vitest";
import { MASTER_SPECIFICATION_TBC, MASTER_SPECIFICATION_UNKNOWN, draftFromSpecificationData, masterSpecificationDraftSchema, masterSpecificationTitle, type MasterSpecificationDraft } from "./master-specification";
import type { MasterSpecificationSummary } from "./sales";

const draft: MasterSpecificationDraft = { proposedName: "Synthetic Tracker", customerOrInternalOwner: "Synthetic OEM", industryApplication: "Fleet monitoring", productFamily: "Vehicle tracker", developmentScope: "Hardware proof of concept", workstreams: ["HARDWARE", "TEST"], requirementSummary: "Synthetic intake only; no customer notification.", powerAndUnits: MASTER_SPECIFICATION_TBC, interfaces: MASTER_SPECIFICATION_UNKNOWN, connectivityAndGnss: "GNSS", environmentAndIp: MASTER_SPECIFICATION_TBC, volumes: MASTER_SPECIFICATION_UNKNOWN, schedule: MASTER_SPECIFICATION_TBC, requestedStandards: MASTER_SPECIFICATION_UNKNOWN, exclusions: MASTER_SPECIFICATION_UNKNOWN };

describe("Master Specification contract", () => {
  it("requires every shared field and accepts explicit unknown values", () => { expect(masterSpecificationDraftSchema.parse(draft)).toMatchObject({ proposedName: "Synthetic Tracker", workstreams: ["HARDWARE", "TEST"] }); expect(masterSpecificationDraftSchema.safeParse({ ...draft, powerAndUnits: "" }).success).toBe(false); });
  it("keeps the payload bounded and deterministic", () => { expect(masterSpecificationTitle(draft)).toBe("Synthetic Tracker — Master Specification"); expect(draftFromSpecificationData({ ...draft, workstreams: ["HARDWARE", "HARDWARE"] })?.workstreams).toEqual(["HARDWARE"]); expect(draftFromSpecificationData({ ...draft, proposedName: "" })).toBeNull(); });
});
it("models the agreed tracker intake without inventing unavailable values", () => {
  const tracker = masterSpecificationDraftSchema.parse({ ...draft, proposedName: "SYNTHETIC ONLY — Automotive Vehicle Tracker", industryApplication: "Automotive vehicle tracking", productFamily: "Vehicle tracker", developmentScope: "New development", workstreams: ["HARDWARE", "FIRMWARE", "MECHANICAL"], powerAndUnits: "12/24V nominal input", interfaces: "CAN requested", connectivityAndGnss: "LTE/GNSS requested", environmentAndIp: MASTER_SPECIFICATION_TBC, volumes: "20 pilot units", requestedStandards: MASTER_SPECIFICATION_TBC });
  expect(tracker.workstreams).toEqual(["HARDWARE", "FIRMWARE", "MECHANICAL"]);
  expect(tracker.environmentAndIp).toBe(MASTER_SPECIFICATION_TBC);
});

it("uses the immutable specification and version pair instead of an undeployed current-version pointer", () => {
  const summary: MasterSpecificationSummary = { id: "7a3aba95-61f6-495a-a280-f37a3be77670", opportunity_id: "a6c62c81-1cc2-4804-b1c5-c004c6730b52", customer_id: "03e06115-a7d4-4965-9e92-9c37462f5ddc", specification_number: "MASTER-2026-0001", title: "Synthetic Tracker — Master Specification", status: "draft", current_version: 1 };
  expect(summary.current_version).toBe(1);
  expect("current_version_id" in summary).toBe(false);
});
