# Project architecture rules

- Keep mobile operational data access on security-invoker projection views and use an Administrator-only security-invoker seed for controlled acceptance data; this preserves caller RLS and prevents commercial-data exposure.
- Generate BOM document numbers only inside the protected server save action through the privileged client; the general numbering function remains unavailable to browser callers.
- Keep inventory CSV approval behind a protected server action that invokes the single audited database transaction per selected row; parsing and review remain client-side only.
- Inventory CSV and invoice approvals create an AVAILABLE inventory-lot record in the same authorized transaction as the location and ledger update, so Stores inventory shows received quantities immediately.
- Inventory posting actions must return persisted component, location, final location quantity, lot, and stock-event identifiers; retries reuse that stored result rather than posting stock again.
- Historical zero-stock recovery is Administrator-only and requires an explicit verified quantity, bin, and source note before it can reuse the protected inventory posting transaction.
- Regular component Add/Edit saves use the protected server save action for every non-zero stock change, so bin quantities cannot bypass stock audits or authorization.
- Reuse the R&D member dialog for R&D-specific contacts; project membership remains employee-based so no workflow creates duplicate identities.
