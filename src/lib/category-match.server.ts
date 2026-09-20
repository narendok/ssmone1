// AI category matcher — server-only.
// Given a looked-up part, picks the closest existing category (deepest match).

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface ClassifyInput {
  mpn: string;
  manufacturer?: string | null;
  description?: string | null;
  category?: string | null;
  package?: string | null;
}

function buildLabels(rows: CategoryRow[]): { id: string; label: string }[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows.map((r) => {
    const parts: string[] = [r.name];
    let cur = r.parent_id ? byId.get(r.parent_id) : undefined;
    let guard = 0;
    while (cur && guard++ < 5) {
      parts.unshift(cur.name);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return { id: r.id, label: parts.join(" > ") };
  });
}

export async function classifyPartCategory(
  supabase: { from: (t: string) => any },
  input: ClassifyInput,
): Promise<{ categoryId: string | null; label: string | null; confidence: number | null }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { categoryId: null, label: null, confidence: null };

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .order("sort_order");
  if (error || !data?.length) return { categoryId: null, label: null, confidence: null };

  const rows = data as CategoryRow[];
  const labels = buildLabels(rows).filter((l) => !/^uncategorized$/i.test(l.label));
  if (!labels.length) return { categoryId: null, label: null, confidence: null };

  const list = labels.map((l) => `${l.id}\t${l.label}`).join("\n");
  const part = [
    `Part number: ${input.mpn}`,
    input.manufacturer ? `Manufacturer: ${input.manufacturer}` : "",
    input.description ? `Description: ${input.description}` : "",
    input.category ? `Supplier category: ${input.category}` : "",
    input.package ? `Package: ${input.package}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        max_completion_tokens: 80,
        messages: [
          {
            role: "system",
            content:
               "You classify electronic components into an existing category list. Each line is `id<TAB>Parent > Child` label. Reply with ONLY the id of the single best-matching category, preferring the deepest (most specific) match. If nothing fits well, reply exactly NONE. No prose.",
          },
          { role: "user", content: `Categories:\n${list}\n\nPart:\n${part}` },
        ],
      }),
    });
    if (!res.ok) return { categoryId: null, label: null, confidence: null };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    if (!uuid) return { categoryId: null, label: null, confidence: null };
    const hit = labels.find((l) => l.id.toLowerCase() === uuid.toLowerCase());
    return hit ? { categoryId: hit.id, label: hit.label, confidence: 0.6 } : { categoryId: null, label: null, confidence: null };
  } catch {
    return { categoryId: null, label: null, confidence: null };
  }
}
