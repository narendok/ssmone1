# Add selected BOM lines to inventory stock

## Outcome

From the matched BOM results, staff can tick one, several, or all BOM lines and add those parts to stock in one review step.

## Experience

- Add a checkbox column to the matched-results table, with a select-all checkbox for the current BOM lines.
- Show an action only after at least one line is selected: **Add selected to stock**.
- Open a review dialog prefilled from the selected BOM lines:
  - reuse the matched inventory item when one exists;
  - create a new item from the BOM part details when no inventory match exists;
  - allow changing the quantity, category for new parts, and shared storage area/location;
  - keep the active project selected when the BOM was opened from a project.
- Confirming records the received quantities, links the items to the project when applicable, refreshes the stock totals, and reports any individual line that could not be saved.
- Selection clears when a new file is imported, pasted, or re-matched so lines from different BOMs cannot be mixed.

## Technical details

- Reuse the existing protected `applyInvoiceImport` server action for controlled component creation, location updates, stock-history entries, and project linking; extend its user-facing wording or add a thin BOM-specific entry point only if the current invoice-oriented metadata would be misleading.
- Extract or adapt the existing review UI used by Smart purchase import so BOM-selected lines use the same validation and location controls without uploading an invoice.
- Keep BOM matching, substitute picking, project saving, and shortage-to-purchase-order behavior unchanged.
- Add focused tests for selected-line conversion and validation, then verify the importer at desktop and mobile widths.
