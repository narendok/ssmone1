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
- Drive categories are department-owned templates: common categories belong under the department standards branch, project categories are provisioned only for new internal/client projects, and Platform Owners manage templates through the settings page.
- Controlled-document decisions use the protected, replay-safe transition action and remain linked to the existing register and Drive revision history; no client-side status mutation or duplicate register is allowed.
- Engineering BOM records may reference an authoritative project Drive file and its revision; preserve that source link instead of copying the authoritative file.
- Present shared product-lifecycle status as a read-only composition of governed records; lifecycle screens must not infer approvals, ownership, releases, or external publication.
- Keep lifecycle draft planning as a pure read-only derivation; template materialization, feedback revisions, task creation, and notifications require separately reviewed server-side contracts.
- Lifecycle contracts must authorize before replay, bind receipts and generated records to immutable actor/template provenance, reject duplicate source-stage regeneration, and serialize all project dependency graph writes.
