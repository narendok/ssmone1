import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { SubstituteRef } from "@/lib/substitutes";
import { stockStatus } from "@/lib/inventory";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

export interface BomMapping {
  mpn: string;
  manufacturer: string;
  quantity: string;
  refs: string;
  value: string;
  description: string;
  footprint: string;
  remark: string;
  unitCost: string;
  totalCost: string;
}

export interface BomLine {
  index: number;
  mpn: string;
  manufacturer: string;
  quantity: number;
  refs: string;
  value: string;
  description: string;
  footprint: string;
  remark: string;
  unitCost: number | null;
  totalCost: number | null;
}

export interface StockPart {
  id: string;
  name: string;
  part_number: string;
  manufacturer: string | null;
  footprint: string | null;
  package_case: string | null;
  value: string | null;
  supplier_url: string | null;
  datasheet_url: string | null;
  low_stock_threshold: number;
  total_quantity: number;
  category_name?: string | null;
  locations?: { location_type: string; label: string; quantity: number }[];
}

export type MatchKind = "exact" | "close" | "substitute" | "missing";

export interface BomMatch {
  line: BomLine;
  kind: MatchKind;
  /** component chosen to fulfil the line */
  part: StockPart | null;
  /** the part the BOM actually asked for, when fulfilled via a substitute */
  viaFor: StockPart | null;
  /** other candidates the user can switch to */
  candidates: StockPart[];
  shortage: number;
}

/* ------------------------------------------------------------------ parsing */

export async function parseBomFile(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsvText(await file.text());
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: "" });
  return fromAoa(aoa.map((r) => r.map((c) => (c == null ? "" : String(c)))));
}

export function parseCsvText(text: string): ParsedSheet {
  const res = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  return fromAoa((res.data ?? []).map((r) => r.map((c) => (c == null ? "" : String(c)))));
}

function fromAoa(aoa: string[][]): ParsedSheet {
  if (!aoa.length) return { headers: [], rows: [] };
  // Header row = first row with 2+ non-empty cells
  let hi = aoa.findIndex((r) => r.filter((c) => c.trim()).length >= 2);
  if (hi < 0) hi = 0;
  const headers = aoa[hi].map((h, i) => (h.trim() ? h.trim() : `Column ${i + 1}`));
  const rows: Record<string, string>[] = [];
  for (const raw of aoa.slice(hi + 1)) {
    if (!raw.some((c) => c.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (raw[i] ?? "").trim()));
    rows.push(row);
  }
  return { headers, rows };
}

const GUESS: Record<keyof BomMapping, string[]> = {
  mpn: ["manufacturer part number", "manufacturer part", "mfr part number", "mfr part", "mfg part", "part number", "part no", "partnumber", "mpn", "part", "orderable"],
  manufacturer: ["manufacturer", "mfr", "mfg", "brand", "maker"],
  quantity: ["quantity", "qty", "count", "amount", "pcs"],
  refs: ["reference designators", "reference designator", "designators", "designator", "refdes", "reference", "refs", "ref"],
  value: ["comment value", "component value", "value", "comment"],
  description: ["description", "desc", "component description"],
  footprint: ["footprint", "package case", "package", "case", "pattern"],
  remark: ["remarks", "remark", "notes", "note"],
  unitCost: ["unit cost", "unit price", "price each", "unitcost"],
  totalCost: ["total cost", "extended cost", "line total", "total price", "totalcost"],
};

export function guessMapping(headers: string[]): BomMapping {
  const canonical = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const hit = headers.find((h) => canonical(h) === k);
      if (hit) return hit;
    }
    for (const k of keys) {
      const hit = headers.find((h) => canonical(h).includes(k));
      if (hit) return hit;
    }
    return "";
  };
  return {
    mpn: pick(GUESS.mpn),
    manufacturer: pick(GUESS.manufacturer),
    quantity: pick(GUESS.quantity),
    refs: pick(GUESS.refs),
    value: pick(GUESS.value),
    description: pick(GUESS.description),
    footprint: pick(GUESS.footprint),
    remark: pick(GUESS.remark),
    unitCost: pick(GUESS.unitCost),
    totalCost: pick(GUESS.totalCost),
  };
}

