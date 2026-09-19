# Remove Value column from inventory views

## Goal
The Value field was merged into the component name, so the now-redundant Value display should be removed from the main inventory table and the locations page.

## Changes

### 1. `src/components/inventory/InventoryView.tsx`
- Remove the `<TableHead>Value</TableHead>` header (line 300).
- Remove the `<TableCell>{r.value ?? "—"}</TableCell>` cell (line 328).
- Update the `colSpan={10}` placeholders (loading + empty-state rows) to `colSpan={9}` to match the new column count.
- Leave the search-by-value term (line 154) as-is — harmless and keeps search matching legacy data.

### 2. `src/routes/_authenticated/locations.tsx`
- Remove the inline ` · {value}` suffix shown under the component name (line 164), so value no longer appears anywhere on the locations page.

## Verification
- Open the main inventory page: confirm the table no longer has a Value column (9 columns: Component, Part #, Manufacturer, Package, Qty, Locations, Projects, Status, Actions).
- Open the Locations page: confirm component rows no longer show the value suffix.
- Typecheck passes.
