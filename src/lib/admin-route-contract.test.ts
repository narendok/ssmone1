import { describe, expect, it } from "vitest";
import { ADMIN_ROUTE_CONTRACT, resolveAdminRouteView } from "./admin-route-contract";

describe("admin route contract", () => {
  it("keeps the system controls overview at the admin index", () => {
    expect(resolveAdminRouteView(ADMIN_ROUTE_CONTRACT.overview)).toBe("overview");
  });

  it("resolves the ownership review as a distinct child route", () => {
    expect(resolveAdminRouteView(ADMIN_ROUTE_CONTRACT.ownershipReview)).toBe("ownership-review");
  });

  it("does not treat the child review URL as the overview", () => {
    expect(resolveAdminRouteView(ADMIN_ROUTE_CONTRACT.ownershipReview)).not.toBe("overview");
  });
});