/** Sample importable BOM template — headers match the auto-guessed mapping. */
export function sampleTemplateRows(): Record<string, unknown>[] {
  return [
    {
      "Comment(value)": "10k 1%",
      "Manufacturer-Part-Number": "RC0603FR-0710KL",
      Manufacturer: "Yageo",
      Description: "Resistor 10k 1% 0603",
      Designator: "R1, R2, R7",
      Footprint: "0603",
      Quantity: 3,
      Remark: "Preferred production part",
      "Unit-Cost": 0.08,
      "Total-Cost": 0.24,
    },
    {
      "Comment(value)": "100nF 50V X7R",
      "Manufacturer-Part-Number": "GRM188R71H104KA93D",
      Manufacturer: "Murata",
      Description: "Ceramic capacitor 100nF 50V X7R",
      Designator: "C1, C4",
      Footprint: "0603",
      Quantity: 2,
      Remark: "",
      "Unit-Cost": 0.12,
      "Total-Cost": 0.24,
    },
    {
      "Comment(value)": "STM32G0B1",
      "Manufacturer-Part-Number": "STM32G0B1KET6",
      Manufacturer: "STMicroelectronics",
      Description: "MCU ARM Cortex-M0+ 32-LQFP",
      Designator: "U1",
      Footprint: "LQFP-32",
      Quantity: 1,
      Remark: "Program before assembly",
      "Unit-Cost": 3.85,
      "Total-Cost": 3.85,
    },
    {
      "Comment(value)": "1N4148W",
      "Manufacturer-Part-Number": "1N4148W-7-F",
      Manufacturer: "Diodes Incorporated",
      Description: "Diode 100V 150mA",
      Designator: "D1",
      Footprint: "SOD-123",
      Quantity: 1,
      Remark: "",
      "Unit-Cost": 0.06,
      "Total-Cost": 0.06,
    },
  ];
}

export function toLines(rows: Record<string, string>[], m: BomMapping): BomLine[] {
  const out: BomLine[] = [];
  rows.forEach((r, i) => {
    const mpn = (m.mpn ? r[m.mpn] : "") ?? "";
    const refs = (m.refs ? r[m.refs] : "") ?? "";
    const value = (m.value ? r[m.value] : "") ?? "";
    const description = (m.description ? r[m.description] : "") ?? "";
    if (!mpn.trim() && !description.trim() && !value.trim()) return;
    const qtyRaw = (m.quantity ? r[m.quantity] : "") ?? "";
    const qty = Number(String(qtyRaw).replace(/[^\d.\-]/g, ""));
    out.push({
      index: i + 1,
      mpn: mpn.trim(),
      manufacturer: ((m.manufacturer ? r[m.manufacturer] : "") ?? "").trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : refs ? refs.split(/[,;]/).filter(Boolean).length || 1 : 1,
      refs: refs.trim(),
      value: value.trim(),
      description: description.trim(),
      footprint: ((m.footprint ? r[m.footprint] : "") ?? "").trim(),
      remark: ((m.remark ? r[m.remark] : "") ?? "").trim(),
      unitCost: parseCost((m.unitCost ? r[m.unitCost] : "") ?? ""),
      totalCost: parseCost((m.totalCost ? r[m.totalCost] : "") ?? ""),
    });
  });
  return out;
}

