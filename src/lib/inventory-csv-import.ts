import { baseMpn, normalizeMpn, type StockPart } from "@/lib/bom";

export interface InventoryCsvMapping {
  partNumber: string;
  name: string;
  manufacturer: string;
  footprint: string;
  category: string;
  quantity: string;
  location: string;
  lowStockThreshold: string;
  stockStatus: string;
  substitutes: string;
  supplierUrl: string;
  datasheetUrl: string;
}

export type MappingConfidence = "high" | "low" | "none";

export interface InventoryDraftRow {
  key: number;
  partNumber: string;
  name: string;
  manufacturer: string;
  footprint: string;
  categoryId: string | null;
  quantity: number;
  locationType: string;
  locationLabel: string;
  lowStockThreshold: number;
  stockStatus: string;
  substitutes: string;
  supplierUrl: string;
  datasheetUrl: string;
  existingComponentId: string | null;
  matchLabel: string | null;
  warnings: string[];
}

export interface CategoryChoice {
  id: string;
  label: string;
}

const aliases: Record<keyof InventoryCsvMapping, string[]> = {
  partNumber: ["part number", "part no", "partnumber", "mpn", "stock number", "stock no", "stocknumber"],
  name: ["name", "description", "part description", "component name"],
  manufacturer: ["manufacturer", "mfr", "mfg", "brand", "maker"],
  footprint: ["footprint", "package", "package case", "case"],
  category: ["category", "part category", "group"],
  quantity: ["on hand", "onhand", "quantity", "qty", "stock qty", "stock quantity"],
  location: ["locations", "location", "bin", "store", "storage location"],
  lowStockThreshold: ["low stock threshold", "minimum qty", "minimum quantity", "min qty", "reorder level"],
  stockStatus: ["stock status", "status"],
  substitutes: ["substitutes", "substitute", "alternates", "alternate"],
  supplierUrl: ["supplier url", "supplier link", "vendor url", "source url"],
  datasheetUrl: ["datasheet url", "datasheet", "data sheet url", "data sheet"],
};

