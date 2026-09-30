import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export const DRIVE_BUCKET = "project-drive";

export type NodeType = "FOLDER" | "FILE";

export type DriveFileType =
  | "BOM" | "GERBER" | "FIRMWARE" | "CAD_STEP" | "CAD_STL" | "PDF_DRAWING"
  | "PPAP_DOC" | "PHOTO" | "SPREADSHEET" | "BACKUP" | "OTHER";

export interface DriveNode {
  id: string;
  project_id: string | null;
  department_id: string | null;
  parent_id: string | null;
  name: string;
  slug: string;
  node_type: NodeType;
  folder_kind: string;
  file_type: DriveFileType | null;
  mime_type: string | null;
  file_size_bytes: number;
  storage_bucket: string | null;
  storage_path: string | null;
  sha256_checksum: string | null;
  is_starred: boolean;
  starred_reason: string | null;
  current_version: number;
  is_locked: boolean;
  is_trashed: boolean;
  metadata: Record<string, any>;
  created_by: string | null;


  created_at: string;
  updated_at: string;
}

export type DriveCategoryPlacement = "COMMON" | "INTERNAL_PROJECT" | "CLIENT_PROJECT";

export interface DriveCategoryTemplate {
  id: string;
  department_id: string;
  placement: DriveCategoryPlacement;
  label: string;
  slug: string;
  linked_work_area: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriveRevision {
  id: string;
  node_id: string;
  version: number;
  file_size_bytes: number;
  storage_path: string;
  sha256_checksum: string | null;
  change_summary: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DriveShareLink {
  id: string;
  node_id: string;
  share_token: string;
  permission_level: "VIEW" | "DOWNLOAD";
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface Breadcrumb {
  id: string;
  name: string;
  node_type: string;
  depth: number;
}

/* ---------------- helpers ---------------- */

export function formatBytes(n: number): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function guessFileType(name: string): DriveFileType {
  const e = extOf(name);
  if (["bin", "hex", "elf", "uf2"].includes(e)) return "FIRMWARE";
  if (e === "stl") return "CAD_STL";
  if (["step", "stp", "iges", "igs", "sldprt", "f3d"].includes(e)) return "CAD_STEP";
  if (["gbr", "gbl", "gtl", "drl", "zip"].includes(e)) return "GERBER";
  if (e === "pdf") return "PDF_DRAWING";
  if (["csv"].includes(e)) return "BOM";
  if (["xls", "xlsx"].includes(e)) return "SPREADSHEET";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(e)) return "PHOTO";
  return "OTHER";
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "item";
}

export async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const FOLDER_COLOR: Record<string, string> = {
  "ppap-package": "text-emerald-500",
  firmware: "text-cyan-500",
  "golden-prod": "text-cyan-500",
  cad: "text-violet-500",
  bom: "text-amber-500",
  hardware: "text-blue-500",
  gerbers: "text-blue-500",
  qa: "text-rose-500",
  procurement: "text-emerald-500",
};

/* ---------------- queries ---------------- */

export async function fetchChildren(parentId: string | null, projectId?: string | null, departmentId?: string | null): Promise<DriveNode[]> {
  let q = sb.from("drive_nodes").select("*").eq("is_trashed", false);
  q = parentId === null ? q.is("parent_id", null) : q.eq("parent_id", parentId);
  if (parentId === null && projectId) q = q.eq("project_id", projectId);
  if (parentId === null && departmentId) q = q.eq("department_id", departmentId);
  const { data, error } = await q.order("node_type").order("name");
  if (error) throw error;
  return (data ?? []) as DriveNode[];
}

export async function fetchDriveCategoryTemplates(departmentId?: string | null): Promise<DriveCategoryTemplate[]> {
  let query = sb
    .from("drive_category_templates")
    .select("*")
    .order("placement")
    .order("sort_order")
    .order("label");
  if (departmentId) query = query.eq("department_id", departmentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DriveCategoryTemplate[];
}

export async function fetchAllNodes(projectId?: string | null): Promise<DriveNode[]> {
  let q = sb.from("drive_nodes").select("*").eq("is_trashed", false);
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q.order("name");
  if (error) throw error;
  return (data ?? []) as DriveNode[];
}

export async function fetchDepartmentDriveRoots(departmentId: string): Promise<DriveNode[]> {
  const { data, error } = await sb
    .from("drive_nodes")
    .select("*")
    .eq("department_id", departmentId)
    .eq("is_trashed", false)
    .in("folder_kind", ["DEPARTMENT_STANDARDS", "INTERNAL_PROJECTS", "CLIENT_PROJECTS"])
    .order("folder_kind");
  if (error) throw error;
  return (data ?? []) as DriveNode[];
}

export async function fetchBreadcrumbs(nodeId: string): Promise<Breadcrumb[]> {
  const { data, error } = await sb.rpc("get_drive_breadcrumbs", { p_node_id: nodeId });
  if (error) throw error;
  return (data ?? []) as Breadcrumb[];
}

export async function fetchFavorites(): Promise<Set<string>> {
  const { data } = await sb.from("drive_user_favorites").select("node_id");
  return new Set<string>((data ?? []).map((r: any) => r.node_id as string));
}

export async function toggleStar(nodeId: string): Promise<boolean> {
  const { data, error } = await sb.rpc("toggle_node_star", { p_node_id: nodeId });
  if (error) throw error;
  return Boolean(data);
}

export async function createFolder(opts: {
  name: string;
  parentId: string | null;
  projectId: string | null;
  departmentId?: string | null;
}): Promise<DriveNode> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await sb
    .from("drive_nodes")
    .insert({
      name: opts.name,
      slug: slugify(opts.name),
      node_type: "FOLDER",
      parent_id: opts.parentId,
      project_id: opts.projectId,
      department_id: opts.departmentId ?? null,
      created_by: u.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DriveNode;
}

export async function renameNode(id: string, name: string) {
  const { error } = await sb.from("drive_nodes").update({ name, slug: slugify(name) }).eq("id", id);
  if (error) throw error;
}

export async function trashNode(node: DriveNode) {
  if (node.is_locked) throw new Error("This folder is part of the standard structure and cannot be removed.");
  const { error } = await sb.from("drive_nodes").update({ is_trashed: true }).eq("id", node.id);
  if (error) throw error;
}

export async function uploadFile(opts: {
  file: File;
  parentId: string | null;
  projectId: string | null;
  departmentId?: string | null;
  onProgress?: (label: string) => void;
}): Promise<DriveNode> {
  const { file, parentId, projectId, departmentId } = opts;
  opts.onProgress?.("Calculating checksum…");
  const checksum = await sha256Hex(file);
  const { data: u } = await supabase.auth.getUser();
  const path = `${projectId ?? "general"}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  opts.onProgress?.("Uploading…");
  const { error: upErr } = await supabase.storage.from(DRIVE_BUCKET).upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await sb
    .from("drive_nodes")
    .insert({
      name: file.name,
      slug: slugify(file.name),
      node_type: "FILE",
      file_type: guessFileType(file.name),
      mime_type: file.type || null,
      file_size_bytes: file.size,
      storage_bucket: DRIVE_BUCKET,
      storage_path: path,
      sha256_checksum: checksum,
      parent_id: parentId,
      project_id: projectId,
      department_id: departmentId ?? null,
      created_by: u.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DriveNode;
}

export async function uploadRevision(node: DriveNode, file: File, summary: string): Promise<void> {
  const checksum = await sha256Hex(file);
  const { data: u } = await supabase.auth.getUser();
  const path = `${node.project_id ?? "general"}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error: upErr } = await supabase.storage.from(DRIVE_BUCKET).upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  // Archive the version currently on the node.
  if (node.storage_path) {
    await sb.from("drive_node_revisions").insert({
      node_id: node.id,
      version: node.current_version,
      file_size_bytes: node.file_size_bytes,
      storage_path: node.storage_path,
      sha256_checksum: node.sha256_checksum,
      change_summary: summary || null,
      uploaded_by: u.user?.id ?? null,
    });
  }

  const { error } = await sb
    .from("drive_nodes")
    .update({
      storage_path: path,
      storage_bucket: DRIVE_BUCKET,
      file_size_bytes: file.size,
      sha256_checksum: checksum,
      mime_type: file.type || null,
      current_version: node.current_version + 1,
    })
    .eq("id", node.id);
  if (error) throw error;
}

export async function fetchRevisions(nodeId: string): Promise<DriveRevision[]> {
  const { data, error } = await sb
    .from("drive_node_revisions")
    .select("*")
    .eq("node_id", nodeId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DriveRevision[];
}

export async function signedUrl(path: string, seconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(DRIVE_BUCKET).createSignedUrl(path, seconds);
  if (error || !data) throw error ?? new Error("Could not create a download link");
  return data.signedUrl;
}

export async function downloadNode(node: DriveNode) {
  if (!node.storage_path) return;
  const url = await signedUrl(node.storage_path);
  const a = document.createElement("a");
  a.href = url;
  a.download = node.name;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function fetchShareLinks(nodeId: string): Promise<DriveShareLink[]> {
  const { data, error } = await sb
    .from("drive_share_links")
    .select("*")
    .eq("node_id", nodeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DriveShareLink[];
}

export async function createShareLink(
  nodeId: string,
  permission: "VIEW" | "DOWNLOAD",
  expiresInDays: number | null,
): Promise<DriveShareLink> {
  const { data: u } = await supabase.auth.getUser();
  const expires_at =
    expiresInDays === null ? null : new Date(Date.now() + expiresInDays * 86400_000).toISOString();
  const { data, error } = await sb
    .from("drive_share_links")
    .insert({ node_id: nodeId, permission_level: permission, expires_at, created_by: u.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as DriveShareLink;
}

export async function revokeShareLink(id: string) {
  const { error } = await sb.from("drive_share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function updateNodeMetadata(id: string, metadata: Record<string, any>) {
  const { error } = await sb.from("drive_nodes").update({ metadata }).eq("id", id);
  if (error) throw error;
}

/** Files of the given kinds anywhere inside a project (used by the Firmware and CAD vaults). */
export async function fetchProjectFilesByType(
  projectId: string,
  types: DriveFileType[],
): Promise<DriveNode[]> {
  const { data, error } = await sb
    .from("drive_nodes")
    .select("*")
    .eq("project_id", projectId)
    .eq("node_type", "FILE")
    .eq("is_trashed", false)
    .in("file_type", types)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DriveNode[];
}

/** Uploads into the project folder whose slug matches, creating nothing else. */
export async function folderIdBySlug(projectId: string, slug: string): Promise<string | null> {
  const { data } = await sb
    .from("drive_nodes")
    .select("id")
    .eq("project_id", projectId)
    .eq("slug", slug)
    .maybeSingle();
  return (data?.id as string) ?? null;
}
