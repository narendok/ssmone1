# Mobile backend gap remediation

## Scope
Remediate only the documented Mobile Stage 5 procurement/stores backend gaps with additive changes. Preserve all current Phase 1–10 records, identifiers, web behavior, RLS, numbering, storage, and audit history. No Web Phase 11, Android work, separate backend, environment provisioning, or webhook-dispatch work.

## Confirmed baseline
- `create_grn` is already a server-controlled, security-definer transaction and locks the purchase order; it has no request-key retry contract and does not lock the individual PO lines before checking/updating them.
- Stock adjustment, R&D kit issue, and kit return currently update quantities and write history through multiple client requests, so they are not atomic or retry-safe.
- No dedicated material issue, material return, stock transfer, or stock-adjustment transaction records/RPCs exist.
- Storekeeper/quality users can currently read complete PO, PO-line, and vendor records through RLS, including commercial fields such as costs, totals, tax, payment terms, and bank details.
- Several controlled database functions and private storage definitions exist live but are not represented in the checked migration history.

## Implementation
1. **Reconcile controlled backend definitions**
   - Add reviewed, non-destructive migration coverage for the existing Phase 6 helper functions, Final GRN implementation, and private storage buckets/policies after comparing each captured definition to the live backend.
   - Do not alter historical migrations, rebuild the backend, or change existing records.

2. **Create a shared critical-transaction foundation**
   - Add an idempotency request registry with transaction type, opaque request UUID, actor, lifecycle state, result reference, and unique key enforcement.
   - Add document-number rules for Issue, Return, Transfer, and Adjustment, preserving server-controlled identifiers.
   - Add narrowly scoped stock-operation permissions and assign only the existing appropriate operational roles.

3. **Harden Final GRN**
   - Extend the existing server-side GRN contract with an opaque request key while retaining legacy web compatibility through a controlled server wrapper.
   - Return the original result for an exact retry; reject a reused key with a different payload.
   - Lock the PO and affected PO-item rows in the same transaction, validate status/short-close/outstanding quantity, and perform receipt, lots, ledger, and PO status updates together.
   - Keep final GRN online-only and server-numbered.

4. **Add controlled stock-posting contracts**
   - Add additive transaction records for material issues, returns, transfers, and adjustments with request keys, official numbers, references, actor, status, and audit metadata.
   - Add one server-side atomic contract per operation. Each will authorize the user, lock affected location/lot/reservation rows, validate quality/quarantine and quantity rules, post the document and ledger, update balances/reservations, and roll back completely on failure.
   - Support partial returns and prevent over-return. Keep stock transfer balance-neutral. Require a reason for adjustments.
   - Retire the existing web screens’ direct stock mutations in favor of these server actions without changing their workflows.

5. **Verify RTV stock behavior**
   - Trace the existing RTV approval/dispatched states against lot/location stock. If dispatch is currently a record-only workflow, document it as such rather than introducing a new physical stock effect.
   - If a physical removal is already required by the live model, route it through the same controlled transaction pattern with retry and audit protection.

6. **Isolate commercial data and define mobile reads**
   - Replace non-procurement base-table access to vendors, POs, and PO lines with narrowly scoped operational projections containing only receiving/stores fields.
   - Preserve procurement and finance access to commercial source tables; operational read contracts exclude price, totals, tax, payment terms, banking details, and finance-only data.
   - Document the approved mobile read contracts for purchase requests/RFQs, operational PO/shipment/vendor details, receiving drafts, inventory/quality state, and cache-safe vs online-authoritative fields.

7. **Validate and refresh handoff deliverables**
   - Add transaction tests for success, rollback, duplicate retry, concurrent conflict, insufficient/quarantined stock, and authorization denial across GRN/issue/return/transfer/adjustment; add RTV verification coverage where applicable.
   - Add real session-scoped RLS acceptance tests for store, procurement, finance, and unauthorized users, including commercial-field denial and safe projection access.
   - Refresh generated database types from the updated backend, update all five handoff artifacts, recalculate Mobile Stages 1–5A–5G individually, and write the requested remediation report with verified/not-verified evidence.
   - Run schema validation, focused RLS/transaction tests, the existing test suite, type check, and production build; then stop for review.

## Technical details
```text
Android/mobile client
  -> authenticated server action
  -> permission + state validation
  -> idempotency registry (unique request key)
  -> locked DB transaction
     -> transaction record + server number
     -> location / lot / reservation updates
     -> stock history + activity audit
  -> stable result returned on retry
```

The mobile app will never receive privileged credentials or directly perform authoritative multi-table stock updates.
