# Project architecture rules

- Keep mobile operational data access on security-invoker projection views and use an Administrator-only security-invoker seed for controlled acceptance data; this preserves caller RLS and prevents commercial-data exposure.
- Generate BOM document numbers only inside the protected server save action through the privileged client; the general numbering function remains unavailable to browser callers.
- Keep inventory CSV approval behind a protected server action that invokes the single audited database transaction per selected row; parsing and review remain client-side only.
- Inventory CSV/invoice approvals atomically create AVAILABLE lots with ledger/location updates; posting returns persisted IDs and retries reuse that result.
- Historical zero-stock recovery is Administrator-only and needs verified quantity, bin, and source note.
- Regular component Add/Edit saves use the protected server save action for every non-zero stock change, so bin quantities cannot bypass stock audits or authorization.
- Regular component Add/Edit saves manage empty-location creation, renaming, and removal only through the protected `manage_component_location` action; direct authenticated writes to locations remain revoked.
- Component-form changes reuse per-location request keys; server actions verify every manual adjustment actor.
- Reuse the R&D member dialog for R&D-specific contacts; project membership remains employee-based so no workflow creates duplicate identities.
- Department workspaces are read-only RLS queues; approvals stay in established workflows and priorities remain department-scoped with admin oversight.
- Department projects provision their controlled Drive hierarchy by trigger; regular users cannot invoke it.
