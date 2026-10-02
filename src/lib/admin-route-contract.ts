export const ADMIN_ROUTE_CONTRACT = {
  overview: "/admin",
  ownershipReview: "/admin/drive-ownership",
  ownershipReviewHeading: "Legacy Drive ownership review",
} as const;

export function resolveAdminRouteView(pathname: string) {
  if (pathname === ADMIN_ROUTE_CONTRACT.ownershipReview) return "ownership-review" as const;
  if (pathname === ADMIN_ROUTE_CONTRACT.overview) return "overview" as const;
  return "other" as const;
}