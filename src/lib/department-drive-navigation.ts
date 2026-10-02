import type { DriveCategoryPlacement, DriveCategoryTemplate } from "@/lib/drive";

export type DepartmentDriveNavigation = {
  placement: DriveCategoryPlacement;
  label: string;
  categoryCount: number;
  categoryIds: string[];
};

export function buildDepartmentDriveNavigation(categories: DriveCategoryTemplate[]): DepartmentDriveNavigation[] {
  const placements: Array<[DriveCategoryPlacement, string]> = [
    ["COMMON", "Common documents"],
    ["INTERNAL_PROJECT", "Internal projects"],
    ["CLIENT_PROJECT", "Client projects"],
  ];
  return placements.map(([placement, label]) => {
    const scoped = categories.filter((category) => category.placement === placement && category.is_active);
    return { placement, label, categoryCount: scoped.length, categoryIds: scoped.map((category) => category.id) };
  });
}