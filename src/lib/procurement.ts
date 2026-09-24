import { supabase } from "@/integrations/supabase/client";

export type PoStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  payment_terms: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  component_id: string | null;
  mpn: string;
  description: string | null;
  quantity_ordered: number;
  quantity_received: number;
  quantity_rejected: number;
  short_closed: boolean;
  short_close_reason: string | null;
  unit_cost: number;
  total_cost: number;
  component?: { id: string; name: string; part_number: string; manufacturer: string | null } | null;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string | null;
  status: PoStatus;
  total_amount: number;
  tax_amount: number;
  currency: string;
  notes: string | null;
  expected_delivery_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  sent_to: string | null;
  sent_by: string | null;
  vendor?: Vendor | null;
  items?: PurchaseOrderItem[];
}

export interface GoodsReceiptNote {
  id: string;
  grn_number: string;
  po_id: string | null;
  vendor_invoice_number: string;
  vendor_invoice_date: string | null;
  received_by: string | null;
  storage_location_notes: string | null;
  created_at: string;
  po?: { po_number: string; vendor?: { name: string } | null } | null;
  items?: {
    id: string;
    quantity_received: number;
    quantity_rejected: number;
    rejection_reason: string | null;
    rejection_note: string | null;
    lot_number: string | null;
    component?: { name: string; part_number: string } | null;
    location?: { label: string; location_type: string } | null;
  }[];
}

export const GST_RATE = 0.18;

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹ 1,25,000.00 */
export function inr(value: number | null | undefined): string {
  return inrFormatter.format(Number(value ?? 0));
}

export const PO_STATUSES: PoStatus[] = ["DRAFT", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "RECEIVED") return "default";
  if (s === "CANCELLED") return "destructive";
  if (s === "DRAFT") return "outline";
  return "secondary";
}

const sb = supabase as any;

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await sb.from("vendors").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Vendor[];
}

export async function upsertVendor(v: Partial<Vendor> & { name: string }): Promise<void> {
  const payload = {
    name: v.name,
    contact_person: v.contact_person || null,
    email: v.email || null,
    phone: v.phone || null,
    gstin: v.gstin || null,
    address: v.address || null,
    payment_terms: v.payment_terms || "30 Days Net",
    is_active: v.is_active ?? true,
  };
  const { error } = v.id
    ? await sb.from("vendors").update(payload).eq("id", v.id)
    : await sb.from("vendors").insert(payload);
  if (error) throw error;
}

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await sb
    .from("purchase_orders")
    .select("*, vendor:vendors(*), items:purchase_order_items(*, component:components(id,name,part_number,manufacturer))")
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "purchase_order_items", ascending: true });
  if (error) throw error;
  return ((data ?? []) as PurchaseOrder[]).map((po) => ({
    ...po,
    items: [...(po.items ?? [])].sort((a, b) => a.mpn.localeCompare(b.mpn)),
  }));
}

export async function fetchGrns(): Promise<GoodsReceiptNote[]> {
  const { data, error } = await sb
    .from("goods_receipt_notes")
    .select(
      "*, po:purchase_orders(po_number, vendor:vendors(name)), items:goods_receipt_items(id, quantity_received, quantity_rejected, rejection_reason, rejection_note, lot_number, component:components(name,part_number), location:locations(label,location_type))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GoodsReceiptNote[];
}

export interface NewPoLine {
  component_id: string | null;
  mpn: string;
  description: string | null;
  quantity_ordered: number;
  unit_cost: number;
}

export async function createPurchaseOrder(input: {
  vendor_id: string;
  expected_delivery_date: string | null;
  notes: string | null;
  tax_amount: number;
  items: NewPoLine[];
}): Promise<{ po_id: string; po_number: string; total_amount: number }> {
  const { data, error } = await sb.rpc("create_purchase_order", {
    _vendor_id: input.vendor_id,
    _expected_delivery_date: input.expected_delivery_date,
    _notes: input.notes,
    _tax_amount: input.tax_amount,
    _items: input.items,
  });
  if (error) throw error;
  return data as { po_id: string; po_number: string; total_amount: number };
}

export interface NewGrnLine {
  po_item_id: string;
  component_id: string;
  location_id: string | null;
  location_type?: string;
  location_label?: string;
  quantity: number;
  quantity_rejected?: number;
  rejection_reason?: string | null;
  rejection_note?: string | null;
  lot_number?: string | null;
}

export const REJECTION_REASONS = [
  "Damaged in transit",
  "Wrong part supplied",
  "Failed incoming test",
  "Short quantity",
  "Other",
] as const;

export async function createGrn(input: {
  po_id: string;
  vendor_invoice_number: string;
  vendor_invoice_date: string | null;
  storage_notes: string | null;
  items: NewGrnLine[];
  idempotency_key: string;
}): Promise<{ grn_id: string; grn_number: string; total_quantity: number; total_rejected: number; po_status: string }> {
  const { data, error } = await sb.rpc("create_grn", {
    _po_id: input.po_id,
    _vendor_invoice_number: input.vendor_invoice_number,
    _vendor_invoice_date: input.vendor_invoice_date,
    _storage_notes: input.storage_notes,
    _items: input.items,
    _idempotency_key: input.idempotency_key,
  });
  if (error) throw error;
  return data as { grn_id: string; grn_number: string; total_quantity: number; total_rejected: number; po_status: string };
}

export async function setPoStatus(id: string, status: PoStatus): Promise<void> {
  const { error } = await sb.from("purchase_orders").update({ status }).eq("id", id);
  if (error) throw error;
}

export interface SearchablePart {
  id: string;
  name: string;
  part_number: string;
  manufacturer: string | null;
  cost: number | null;
  total_quantity: number;
  locations: { id: string; label: string; location_type: string; quantity: number }[];
}

export async function fetchSearchableParts(): Promise<SearchablePart[]> {
  const { data, error } = await sb
    .from("components")
    .select("id,name,part_number,manufacturer,cost,locations(id,label,location_type,quantity)")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as any[]).map((c) => ({
    ...c,
    locations: c.locations ?? [],
    total_quantity: (c.locations ?? []).reduce((s: number, l: any) => s + (l.quantity ?? 0), 0),
  })) as SearchablePart[];
}

