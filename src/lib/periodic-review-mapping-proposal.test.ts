import { describe, expect, it } from "vitest";
import { PERIODIC_REVIEW_METADATA, periodicReviewMappingPreflight } from "./periodic-review-mapping-proposal";

describe("periodic and conditional review proposal", () => {
  it("requires verified ownership and a department standards root", () => {
    expect(periodicReviewMappingPreflight({ departmentId: null, standardsRootId: "standards", existingReviewFolderIds: [] })).toMatchObject({ canProvision: false });
    expect(periodicReviewMappingPreflight({ departmentId: "dept", standardsRootId: null, existingReviewFolderIds: [] })).toMatchObject({ canProvision: false });
  });
  it("refuses duplicate review roots instead of changing historical folders", () => {
    expect(periodicReviewMappingPreflight({ departmentId: "dept", standardsRootId: "standards", existingReviewFolderIds: ["one", "two"] })).toMatchObject({ canProvision: false });
  });
  it("uses a fixed metadata marker, not an inferred historical folder name", () => {
    expect(PERIODIC_REVIEW_METADATA).toEqual({ taxonomy: "periodic-conditional-review-v1", category: "PERIODIC_CONDITIONAL_REVIEW", placement: "COMMON" });
  });
});