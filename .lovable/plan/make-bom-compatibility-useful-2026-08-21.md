# Make BOM compatibility useful

Today "BOM compatibility" is a free-text box on the component form and nothing reads it. Turn it into real, linked substitute parts you can act on.

## What you get

- **Link real substitutes.** On a component, pick one or more other components in your inventory as compatible alternatives (drop-in replacements). Links are two-way: adding B as a substitute for A also shows A on B.
- **Optional note per link** (e.g. "same footprint, 10% tolerance difference").
- **Substitutes column in the inventory table.** A small badge showing how many substitutes exist; hovering lists them with their current stock and status.
- **Out-of-stock rescue.** When a part is low or out of stock, the row shows "N substitutes in stock" so you immediately know what to use instead.
- **Free-text kept.** External cross-reference text (parts you don't stock) stays available in the same section, so nothing you typed is lost.

## How it works

- New table `public.component_substitutes` (component_id, substitute_id, note, created_at, created_by), unique on the pair, with a check preventing self-links; RLS + GRANTs matching the existing components tables (authenticated read/write).
- Symmetry handled by querying both directions rather than storing duplicate rows.
- `src/components/inventory/ComponentFormDialog.tsx`: replace the plain BOM compatibility input with a "Compatible / substitute parts" section — searchable component picker, chip list of linked parts with remove, plus the existing free-text field relabelled "External cross-reference".
- `src/components/inventory/InventoryView.tsx`: fetch a substitute map alongside the existing project map, add a Substitutes column with tooltip listing each substitute's name, part number, quantity and stock status.
- `src/lib/inventory.ts`: add types and fetch helpers for substitute links.

No existing data is deleted; `bom_compatibility` remains as the external cross-reference field.
