import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SavedBomItem {
  line_index: number;
  mpn: string | null;
  manufacturer: string | null;
  value: string | null;
  description: string | null;
  refs: string | null;
  footprint: string | null;
  quantity: number;
  remark: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  matched_component_id: string | null;
  match_status: string | null;
  shortage: number;
}

export interface ProjectBomSummary {
  id: string;
  bom_number: string;
  name: string;
  source_filename: string | null;
  revision: string | null;
  notes: string | null;
  line_count: number;
  total_cost: number | null;
  created_at: string;
  source_drive_node_id?: string | null;
  source_drive_revision_id?: string | null;
}

export interface DriveProjectBomSummary extends ProjectBomSummary {
  project_id: string;
  project_name: string;
  project_code: string | null;
}

export interface ProjectBomItemRow extends SavedBomItem {
  id: string;
  bom_id: string;
  matched_part_number: string | null;
  matched_name: string | null;
}

const itemSchema = z.object({
  line_index: z.number().int(),
  mpn: z.string().nullable(),
  manufacturer: z.string().nullable(),
  value: z.string().nullable(),
  description: z.string().nullable(),
  refs: z.string().nullable(),
  footprint: z.string().nullable(),
  quantity: z.number().int(),
  remark: z.string().nullable(),
  unit_cost: z.number().nullable(),
  total_cost: z.number().nullable(),
  matched_component_id: z.string().nullable(),
  match_status: z.string().nullable(),
  shortage: z.number().int(),
});

const saveSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  source_filename: z.string().nullable(),
  revision: z.string().max(40).nullable(),
  notes: z.string().nullable(),
  source_drive_node_id: z.string().uuid().nullable().optional(),
  source_drive_revision_id: z.string().uuid().nullable().optional(),
  items: z.array(itemSchema).min(1),
});

export const saveProjectBom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = context.userId;

    // 1. Find an existing BOM with the same project + name (re-save replaces it)
    const { data: existing } = await sb
      .from("project_boms")
      .select("id, bom_number")
      .eq("project_id", data.project_id)
      .eq("name", data.name)
      .maybeSingle();

    let bom_id: string;
    let bom_number: string;

    if (existing) {
      bom_id = existing.id;
      bom_number = existing.bom_number;
      const { error } = await sb
        .from("project_boms")
        .update({
          source_filename: data.source_filename,
          revision: data.revision,
          notes: data.notes,
          source_drive_node_id: data.source_drive_node_id ?? null,
          source_drive_revision_id: data.source_drive_revision_id ?? null,
        })
        .eq("id", bom_id);
      if (error) throw new Error(error.message);
    } else {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: numRow, error: numErr } = await supabaseAdmin.rpc("next_document_number", { _kind: "BOM" });
      if (numErr || !numRow) throw new Error(numErr?.message ?? "Could not generate BOM number");
      bom_number = numRow as string;
      const { data: inserted, error: insErr } = await sb
        .from("project_boms")
        .insert({
          bom_number,
          project_id: data.project_id,
          name: data.name,
          source_filename: data.source_filename,
          revision: data.revision,
          notes: data.notes,
          source_drive_node_id: data.source_drive_node_id ?? null,
          source_drive_revision_id: data.source_drive_revision_id ?? null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (insErr || !inserted) throw new Error(insErr?.message ?? "Could not save BOM");
      bom_id = inserted.id;
    }

    if (data.source_drive_node_id) {
      const { data: sourceFile, error: sourceError } = await sb
        .from("drive_nodes")
        .select("id, project_id, current_version")
        .eq("id", data.source_drive_node_id)
        .maybeSingle();
      if (sourceError || !sourceFile || sourceFile.project_id !== data.project_id) {
        throw new Error("The selected Drive file does not belong to this project.");
      }
      if (data.source_drive_revision_id) {
        const { data: sourceRevision, error: revisionError } = await sb
          .from("drive_node_revisions")
          .select("id, node_id")
          .eq("id", data.source_drive_revision_id)
          .maybeSingle();
        if (revisionError || !sourceRevision || sourceRevision.node_id !== data.source_drive_node_id) {
          throw new Error("The selected Drive revision does not belong to the source file.");
        }
      }
    }

    // 2. Replace the line items
    const { error: delErr } = await sb.from("project_bom_items").delete().eq("bom_id", bom_id);
    if (delErr) throw new Error(delErr.message);

    const rows = data.items.map((it) => ({
      bom_id,
      line_index: it.line_index,
      mpn: it.mpn,
      manufacturer: it.manufacturer,
      value: it.value,
      description: it.description,
      refs: it.refs,
      footprint: it.footprint,
      quantity: it.quantity,
      remark: it.remark,
      unit_cost: it.unit_cost,
      total_cost: it.total_cost,
      matched_component_id: it.matched_component_id,
      match_status: it.match_status,
      shortage: it.shortage,
    }));

    const { error: itemErr } = await sb.from("project_bom_items").insert(rows);
    if (itemErr) throw new Error(itemErr.message);

    // 3. Recompute summary on the bom row
    const line_count = rows.length;
    const total_cost = rows.reduce(
      (sum, r) => sum + (r.total_cost ?? (r.unit_cost != null ? Math.round(r.quantity * r.unit_cost * 100) / 100 : 0)),
      0,
    );
    await sb.from("project_boms").update({ line_count, total_cost: Math.round(total_cost * 100) / 100 }).eq("id", bom_id);

    return { bom_id, bom_number, name: data.name };
  });

