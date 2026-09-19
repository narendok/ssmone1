# Support the standard project BOM header

Update project BOM import so this usual Altium-style header maps correctly without manual correction:

`Comment(value) | Manufacturer-Part-Number | Manufacturer | Description | Designator | Footprint | Quantity | Remark | Unit-Cost | Total-Cost`

## Import and mapping

- Recognize the exact headings above, plus common spacing, hyphen, underscore, and abbreviation variants.
- Match `Manufacturer-Part-Number` to MPN before considering the separate `Manufacturer` column, preventing the current ambiguous match.
- Map `Comment(value)` as the component value/comment, `Designator` as reference designators, and `Quantity` as project-required quantity—not stock on hand.
- Add mapping selectors for Remark, Unit Cost, and Total Cost so unusual files can still be corrected manually.
- Parse currency symbols, grouping separators, and decimal values safely. Blank or invalid costs remain empty rather than becoming zero.

## Results and downstream use

- Carry remark, unit cost, and supplied total cost through each imported BOM line.
- Show remark and cost information in the matched-results table without changing stock matching rules.
- Calculate the expected total as `Quantity × Unit Cost`; flag a supplied Total-Cost only when it differs after currency rounding.
- Use the imported unit cost when generating a purchase order for shortages instead of defaulting every line to zero.
- Preserve the original BOM quantity for costing while the generated PO quantity remains the shortage quantity.

## Templates and exports

- Change the downloadable sample CSV/Excel template to use this standard header and include example remarks and costs.
- Include Comment(value), Remark, Unit-Cost, supplied Total-Cost, and calculated Total-Cost in matched and shortage CSV/Excel exports so the file round-trips cleanly.

## Validation

- Add focused tests for exact header detection, Manufacturer versus Manufacturer-Part-Number, numeric/currency cost parsing, total-cost comparison, and PO shortage cost carry-through.
- Verify the BOM page with the standard header on desktop and mobile-sized layouts, and confirm the project quantity, stock on hand, shortage, remarks, and costs remain distinct.

## Technical notes

- Extend the existing `BomMapping` and `BomLine` shapes and export builders; no database change is required because imported BOM lines remain part of the current project import session.
- Keep matching based on MPN, manufacturer, footprint, description/value, and substitutes; remarks and costs provide context but do not alter compatibility matching.
