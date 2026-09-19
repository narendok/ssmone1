// Server-only: reads a purchase invoice (PDF or image) with Lovable AI and
// returns structured line items plus vendor details.

export interface InvoiceExtractLine {
  mpn: string;
  manufacturer: string | null;
  description: string | null;
  quantity: number;
  unit_price: number | null;
  category_id: string | null;
  package: string | null;
}

export interface InvoiceExtractResult {
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string | null;
  lines: InvoiceExtractLine[];
}

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
}

function categoryLabels(rows: CategoryRow[]) {
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

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vendor_name", "invoice_number", "invoice_date", "currency", "lines"],
  properties: {
    vendor_name: { type: ["string", "null"] },
    invoice_number: { type: ["string", "null"] },
    invoice_date: { type: ["string", "null"], description: "ISO date YYYY-MM-DD" },
    currency: { type: ["string", "null"], description: "ISO currency code e.g. INR, USD" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["mpn", "manufacturer", "description", "quantity", "unit_price", "category_id", "package"],
        properties: {
          mpn: { type: "string" },
          manufacturer: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          quantity: { type: "number" },
          unit_price: { type: ["number", "null"] },
          category_id: { type: ["string", "null"] },
          package: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export async function extractInvoice(
  supabase: { from: (t: string) => any },
  input: { dataUrl: string; filename: string; mime: string },
): Promise<InvoiceExtractResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");

  const { data: cats } = await supabase.from("categories").select("id, name, parent_id").order("sort_order");
  const labels = categoryLabels((cats ?? []) as CategoryRow[]);
  const catList = labels.map((l) => `${l.id}\t${l.label}`).join("\n");

  // The data URL's own MIME wins: browsers often report an empty or generic
  // type for files picked from disk, and the model rejects anything that is
  // not a real image/* or application/pdf data URL.
  const urlMime = /^data:([^;,]+)[;,]/.exec(input.dataUrl)?.[1]?.toLowerCase() ?? "";
  const name = input.filename.toLowerCase();
  const extMime = name.endsWith(".pdf")
    ? "application/pdf"
    : name.endsWith(".png")
      ? "image/png"
      : name.endsWith(".webp")
        ? "image/webp"
        : name.endsWith(".gif")
          ? "image/gif"
          : /\.jpe?g$/.test(name)
            ? "image/jpeg"
            : "";

  const base64 = input.dataUrl.slice(input.dataUrl.indexOf(",") + 1).trim();
  // Sniff the real type from the file's own leading bytes (base64 signatures).
  const head = base64.slice(0, 12);
  const sniffed = head.startsWith("JVBER")
    ? "application/pdf"
    : head.startsWith("iVBOR")
      ? "image/png"
      : head.startsWith("/9j/")
        ? "image/jpeg"
        : head.startsWith("UklGR")
          ? "image/webp"
          : head.startsWith("R0lGOD")
            ? "image/gif"
            : "";

  const candidates = [sniffed, urlMime, extMime, (input.mime || "").toLowerCase()];
  const mime =
    candidates.find((m) => m === "application/pdf" || (m && m.startsWith("image/"))) ?? "";
  if (!mime) {
    throw new Error("Unsupported file — upload a PDF, JPG, PNG or WEBP invoice");
  }

  // Re-stamp the data URL with the resolved MIME so the model always sees a
  // supported type even when the browser sent a generic one.
  const dataUrl = `data:${mime};base64,${base64}`;

  const filePart =
    mime === "application/pdf"
      ? {
          type: "input_file",
          filename: name.endsWith(".pdf") ? input.filename : `${input.filename || "invoice"}.pdf`,
          file_data: dataUrl,
        }
      : { type: "input_image", image_url: dataUrl };

  const instruction = [
    "You read electronic-component purchase invoices / order confirmations (DigiKey, Mouser, Robu, LCSC, local vendors).",
    "Extract every purchased line item. Use the manufacturer part number (MPN) when present; otherwise use the distributor part number.",
    "quantity is the number of pieces purchased. unit_price is the price per single piece in the invoice currency (divide line total by quantity if only a total is shown).",
    "Ignore shipping, handling, tax, discount and total rows.",
    "For each line pick the best matching category id from this list (deepest / most specific match), or null if nothing fits:",
    catList || "(no categories available)",
  ].join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      reasoning: { effort: "low" },
      instructions: instruction,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "Extract the purchased component lines from this invoice." }, filePart],
        },
      ],
      text: { format: { type: "json_schema", name: "invoice", strict: true, schema: SCHEMA } },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI extraction failed (${res.status}). ${body.slice(0, 200)}`);
  }

  const text = await readSseText(res.body);
  let parsed: InvoiceExtractResult;
  try {
    parsed = JSON.parse(text) as InvoiceExtractResult;
  } catch {
    throw new Error("Could not read that invoice — try a clearer PDF or image");
  }

  const validIds = new Set(labels.map((l) => l.id));
  const lines = (parsed.lines ?? [])
    .filter((l) => (l?.mpn ?? "").trim())
    .map((l) => ({
      mpn: String(l.mpn).trim().slice(0, 120),
      manufacturer: l.manufacturer?.trim() || null,
      description: l.description?.trim() || null,
      quantity: Number.isFinite(l.quantity) && l.quantity > 0 ? Math.round(l.quantity) : 1,
      unit_price: typeof l.unit_price === "number" && l.unit_price >= 0 ? l.unit_price : null,
      category_id: l.category_id && validIds.has(l.category_id) ? l.category_id : null,
      package: l.package?.trim() || null,
    }));

  return {
    vendor_name: parsed.vendor_name?.trim() || null,
    invoice_number: parsed.invoice_number?.trim() || null,
    invoice_date: normalizeDate(parsed.invoice_date),
    currency: parsed.currency?.trim().toUpperCase().slice(0, 8) || null,
    lines,
  };
}

function normalizeDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = String(v).match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function readSseText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  let completed = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as any;
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") out += evt.delta;
          if (evt.type === "response.completed" && typeof evt.response?.output_text === "string") {
            completed = evt.response.output_text;
          }
        } catch {
          /* ignore keep-alives */
        }
      }
    }
  }
  return (out || completed).trim();
}
