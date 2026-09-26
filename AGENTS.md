# Project architecture rules

- Keep mobile operational data access on security-invoker projection views and use an Administrator-only security-invoker seed for controlled acceptance data; this preserves caller RLS and prevents commercial-data exposure.
- Generate BOM document numbers only inside the protected server save action through the privileged client; the general numbering function remains unavailable to browser callers.
- Keep inventory CSV approval behind a protected server action that invokes the single audited database transaction per selected row; parsing and review remain client-side only.
- Inventory CSV and invoice approvals create an AVAILABLE inventory-lot record in the same authorized transaction as the location and ledger update, so Stores inventory shows received quantities immediately.
