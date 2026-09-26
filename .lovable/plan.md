# Repair stock addition

## Confirmed issue
The regular **Add component** and edit screen saves location quantities directly. Those writes are now blocked by the inventory security rules, and the screen discards the error then reports success. The protected CSV/import posting transaction is working separately.

## Plan
1. Move regular component creation and initial stock into a protected, idempotent server-authorized posting action.
   - Create or update component details safely.
   - Create or match the selected bin/location.
   - Add the requested quantity atomically.
   - Create an inventory lot and matching stock-history audit entry.
   - Return the saved location and final quantity to the screen.
2. Update the Add/Edit component screen to use this protected action for every quantity change rather than writing locations directly.
   - Keep adding, renaming, and removing empty locations available where permitted.
   - Require a reason when a saved location quantity changes, so the audit trail is meaningful.
   - Surface any save failure instead of reporting a false success.
3. Reuse the existing protected stock-adjustment route for changes to an existing location, preserving retry protection and authorization.
4. Add regression coverage for a normal component save with initial stock and for an existing-location quantity adjustment. Each test will require a persisted location quantity and exactly one audit event.
5. Validate the repair with focused tests, type checks, production build, and a database-level verification of the protected transaction result.

## Technical details
- No stock quantity will be written directly from the browser.
- Existing permissions remain enforced: only authorized inventory/procurement staff and administrators can post stock.
- No existing stock records will be altered or backfilled by this repair.
