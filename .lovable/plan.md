# Repair zero-stock import postings

## Confirmed evidence
- The five named components exist, but each has zero `locations`, `stock_history`, and `inventory_lots` rows.
- The live protected approval function now atomically creates/matches a component, updates a location, records a stock event, creates an available lot, and stores an idempotent result.
- The corrective migration that adds visible lot creation is present in source but absent from the applied migration history. The currently live routine body nevertheless contains the lot, location, and audit logic.
- No matching idempotency requests or activity-log payloads remain for the five components, so their approved quantities and locations cannot be reconstructed safely from the database.

## Work
1. Add a forward-only database migration that reasserts the authoritative protected approval transaction, with deterministic component/location locking and a persisted result containing component, location, final location quantity, added quantity, lot, and audit identifiers.
2. Keep both Inventory CSV and Smart purchase import server actions routed exclusively through that transaction. Return the persisted per-line location and quantity result to their review screens, including retry responses.
3. Add targeted regression coverage for the transaction contract: a successful approval produces exactly one positive location balance, one stock-history event, one available lot, and a retry with the same key does not add stock again.
4. Add an Administrator-only repair action that accepts an explicit component, positive quantity, and location only when supplied from a verified source record; it will use the same protected transaction and never write stock directly.
5. Do not auto-backfill the five historical components: their source quantity/location evidence is absent from the database. Report them unchanged and provide the repair action for a reviewed re-entry once their source document details are supplied.

## Validation
- Apply the migration and query the protected transaction result.
- Run focused inventory/import tests, type checks, and the production build.
- Verify a retry returns the original persisted location and final quantity without creating another stock event or lot.

## Technical details
- No direct client writes to `components`, `locations`, `stock_history`, or `inventory_lots`.
- The server remains the only caller with access to the protected database function; users remain permission-checked inside the transaction.
- The repair action will not infer or fabricate the five historical quantities, bins, dates, vendors, or audit details.