function canonical(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function guessInventoryMapping(headers: string[]): { mapping: InventoryCsvMapping; confidence: Record<keyof InventoryCsvMapping, MappingConfidence> } {
  const mapping = {} as InventoryCsvMapping;
  const confidence = {} as Record<keyof InventoryCsvMapping, MappingConfidence>;
  (Object.keys(aliases) as (keyof InventoryCsvMapping)[]).forEach((field) => {
    const exact = aliases[field].find((alias) => headers.some((header) => canonical(header) === alias));
    const exactHeader = exact ? headers.find((header) => canonical(header) === exact) : undefined;
    const partialHeader = !exactHeader
      ? headers.find((header) => aliases[field].some((alias) => canonical(header).includes(alias) || alias.includes(canonical(header))))
      : undefined;
    mapping[field] = exactHeader ?? partialHeader ?? "";
    confidence[field] = exactHeader ? "high" : partialHeader ? "low" : "none";
  });
  return { mapping, confidence };
}

function positiveInteger(value: string): number | null {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function nonNegativeInteger(value: string): number | null {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function categoryFor(value: string, categories: CategoryChoice[]) {
  const needle = canonical(value);
  if (!needle) return { id: null, ambiguous: false };
  const matches = categories.filter((category) => {
    const label = canonical(category.label);
    const leaf = label.split(" ").at(-1) ?? label;
    return label === needle || leaf === needle;
  });
  return { id: matches.length === 1 ? matches[0].id : null, ambiguous: matches.length > 1 };
}

function locationFor(raw: string) {
  const value = raw.trim();
  if (!value) return { type: "bin", label: "" };
  const separator = value.match(/^\s*(basement|lab|rack|drawer|bin|shelf|store)\s*[:\-]\s*(.+)$/i);
  return separator ? { type: separator[1].toLowerCase(), label: separator[2].trim() } : { type: "bin", label: value };
}

export function toInventoryDraftRows(
  rows: Record<string, string>[],
  mapping: InventoryCsvMapping,
  parts: StockPart[],
  categories: CategoryChoice[],
): InventoryDraftRow[] {
  const partMap = new Map<string, StockPart[]>();
  parts.forEach((part) => {
    const key = normalizeMpn(part.part_number);
    const list = partMap.get(key) ?? [];
    list.push(part);
    partMap.set(key, list);
    const base = baseMpn(part.part_number);
    if (base && base !== key) partMap.set(base, [...(partMap.get(base) ?? []), part]);
  });
  const seen = new Set<string>();
  return refreshInventoryDraftWarnings(rows.map((row, index) => {
    const read = (field: keyof InventoryCsvMapping) => (mapping[field] ? row[mapping[field]] ?? "" : "").trim();
    const partNumber = read("partNumber");
    const name = read("name");
    const quantityRaw = read("quantity");
    const quantity = positiveInteger(quantityRaw);
    const location = locationFor(read("location"));
    const category = categoryFor(read("category"), categories);
    const normalized = normalizeMpn(partNumber);
    const matches = normalized ? (partMap.get(normalized) ?? partMap.get(baseMpn(partNumber)) ?? []) : [];
    const warnings: string[] = [];
    if (partNumber && seen.has(normalized)) warnings.push("Duplicate part number in this file");
    if (partNumber) seen.add(normalized);
    if (matches.length > 1) warnings.push("More than one existing component matches this part number");
    if (category.ambiguous) warnings.push("Category mapping is ambiguous; choose one");
    if (read("category") && !category.id && !category.ambiguous) warnings.push("Category was not found; an uncategorized fallback will be used");
    return {
      key: index,
      partNumber,
      name,
      manufacturer: read("manufacturer"),
      footprint: read("footprint"),
      categoryId: category.id,
      quantity: quantity ?? 0,
      locationType: location.type,
      locationLabel: location.label,
      lowStockThreshold: nonNegativeInteger(read("lowStockThreshold")) ?? 0,
      stockStatus: read("stockStatus"),
      substitutes: read("substitutes"),
      supplierUrl: read("supplierUrl"),
      datasheetUrl: read("datasheetUrl"),
      existingComponentId: matches.length === 1 ? matches[0].id : null,
      matchLabel: matches.length === 1 ? matches[0].part_number : null,
      warnings,
    };
  }).filter((row) => Object.values(row).some((value) => typeof value === "string" && value.trim())));
}

export function isInventoryDraftValid(row: InventoryDraftRow) {
  return Boolean(row.partNumber.trim() && row.name.trim() && row.quantity > 0 && row.locationType.trim() && row.locationLabel.trim() && row.lowStockThreshold >= 0 && row.warnings.length === 0);
}

export function refreshInventoryDraftWarnings(rows: InventoryDraftRow[]) {
  const occurrences = new Map<string, number>();
  rows.forEach((row) => {
    const partNumber = normalizeMpn(row.partNumber);
    if (partNumber) occurrences.set(partNumber, (occurrences.get(partNumber) ?? 0) + 1);
  });
  return rows.map((row) => {
    const retained = row.warnings.filter((warning) => ![
      "Part number is required", "Name or description is required", "A positive on-hand quantity is required", "Location or bin is required", "Duplicate part number in this file",
    ].includes(warning));
    if (!row.partNumber.trim()) retained.push("Part number is required");
    if (!row.name.trim()) retained.push("Name or description is required");
    if (row.quantity <= 0) retained.push("A positive on-hand quantity is required");
    if (!row.locationLabel.trim()) retained.push("Location or bin is required");
    if (row.partNumber.trim() && (occurrences.get(normalizeMpn(row.partNumber)) ?? 0) > 1) retained.push("Duplicate part number in this file");
    return { ...row, warnings: retained };
  });
}