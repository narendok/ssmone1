# Document generation increment — 2026-10-03

This increment is source implementation; live document generation remains disabled.

Implemented:
- Server-loaded project/department mapping for project code, name, revision and department, replacing caller-supplied values in the gated action.
- Persistence authorization before receipt lookup/replay; request-key validation; original and cleanup failures retained together.
- Concrete Supabase Storage upload/compensation adapter: UTF-8 bytes/checksum, per-attempt immutable path, no overwrite, atomic DB bridge callback, scoped cleanup and uncertain-outcome retention.

The DB bridge is an interface, not an implemented/deployed RPC. It must atomically reauthorize, save Drive node and revision, controlled DRAFT register, official numbering, audit, immutable receipt and concurrent replay. The existing pending SQL outline is not deployment-ready.

The process template table has no document-body or immutable source revision binding. The existing gated action still accepts template body input for source-only validation; that is not an authoritative document source and must not be enabled. A reviewed mapping to governed template content/revision plus isolated DB/storage and approved-identity acceptance are still required.

Current renderer supports plain text only. This does not implement DOCX/XLSX/PDF materialization or client feedback/notifications.

No migration, data changes, RLS changes, backend enablement or production deployment are included. Generated route files and dependency-install lock changes are not part of this increment.

Verification: 153 tests passed across 21 files; TypeScript check and Vite/Nitro production build passed.
