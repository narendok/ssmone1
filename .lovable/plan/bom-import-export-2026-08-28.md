# BOM Import / Export

A new **BOM** page where you upload a BOM file (CSV or Excel), see every line item matched against your stock, and get suggested substitutes for lines that have no exact part in inventory.

## Import flow

1. Upload `.csv`, `.xlsx` or `.xls`, or paste CSV text.
2. Column mapping step: the app guesses which columns are MPN, manufacturer, quantity, reference designators, description, and footprint; you can correct any guess in dropdowns before continuing.
3. Matching runs for each line and produces one of:
   - **Exact** — part number matches a stocked component (case/whitespace insensitive, ignoring distributor prefixes like `511-`).
   - **Close** — same manufacturer + normalized MPN, or MPN differs only by packaging suffix (`-T`, `+T`, `/TR`, reel codes).
   - **Substitute** — no direct match, but a linked substitute of a close part, or a same-footprint/same-value part, is in stock. Ranked by availability first.
   - **Missing** — nothing in inventory.
4. Results table shows per line: reference designators, MPN, qty needed, matched component, on-hand qty, shortage, status badge, and a picker to override the match (search any component, or pick from suggested substitutes).
5. Actions from the results screen:
   - **Save substitute links** — for lines resolved through a suggested substitute, write the two-way link into the existing substitutes system so future BOMs match instantly.
   - **Export shortage list** — CSV of lines that are short, with quantity to order and supplier links.
   - **Assign to project / reserve** — optional: choose a project and create assignments for matched lines with enough stock (reuses the existing assignment flow and stock history).

## Export flow

From the same page (and from the inventory view's toolbar):
- Export the current inventory or a project's linked components as CSV or Excel, with columns: part number, name, manufacturer, footprint, category, on-hand qty, locations, low-stock threshold, substitutes, supplier URL, datasheet URL.
- Export a matched BOM back out as CSV/Excel including the resolved component, stock, shortage, and substitute used — round-trips into the same importer.

## AI assist for unmatched lines

For lines still **Missing** after rule-based matching, a "Suggest with AI" action sends the MPN, manufacturer and description to the existing Lovable AI resolver and proposes the closest stocked component as a substitute candidate. Suggestions are always confirmed by you before any link is created.

## Technical notes

- Add `xlsx` (SheetJS) for Excel read/write and `papaparse` for CSV parsing. Both run in the browser; no new server dependency.
- New files: `src/lib/bom.ts` (normalization, matching, ranking, export builders), `src/routes/_authenticated/bom.tsx` (page), `src/components/inventory/BomImportDialog.tsx` plus a results table component.
- Matching runs client-side over the components + locations query already used by `InventoryView`, plus the substitute map from `src/lib/substitutes.ts`; no new tables are needed.
- Substitute links created from a BOM are written through the existing `component_substitutes` helpers, with a note recording the BOM filename and date.
- Optional assignment creation reuses the existing `assignments` insert path so stock history stays consistent.
- Sidebar gets a "BOM" entry in `AppSidebar.tsx`; the route gets its own `head()` title and description.