export function isOverdue(po: PurchaseOrder): boolean {
  if (!po.expected_delivery_date) return false;
  if (po.status === "RECEIVED" || po.status === "CANCELLED") return false;
  return new Date(po.expected_delivery_date) < new Date(new Date().toDateString());
}

/** Units still owed by the vendor on a line (short-closed lines owe nothing). */
export function pendingQty(item: PurchaseOrderItem): number {
  if (item.short_closed) return 0;
  return Math.max(0, item.quantity_ordered - item.quantity_received);
}

export function poPendingQty(po: PurchaseOrder): number {
  return (po.items ?? []).reduce((s, i) => s + pendingQty(i), 0);
}

export function poReceivedPct(po: PurchaseOrder): number {
  const ordered = (po.items ?? []).reduce((s, i) => s + i.quantity_ordered, 0);
  if (!ordered) return 0;
  const done = (po.items ?? []).reduce((s, i) => s + Math.min(i.quantity_ordered, i.quantity_received + (i.short_closed ? i.quantity_ordered - i.quantity_received : 0)), 0);
  return Math.round((done / ordered) * 100);
}

export async function markPoSent(poId: string, address: string): Promise<void> {
  const { error } = await sb.rpc("mark_po_sent", { _po_id: poId, _address: address });
  if (error) throw error;
}

export async function shortClosePoItem(itemId: string, reason: string, undo = false): Promise<void> {
  const { error } = await sb.rpc("short_close_po_item", { _item_id: itemId, _reason: reason, _undo: undo });
  if (error) throw error;
}

/** Quick-adds a stockable part for a PO line that isn't linked to inventory yet. */
export async function quickCreateComponentForPoItem(input: {
  po_item_id: string;
  mpn: string;
  name: string;
  manufacturer: string | null;
  category_id: string | null;
  cost: number | null;
  needs_review: boolean;
}): Promise<string> {
  let categoryId = input.category_id;
  if (!categoryId) {
    const { data: cats } = await sb.from("categories").select("id,slug").order("sort_order");
    const list = (cats ?? []) as { id: string; slug: string }[];
    categoryId = (list.find((c) => /^uncategorized$/i.test(c.slug)) ?? list[0])?.id ?? null;
  }
  if (!categoryId) throw new Error("No category available — create one first");

  const { data, error } = await sb
    .from("components")
    .insert({
      category_id: categoryId,
      name: input.name || input.mpn,
      part_number: input.mpn,
      manufacturer: input.manufacturer,
      value: input.name || input.mpn,
      cost: input.cost,
      low_stock_threshold: 0,
      needs_review: input.needs_review,
    })
    .select("id")
    .single();
  if (error) throw error;

  const componentId = (data as { id: string }).id;
  const { error: linkError } = await sb
    .from("purchase_order_items")
    .update({ component_id: componentId })
    .eq("id", input.po_item_id);
  if (linkError) throw linkError;
  return componentId;
}

export interface PendingLine {
  po: PurchaseOrder;
  item: PurchaseOrderItem;
  pending: number;
  overdue: boolean;
}

export function pendingLines(orders: PurchaseOrder[]): PendingLine[] {
  const out: PendingLine[] = [];
  for (const po of orders) {
    if (po.status === "CANCELLED" || po.status === "DRAFT") continue;
    for (const item of po.items ?? []) {
      const pending = pendingQty(item);
      if (pending <= 0) continue;
      out.push({ po, item, pending, overdue: isOverdue(po) });
    }
  }
  return out.sort((a, b) => {
    const da = a.po.expected_delivery_date ?? "9999-12-31";
    const db = b.po.expected_delivery_date ?? "9999-12-31";
    return da.localeCompare(db);
  });
}

export interface RejectedLine {
  grn: GoodsReceiptNote;
  item: NonNullable<GoodsReceiptNote["items"]>[number];
}

export function rejectedLines(grns: GoodsReceiptNote[]): RejectedLine[] {
  const out: RejectedLine[] = [];
  for (const grn of grns) {
    for (const item of grn.items ?? []) {
      if ((item.quantity_rejected ?? 0) > 0) out.push({ grn, item });
    }
  }
  return out;
}
