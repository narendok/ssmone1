# Inventory CSV review and approval

## Outcome

Inventory CSV files are parsed into an editable review list and only approved rows change stock.

## Experience

- Accept flexible inventory headers for part details, quantities, locations, categories, thresholds, statuses, substitutes, and source links.
- Show mapping confidence and row warnings before approval.
- Let administrators edit every operational value, select valid rows individually or together, and approve them in one action.

## Technical details

- Keep BOM import and matching unchanged.
- Send approved rows through a protected server action that invokes the existing audited, idempotent database transaction once per row.
- Add focused parser, mapping, duplicate, and validation tests.
