# SSM ONE — MOBILE BACKEND GAP REMEDIATION REPORT

**Date:** 2026-09-26 UTC  
**Scope:** additive Mobile Stage 5 procurement and stores hardening only.

## Implemented controls

- Final GRN remains one server-side transaction and now accepts an opaque UUID request key.
- A canonical payload fingerprint binds every request key. Exact retries return the stored result; conflicting key reuse fails.
- PO, PO-item, location, and stock rows are locked before validation and mutation. Multi-row locks use stable ID ordering.
- Material issue, return, transfer, and adjustment now use numbered, permission-checked, atomic posting contracts.
- Web R&D issue, return, and stock-adjustment journeys use the controlled posting contracts while retaining their existing screens.
- Receiving-safe security-invoker projections exclude unit prices, totals, tax, margins, payment terms, bank details, and finance-only fields. PR/RFQ/shipment/vendor safe projections now also exclude commercial, contact, invoice-path, and tracking-payload fields.
- An Administrator-only, idempotent `seed_mobile_stage5_test_data()` helper prepares minimal clearly labelled `TEST-MOB-*` acceptance records without altering existing operational data.
- Android remains restricted to an authenticated user session and client-safe configuration; authoritative stock posting is online-only.

## Verification status

| Mobile Stage | Status | Evidence |
|---|---|---|
| 5A | READY | Idempotent, server-controlled GRN with PO and line locking. |
| 5B | READY | Atomic material issue posting. |
| 5C | READY | Atomic material return posting with over-return prevention. |
| 5D | READY | Atomic balance-neutral stock transfer. |
| 5E | READY | Atomic reason-required stock adjustment. |
| 5F | READY | Least-privilege operational receiving plus PR/RFQ/shipment/vendor projections; controlled Administrator-only acceptance seed available. |
| 5G | BLOCKED | Dedicated live-session RLS and concurrent transaction acceptance tests require approved test identities/environment support. |

## Remaining documented boundaries

- RTV dispatch is still record-only; no unverified physical stock mutation was introduced.
- Older controlled backend definitions and storage policies still need separate migration-history reconciliation.
- No Web Phase 11 work, Android implementation, environment provisioning, or outbound webhook work was started.