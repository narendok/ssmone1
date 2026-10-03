# Document generation increment — 2026-10-03

This increment is source implementation; live document generation remains disabled.

Implemented source-only:
- Server-loaded project/department mapping for project code, name, revision and department, replacing caller-supplied values in the gated action.
- Persistence authorization before receipt lookup/replay; request-key validation; original and cleanup failures retained together.
- Concrete storage upload/compensation adapter: UTF-8 bytes/checksum, per-attempt immutable path, no overwrite, atomic DB bridge callback, scoped cleanup and uncertain-outcome retention.
- Concrete server-only database bridge that maps the pending authorization, receipt lookup, atomic commit, and proven-unreferenced cleanup RPCs into the storage adapter. It does not accept browser-provided document content, source fields, or template identity.

The server bridge is implemented against an unapplied RPC contract. The pending SQL proposal now contains the full atomic insert body: immutable template-revision pinning, canonical server render/checksum verification, locked target ancestry, server document numbering, FILE/revision/DRAFT-register/activity/receipt writes, and actor/project/target/template-bound replay. It remains unapplied and the mutation gate remains disabled.

The proposal also includes an executable isolated-environment acceptance fixture at `supabase/pending/tests/lifecycle_document_draft_acceptance.sql`. It exercises create, replay, conflict, scoped receipt disclosure, and cleanup refusal; a two-session runner is still required for genuine concurrent-call proof.

The process template table has no document-body or immutable source revision binding. The gated action no longer accepts template body or fields from the browser. A reviewed mapping to governed template content/revision plus isolated DB/storage and approved-identity acceptance are still required.

Current renderer supports plain text only. This does not implement DOCX/XLSX/PDF materialization or client feedback/notifications.

No migration, data changes, RLS changes, backend enablement or production deployment are included. Generated route files and dependency-install lock changes are not part of this increment.

Verification: 46 focused unit tests across 7 files cover rendering, authorization-before-replay, rollback/compensation, concurrent-replay cleanup, and the pending-RPC bridge shape. Database acceptance remains unavailable until an isolated database, isolated storage bucket, and approved manager/out-of-scope non-admin identities are supplied.
