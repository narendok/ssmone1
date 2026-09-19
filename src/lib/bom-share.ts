import * as XLSX from "xlsx";
import { stockStatus } from "@/lib/inventory";
import type { SubstituteRef } from "@/lib/substitutes";

export interface ShareablePart {
  id: string;
  name: string;
  part_number: string;
  manufacturer: string | null;
  footprint?: string | null;
  package_case?: string | null;
  low_stock_threshold: number;
  total_quantity: number;
  supplier_url?: string | null;
  datasheet_url?: string | null;
  category_name?: string | null;
}

export type ShareRow = Record<string, string | number>;

export function formatSubstitute(s: SubstituteRef): string {
  const status = stockStatus(s.total_quantity, s.low_stock_threshold).replace(/_/g, " ");
  const base = `${s.part_number} — ${s.manufacturer ?? "unknown mfr"} (qty ${s.total_quantity}, ${status})`;
  return s.note ? `${base} — ${s.note}` : base;
}

/** One row per selected component, substitutes joined into a single cell. */
export function shareRows(
  parts: ShareablePart[],
  substituteMap: Map<string, SubstituteRef[]>,
): ShareRow[] {
  return parts.map((p) => {
    const subs = substituteMap.get(p.id) ?? [];
    const inStock = subs.filter((s) => stockStatus(s.total_quantity, s.low_stock_threshold) !== "out_of_stock");
    return {
      "Part number": p.part_number,
      Name: p.name,
      Manufacturer: p.manufacturer ?? "",
      Footprint: p.footprint ?? p.package_case ?? "",
      Category: p.category_name ?? "",
      "On hand": p.total_quantity,
      "Stock status": stockStatus(p.total_quantity, p.low_stock_threshold).replace(/_/g, " "),
      Substitutes: subs.map(formatSubstitute).join("; "),
      "Substitutes in stock": `${inStock.length}/${subs.length}`,
      "Supplier URL": p.supplier_url ?? "",
      "Datasheet URL": p.datasheet_url ?? "",
    };
  });
}

export function rowsToMarkdown(rows: ShareRow[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${headers.map((h) => esc(r[h])).join(" | ")} |`),
  ].join("\n");
}

/** XLSX with a bold header row, frozen top row and sized columns. */
export function downloadShareXlsx(rows: ShareRow[], filename: string, sheetName = "Components") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(60, Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? "").length + 2))),
  }));
  headers.forEach((_, i) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[ref]) ws[ref].s = { font: { bold: true } };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([out], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface SharedBomSnapshot {
  title: string;
  created_at: string;
  rows: ShareRow[];
}
