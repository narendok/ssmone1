# Simplify component form: merge Value→Name and Package→Footprint

## Goal

Reduce duplicate inputs in the Add/Edit component dialog:

- **Value field removed** — the component name is stored as the value too (single field).
- **Package / Case field removed** — "Footprint reference" becomes the single packaging input.

No database schema changes; both `value` and `package_case` columns stay, just populated from the remaining fields.

## Changes

### 1. `src/components/inventory/ComponentFormDialog.tsx`

- Remove the `value` input Field (line 236). Drop `value` from local `form` state initializer and the edit-mode `setForm` hydration, OR keep the key but always derive it from `name`.
- On `handleSave`: set `value: form.name` so the DB `value` column mirrors the name (keeps the existing "Value" column in the inventory table and search-by-value working).
- Remove the "Package / Case" input Field (line 237). Keep the "Footprint reference" Field.
- On `handleSave`: set `package_case: form.footprint` so the downstream Package column/filter/locations view still populate from the single footprint input.
- In `handleLookup` (supplier lookup): set `footprint` (not `package_case`) from `p.package`; keep `package_case` mirroring via the save step above. Remove the `package_case` line from the lookup setForm.

### 2. No downstream code changes required

- `InventoryView.tsx` Value column (line 328) and Package column (line 329), package filter (line 111/134), and search-by-value (line 154) continue to work because the columns are still populated (value=name, package_case=footprint).
- `locations.tsx` package_case display (line 169) continues to work.
- these or similar table columns can be enable to disable from settings 

## Verification

- Open Add component from a category page: confirm no Value or Package fields, only Footprint reference.
- Save a new component: confirm inventory table shows Value = name and Package = footprint value.
- Edit an existing component with old package_case data: confirm footprint field shows it (loaded from footprint, or if footprint was empty, package_case preserved).
- Typecheck passes.