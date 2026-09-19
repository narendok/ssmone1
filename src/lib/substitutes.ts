import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface SubstituteRef {
  id: string;
  name: string;
  part_number: string;
  manufacturer: string | null;
  footprint: string | null;
  package_case: string | null;
  total_quantity: number;
  low_stock_threshold: number;
  note: string | null;
}

const SELECT_COMPONENT = "id, name, part_number, manufacturer, footprint, package_case, low_stock_threshold, locations(quantity)";

function toRef(c: any, note: string | null): SubstituteRef {
  return {
    id: c.id,
    name: c.name,
    part_number: c.part_number,
    manufacturer: c.manufacturer ?? null,
    footprint: c.footprint ?? null,
    package_case: c.package_case ?? null,
    low_stock_threshold: c.low_stock_threshold ?? 0,
    total_quantity: (c.locations ?? []).reduce((s: number, l: any) => s + (l.quantity ?? 0), 0),
    note,
  };
}

/** Substitutes for one component, in both link directions. */
export async function fetchComponentSubstitutes(componentId: string): Promise<SubstituteRef[]> {
  const [fwd, rev] = await Promise.all([
    sb
      .from("component_substitutes")
      .select(`note, substitute:components!component_substitutes_substitute_id_fkey(${SELECT_COMPONENT})`)
      .eq("component_id", componentId),
    sb
      .from("component_substitutes")
      .select(`note, component:components!component_substitutes_component_id_fkey(${SELECT_COMPONENT})`)
      .eq("substitute_id", componentId),
  ]);
  const out = new Map<string, SubstituteRef>();
  for (const row of (fwd.data ?? []) as any[]) {
    if (row.substitute) out.set(row.substitute.id, toRef(row.substitute, row.note ?? null));
  }
  for (const row of (rev.data ?? []) as any[]) {
    if (row.component && !out.has(row.component.id)) out.set(row.component.id, toRef(row.component, row.note ?? null));
  }
  return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Map of component id -> substitutes, for list views. */
export async function fetchAllSubstituteMap(): Promise<Map<string, SubstituteRef[]>> {
  const { data, error } = await sb
    .from("component_substitutes")
    .select(
      `note,
       component:components!component_substitutes_component_id_fkey(${SELECT_COMPONENT}),
       substitute:components!component_substitutes_substitute_id_fkey(${SELECT_COMPONENT})`
    );
  if (error) throw error;
  const map = new Map<string, SubstituteRef[]>();
  const push = (key: string, ref: SubstituteRef) => {
    const arr = map.get(key) ?? [];
    if (!arr.some((r) => r.id === ref.id)) arr.push(ref);
    map.set(key, arr);
  };
  for (const row of (data ?? []) as any[]) {
    if (!row.component || !row.substitute) continue;
    push(row.component.id, toRef(row.substitute, row.note ?? null));
    push(row.substitute.id, toRef(row.component, row.note ?? null));
  }
  for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

/** Replace the substitute links of a component with the given set (notes preserved by id). */
export async function syncComponentSubstitutes(
  componentId: string,
  links: { id: string; note: string | null }[]
) {
  const current = await fetchComponentSubstitutes(componentId);
  const have = new Map(current.map((c) => [c.id, c.note]));
  const want = new Map(links.map((l) => [l.id, l.note?.trim() ? l.note.trim() : null]));

  const toAdd = [...want.keys()].filter((id) => !have.has(id));
  const toRemove = [...have.keys()].filter((id) => !want.has(id));
  const toUpdate = [...want.entries()].filter(([id, note]) => have.has(id) && have.get(id) !== note);

  if (toAdd.length) {
    await sb
      .from("component_substitutes")
      .insert(toAdd.map((substitute_id) => ({ component_id: componentId, substitute_id, note: want.get(substitute_id) })));
  }
  for (const id of toRemove) {
    await sb
      .from("component_substitutes")
      .delete()
      .or(
        `and(component_id.eq.${componentId},substitute_id.eq.${id}),and(component_id.eq.${id},substitute_id.eq.${componentId})`
      );
  }
  for (const [id, note] of toUpdate) {
    await sb
      .from("component_substitutes")
      .update({ note })
      .or(
        `and(component_id.eq.${componentId},substitute_id.eq.${id}),and(component_id.eq.${id},substitute_id.eq.${componentId})`
      );
  }
}

/** Create a two-way substitute link (idempotent). */
export async function linkSubstitute(componentId: string, substituteId: string, note: string | null) {
  if (componentId === substituteId) return;
  const { data } = await sb
    .from("component_substitutes")
    .select("id")
    .or(
      `and(component_id.eq.${componentId},substitute_id.eq.${substituteId}),and(component_id.eq.${substituteId},substitute_id.eq.${componentId})`
    )
    .limit(1);
  if ((data ?? []).length) return;
  const { error } = await sb
    .from("component_substitutes")
    .insert({ component_id: componentId, substitute_id: substituteId, note });
  if (error) throw error;
}
