import type { DriveCategoryTemplate, DriveNode } from "@/lib/drive";

export type DepartmentDriveTaxonomyKey = "controlled" | "reviews" | "deliverables";
export type DepartmentDriveTaxonomyEntry = {
  key: DepartmentDriveTaxonomyKey;
  label: string;
  description: string;
  rootFolderKind: "DEPARTMENT_STANDARDS" | "INTERNAL_PROJECTS" | "CLIENT_PROJECTS";
  categoryCount: number;
  categoryIds: string[];
  mappedFolderId: string | null;
  mappingState: "mapped" | "unmapped";
};

const taxonomy: Array<Omit<DepartmentDriveTaxonomyEntry, "categoryCount" | "categoryIds" | "mappedFolderId" | "mappingState">> = [
  {
    key: "controlled",
    label: "Common Controlled Documents",
    description: "Department rules, regulations, standards, and controlled records.",
    rootFolderKind: "DEPARTMENT_STANDARDS",
  },
  {
    key: "reviews",
    label: "Periodic and Conditional Reviews",
    description: "Recurring and event-driven review evidence held with controlled department records.",
    rootFolderKind: "DEPARTMENT_STANDARDS",
  },
  {
    key: "deliverables",
    label: "Project Deliverables",
    description: "Project folders; use Internal or Client as a secondary project filter.",
    rootFolderKind: "INTERNAL_PROJECTS",
  },
];

export function buildDepartmentDriveTaxonomy(
  roots: Pick<DriveNode, "id" | "folder_kind">[],
  categories: DriveCategoryTemplate[],
): DepartmentDriveTaxonomyEntry[] {
  const common = categories.filter((category) => category.placement === "COMMON" && category.is_active);
  const project = categories.filter((category) => category.placement === "INTERNAL_PROJECT" || category.placement === "CLIENT_PROJECT");
  return taxonomy.map((entry) => {
    const scoped = entry.key === "deliverables" ? project.filter((category) => category.is_active) : common;
    const root = roots.find((candidate) => candidate.folder_kind === entry.rootFolderKind);
    return {
      ...entry,
      categoryCount: scoped.length,
      categoryIds: scoped.map((category) => category.id),
      mappedFolderId: root?.id ?? null,
      mappingState: root ? "mapped" : "unmapped",
    };
  });
}

export function isAllowedDepartmentDriveRoot(kind: string): kind is DepartmentDriveTaxonomyEntry["rootFolderKind"] | "CLIENT_PROJECTS" {
  return ["DEPARTMENT_STANDARDS", "INTERNAL_PROJECTS", "CLIENT_PROJECTS"].includes(kind);
}