export function parseCost(raw: unknown): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const cleaned = String(raw).trim().replace(/[^\d,.-]/g, "").replace(/,/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function calculatedLineCost(line: BomLine): number | null {
  return line.unitCost == null ? null : Math.round(line.quantity * line.unitCost * 100) / 100;
}

export function hasTotalCostMismatch(line: BomLine): boolean {
  const calculated = calculatedLineCost(line);
  return line.totalCost != null && calculated != null && Math.abs(line.totalCost - calculated) >= 0.01;
}

/* ----------------------------------------------------------------- matching */

/** Uppercase, strip distributor prefixes (511-…), punctuation and whitespace. */
export function normalizeMpn(raw: string): string {
  let s = (raw ?? "").toUpperCase().trim();
  s = s.replace(/^\d{2,4}-(?=[A-Z0-9])/, "");
  return s.replace(/[^A-Z0-9]/g, "");
}

/** Drop common packaging / reel / tape suffixes for fuzzy comparison. */
export function baseMpn(raw: string): string {
  let s = normalizeMpn(raw);
  // strip repeatedly: REEL7, TR, T, CT, TA, ND, RL13, CUT, TAPE, 7INCH …
  for (let i = 0; i < 3; i++) {
    const next = s.replace(/(REEL\d*|TAPE\d*|TR\d*|RL\d*|CT\d*|DKR|TA|EA|ND|CUT|T\d*)$/, "");
    if (next === s || next.length < 4) break;
    s = next;
  }
  return s;
}

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

export function matchBom(
  lines: BomLine[],
  parts: StockPart[],
  substituteMap: Map<string, SubstituteRef[]>
): BomMatch[] {
  const byExact = new Map<string, StockPart[]>();
  const byBase = new Map<string, StockPart[]>();
  const push = (map: Map<string, StockPart[]>, key: string, p: StockPart) => {
    if (!key) return;
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  };
  for (const p of parts) {
    push(byExact, normalizeMpn(p.part_number), p);
    push(byBase, baseMpn(p.part_number), p);
  }
  const byId = new Map(parts.map((p) => [p.id, p]));

  return lines.map((line) => {
    const exactKey = normalizeMpn(line.mpn);
    const baseKey = baseMpn(line.mpn);
    const exact = (byExact.get(exactKey) ?? []).filter(Boolean);
    const close = (byBase.get(baseKey) ?? []).filter((p) => !exact.includes(p));

    const direct = pickBest(exact) ?? pickBest(close);
    const kindDirect: MatchKind | null = pickBest(exact) ? "exact" : direct ? "close" : null;

    if (direct && direct.total_quantity >= line.quantity) {
      return build(line, kindDirect!, direct, null, dedupe([...exact, ...close]));
    }

    // Direct match exists but is short (or no direct match) → look for substitutes
    const subCandidates: StockPart[] = [];
    const seeds = direct ? [direct] : [...exact, ...close];
    for (const seed of seeds) {
      for (const s of substituteMap.get(seed.id) ?? []) {
        const p = byId.get(s.id);
        if (p && !subCandidates.some((c) => c.id === p.id)) subCandidates.push(p);
      }
    }
    // Fallback heuristic: same footprint + same description/value, in stock
    if (!subCandidates.length && (line.footprint || line.description)) {
      for (const p of parts) {
        if (p.total_quantity <= 0) continue;
        const fpOk =
          !!line.footprint &&
          (norm(p.footprint) === norm(line.footprint) || norm(p.package_case) === norm(line.footprint));
        const valOk =
          !!line.description &&
          (norm(p.value) === norm(line.value || line.description) || norm(p.name) === norm(line.description || line.value));
        if (fpOk && valOk) subCandidates.push(p);
      }
    }
    const sub = pickBest(subCandidates.filter((p) => p.total_quantity >= line.quantity)) ?? pickBest(subCandidates);

    if (direct) {
      // keep the direct (short) match if no substitute fully covers it
      if (sub && sub.total_quantity >= line.quantity) {
        return build(line, "substitute", sub, direct, dedupe([...exact, ...close, ...subCandidates]));
      }
      return build(line, kindDirect!, direct, null, dedupe([...exact, ...close, ...subCandidates]));
    }
    if (sub) return build(line, "substitute", sub, null, dedupe(subCandidates));
    return build(line, "missing", null, null, []);
  });
}

function dedupe(list: StockPart[]) {
  const out: StockPart[] = [];
  for (const p of list) if (p && !out.some((o) => o.id === p.id)) out.push(p);
  return out;
}

function pickBest(list: StockPart[]): StockPart | null {
  if (!list.length) return null;
  return [...list].sort((a, b) => b.total_quantity - a.total_quantity)[0];
}

function build(
  line: BomLine,
  kind: MatchKind,
  part: StockPart | null,
  viaFor: StockPart | null,
  candidates: StockPart[]
): BomMatch {
  return {
    line,
    kind,
    part,
    viaFor,
    candidates,
    shortage: Math.max(0, line.quantity - (part?.total_quantity ?? 0)),
  };
}

/* ------------------------------------------------------------------ exports */

export function matchesToRows(matches: BomMatch[]) {
  return matches.map((m) => ({
    "Ref designators": m.line.refs,
    "Comment(value)": m.line.value,
    MPN: m.line.mpn,
    Manufacturer: m.line.manufacturer,
    Description: m.line.description,
    Footprint: m.line.footprint,
    "Qty needed": m.line.quantity,
    Remark: m.line.remark,
    "Unit-Cost": m.line.unitCost ?? "",
    "Supplied Total-Cost": m.line.totalCost ?? "",
    "Calculated Total-Cost": calculatedLineCost(m.line) ?? "",
    "Cost check": hasTotalCostMismatch(m.line) ? "Mismatch" : "OK",
    Status: m.kind,
    "Matched part": m.part?.part_number ?? "",
    "Matched name": m.part?.name ?? "",
    "Substitute for": m.viaFor?.part_number ?? "",
    "On hand": m.part?.total_quantity ?? 0,
    Shortage: m.shortage,
    "Stock status": m.part ? stockStatus(m.part.total_quantity, m.part.low_stock_threshold).replace(/_/g, " ") : "",
    "Supplier URL": m.part?.supplier_url ?? "",
    "Datasheet URL": m.part?.datasheet_url ?? "",
  }));
}

export function shortageRows(matches: BomMatch[]) {
  return matches
    .filter((m) => m.shortage > 0 || m.kind === "missing")
    .map((m) => ({
      "Ref designators": m.line.refs,
      MPN: m.line.mpn,
      Manufacturer: m.line.manufacturer,
      Description: m.line.description,
      "Comment(value)": m.line.value,
      "Qty needed": m.line.quantity,
      Remark: m.line.remark,
      "Unit-Cost": m.line.unitCost ?? "",
      "Supplied Total-Cost": m.line.totalCost ?? "",
      "Calculated Total-Cost": calculatedLineCost(m.line) ?? "",
      "On hand": m.part?.total_quantity ?? 0,
      "Qty to order": m.kind === "missing" ? m.line.quantity : m.shortage,
      "Matched part": m.part?.part_number ?? "",
      "Supplier URL": m.part?.supplier_url ?? "",
    }));
}

export function inventoryRows(parts: StockPart[], substituteMap: Map<string, SubstituteRef[]>) {
  return parts.map((p) => ({
    "Part number": p.part_number,
    Name: p.name,
    Manufacturer: p.manufacturer ?? "",
    Footprint: p.footprint ?? p.package_case ?? "",
    Category: p.category_name ?? "",
    "On hand": p.total_quantity,
    Locations: (p.locations ?? []).map((l) => `${l.location_type}:${l.label}=${l.quantity}`).join("; "),
    "Low stock threshold": p.low_stock_threshold,
    "Stock status": stockStatus(p.total_quantity, p.low_stock_threshold).replace(/_/g, " "),
    Substitutes: (substituteMap.get(p.id) ?? []).map((s) => s.part_number).join("; "),
    "Supplier URL": p.supplier_url ?? "",
    "Datasheet URL": p.datasheet_url ?? "",
  }));
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows);
}

export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  const csv = toCsv(rows);
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function downloadXlsx(rows: Record<string, unknown>[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  triggerDownload(new Blob([out], { type: "application/octet-stream" }), filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
