# Procurement & Purchase Management

Adds vendors, purchase orders and goods receipt (inwarding) to PartsBench, with receiving that automatically raises stock and writes an audit trail.

## What you get

**Purchase Orders** (`/procurement/orders`)
- Summary cards: open POs, pending inwarding, total ordered value (₹), overdue deliveries.
- One filter row: search by PO number or vendor, status filter, date range.
- Create PO dialog: pick a vendor (or add one inline), expected delivery date, then search parts by part number/name. Selecting a part fills MPN, current cost and on-hand quantity; you set quantity and confirm unit price. Subtotal, optional 18% GST and total update live. PO number is generated as PO-2026-0001.
- PO detail view: status badge, "Mark as sent", "Download PO PDF" (print layout with vendor address, line items, totals, signatory line), and "Receive shipment (GRN)".
- On the BOM page, a "Generate PO from shortages" button collects every missing/short line and opens the create dialog pre-filled.

**Inwarding / GRN** (`/procurement/inward`)
- New GRN dialog: pick a PO that is sent or partially received, enter vendor invoice number and date, then per line see ordered / already received and enter today's received quantity, target storage location and optional lot number.
- On submit, in one atomic database operation: the GRN and its lines are saved, the PO lines' received counts increase, the chosen storage location's quantity increases, an audit row is written, and the PO flips to partially received or fully received.
- Success toast names the quantity and location, e.g. "Stock updated. 500 units added to Basement Store 11 - Rack B3".

**Vendors** (`/procurement/vendors`)
- Table of name, contact, phone, email, GSTIN, payment terms and active PO count, with an add/edit dialog and active/inactive toggle.

**Navigation** — a new "Procurement" group in the sidebar with Purchase Orders, Inwarding (GRN) and Vendors.

All money is shown in Indian format (₹ 1,25,000.00) and everything uses the existing theme and components.

## Adjustments to your spec (existing schema)

- `stock_history` has no `change_type`/`reference` columns; it uses `action`, `delta`, `note`. Inward rows will be `action = 'inward_purchase'`, `note = 'GRN-2026-0001 (PO-2026-0001)'`, with the component, location and quantity delta.
- `locations` rows belong to a single component (`component_id`, `location_type`, `label`, `quantity`). The GRN location picker therefore lists that component's existing locations and offers "new location" (e.g. type `basement`, label `Store 11 - Rack B3`), creating the row when it doesn't exist yet.
- Blanket `GRANT ALL ON ALL TABLES` is unsafe here; each new table gets explicit grants matched to its policies.

## Technical notes

- Migration: `app_role` enum gains `purchase` and `storekeeper`; new tables `vendors`, `purchase_orders`, `purchase_order_items`, `goods_receipt_notes`, `goods_receipt_items` as specified, plus `updated_at` triggers, explicit GRANTs to `authenticated`/`service_role`, RLS enabled.
- Access rules: any signed-in user can read procurement data; writes to vendors/POs require `admin` or `purchase`; GRN writes require `admin`, `purchase` or `storekeeper` — all via the existing `has_role` function.
- PO/GRN numbering and the GRN stock sync run in `SECURITY DEFINER` Postgres functions (`create_grn(...)`, `next_document_number(...)`) so numbering is race-free and receiving is one transaction covering GRN insert, PO item updates, location increment, `stock_history` insert and PO status recalculation.
- New code: `src/lib/procurement.ts` (types, queries, ₹ formatter), `src/lib/procurement.functions.ts` (server fns using `requireSupabaseAuth` for GRN submit and PO creation), routes `src/routes/_authenticated/procurement.orders.tsx`, `procurement.inward.tsx`, `procurement.vendors.tsx`, and components `CreatePODialog.tsx`, `PODetailView.tsx`, `CreateGRNDialog.tsx`, `VendorDialog.tsx` under `src/components/procurement/`.
- PO PDF uses a print-styled HTML view via `window.print()` (no new dependency).
- Each route gets its own head metadata; sidebar gets the Procurement group.
