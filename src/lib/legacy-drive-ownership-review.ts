import { supabase } from "@/integrations/supabase/client";

type ProjectRead = { id: string; code: string; name: string; department_id: string | null; project_drive_node_id: string | null };
type DriveNodeRead = { id: string; project_id: string | null; department_id: string | null; parent_id: string | null; node_type: string; folder_kind: string; current_version: number; storage_bucket: string | null; storage_path: string | null; is_trashed: boolean };
type RevisionRead = { node_id: string };

export type LegacyDriveOwnershipReview = {
  projectId: string;
  projectLabel: string;
  projectDepartmentId: string | null;
  projectDriveNodeId: string | null;
  nodeCount: number;
  descendantDepartmentMismatchCount: number;
  descendantDepartmentMissingCount: number;
  projectDrivePointerGap: boolean;
  rootGap: boolean;
  fileStorageGapCount: number;
  revisionGapCount: number;
  requiresExplicitOwner: boolean;
};

export type LegacyDriveOwnershipPreflight = {
  reviewedAt: string;
  projects: LegacyDriveOwnershipReview[];
  counts: { affectedProjects: number; unmappedProjects: number; descendantDepartmentMismatches: number; storageGaps: number; revisionGaps: number };
};

export function buildLegacyDriveOwnershipPreflight(projects: ProjectRead[], nodes: DriveNodeRead[], revisions: RevisionRead[], reviewedAt = new Date().toISOString()): LegacyDriveOwnershipPreflight {
  const revisionsByNode = new Set(revisions.map((revision) => revision.node_id));
  const reviews = projects.map((project) => {
    const descendants = nodes.filter((node) => node.project_id === project.id && !node.is_trashed);
    const projectPointer = descendants.find((node) => node.id === project.project_drive_node_id) ?? null;
    const root = descendants.find((node) => node.folder_kind === "PROJECT_ROOT") ?? descendants.find((node) => node.parent_id === null) ?? null;
    const mismatches = project.department_id ? descendants.filter((node) => node.department_id !== project.department_id) : [];
    const storageGaps = descendants.filter((node) => node.node_type === "FILE" && (!node.storage_bucket || !node.storage_path));
    const revisionGaps = descendants.filter((node) => node.node_type === "FILE" && node.current_version > 1 && !revisionsByNode.has(node.id));
    return {
      projectId: project.id, projectLabel: `${project.code} · ${project.name}`, projectDepartmentId: project.department_id, projectDriveNodeId: project.project_drive_node_id,
      nodeCount: descendants.length, descendantDepartmentMismatchCount: mismatches.length,
      descendantDepartmentMissingCount: project.department_id ? descendants.filter((node) => node.department_id === null).length : descendants.length,
      projectDrivePointerGap: Boolean(project.project_drive_node_id && !projectPointer), rootGap: !root,
      fileStorageGapCount: storageGaps.length, revisionGapCount: revisionGaps.length, requiresExplicitOwner: project.department_id === null,
    } satisfies LegacyDriveOwnershipReview;
  });
  const affected = reviews.filter((review) => review.requiresExplicitOwner || review.descendantDepartmentMismatchCount > 0 || review.projectDrivePointerGap || review.rootGap || review.fileStorageGapCount > 0 || review.revisionGapCount > 0);
  return { reviewedAt, projects: reviews, counts: {
    affectedProjects: affected.length, unmappedProjects: reviews.filter((review) => review.requiresExplicitOwner).length,
    descendantDepartmentMismatches: reviews.reduce((total, review) => total + review.descendantDepartmentMismatchCount, 0),
    storageGaps: reviews.reduce((total, review) => total + review.fileStorageGapCount, 0),
    revisionGaps: reviews.reduce((total, review) => total + review.revisionGapCount, 0),
  } };
}

export async function fetchLegacyDriveOwnershipPreflight(): Promise<LegacyDriveOwnershipPreflight> {
  const [projectsResult, nodesResult, revisionsResult] = await Promise.all([
    supabase.from("projects").select("id,code,name,department_id,project_drive_node_id").order("code"),
    supabase.from("drive_nodes").select("id,project_id,department_id,parent_id,node_type,folder_kind,current_version,storage_bucket,storage_path,is_trashed"),
    supabase.from("drive_node_revisions").select("node_id"),
  ]);
  const error = projectsResult.error ?? nodesResult.error ?? revisionsResult.error;
  if (error) throw error;
  return buildLegacyDriveOwnershipPreflight((projectsResult.data ?? []) as ProjectRead[], (nodesResult.data ?? []) as DriveNodeRead[], (revisionsResult.data ?? []) as RevisionRead[]);
}