export const fetchProjectBoms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("project_boms")
      .select("id, bom_number, name, source_filename, revision, notes, line_count, total_cost, created_at, source_drive_node_id, source_drive_revision_id")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProjectBomSummary[];
  });

/** RLS-scoped saved BOM index for the controlled Drive workspace. */
export const fetchDriveProjectBoms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("project_boms")
      .select("id, bom_number, name, source_filename, revision, notes, line_count, total_cost, created_at, project_id, source_drive_node_id, source_drive_revision_id, project:projects(name, code)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((row) => ({
      id: row.id,
      bom_number: row.bom_number,
      name: row.name,
      source_filename: row.source_filename,
      revision: row.revision,
      notes: row.notes,
      line_count: row.line_count,
      total_cost: row.total_cost,
      created_at: row.created_at,
      source_drive_node_id: row.source_drive_node_id,
      source_drive_revision_id: row.source_drive_revision_id,
      project_id: row.project_id,
      project_name: row.project?.name ?? "Untitled project",
      project_code: row.project?.code ?? null,
    })) as DriveProjectBomSummary[];
  });

export const fetchProjectBomItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bomId: string }) => z.object({ bomId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: header, error: hErr } = await sb
      .from("project_boms")
      .select("id, bom_number, name, source_filename, revision, notes, line_count, total_cost, created_at, project_id")
      .eq("id", data.bomId)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!header) throw new Error("BOM not found");
    const { data: items, error: iErr } = await sb
      .from("project_bom_items")
      .select("id, bom_id, line_index, mpn, manufacturer, value, description, refs, footprint, quantity, remark, unit_cost, total_cost, matched_component_id, match_status, shortage, matched:components(part_number, name)")
      .eq("bom_id", data.bomId)
      .order("line_index", { ascending: true });
    if (iErr) throw new Error(iErr.message);
    const rows = ((items ?? []) as any[]).map((it) => ({
      id: it.id,
      bom_id: it.bom_id,
      line_index: it.line_index,
      mpn: it.mpn,
      manufacturer: it.manufacturer,
      value: it.value,
      description: it.description,
      refs: it.refs,
      footprint: it.footprint,
      quantity: it.quantity,
      remark: it.remark,
      unit_cost: it.unit_cost,
      total_cost: it.total_cost,
      matched_component_id: it.matched_component_id,
      match_status: it.match_status,
      shortage: it.shortage,
      matched_part_number: it.matched?.part_number ?? null,
      matched_name: it.matched?.name ?? null,
    })) as ProjectBomItemRow[];
    return { header, items: rows };
  });

export interface LoadedBomLine {
  line_index: number;
  mpn: string;
  manufacturer: string;
  value: string;
  description: string;
  refs: string;
  footprint: string;
  quantity: number;
  remark: string;
  unitCost: number | null;
  totalCost: number | null;
}

export const loadProjectBom = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bomId: string }) => z.object({ bomId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: header, error: hErr } = await sb
      .from("project_boms")
      .select("id, bom_number, name, source_filename, revision, project_id")
      .eq("id", data.bomId)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!header) throw new Error("BOM not found");
    const { data: items, error: iErr } = await sb
      .from("project_bom_items")
      .select("line_index, mpn, manufacturer, value, description, refs, footprint, quantity, remark, unit_cost, total_cost")
      .eq("bom_id", data.bomId)
      .order("line_index", { ascending: true });
    if (iErr) throw new Error(iErr.message);
    const lines: LoadedBomLine[] = ((items ?? []) as any[]).map((it) => ({
      line_index: it.line_index,
      mpn: it.mpn ?? "",
      manufacturer: it.manufacturer ?? "",
      value: it.value ?? "",
      description: it.description ?? "",
      refs: it.refs ?? "",
      footprint: it.footprint ?? "",
      quantity: it.quantity,
      remark: it.remark ?? "",
      unitCost: it.unit_cost,
      totalCost: it.total_cost,
    }));
    return { header, lines };
  });
