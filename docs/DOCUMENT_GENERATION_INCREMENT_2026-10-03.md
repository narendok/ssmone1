# Document generation increment — 2026-10-03

This increment is source implementation; live document generation remains disabled.

Implemented source-only:
- Server-loaded project/department mapping for project code, name, revision and department, replacing caller-supplied values in the gated action.
- Persistence authorization before receipt lookup/replay; request-key validation; original and cleanup failures retained together.
- Concrete storage upload/compensation adapter: UTF-8 bytes/checksum, per-attempt immutable path, no overwrite, server-owned attempt registration immediately after confirmed upload, atomic DB bridge callback, scoped cleanup and uncertain-outcome retention.
- Concrete server-only database bridge that maps the pending authorization, receipt lookup, atomic commit, and proven-unreferenced cleanup RPCs into the storage adapter. It does not accept browser-provided document content, source fields, or template identity.

The server bridge is implemented against an unapplied RPC contract. The pending SQL proposal now contains the full atomic insert body: caller-pinned immutable template revision, canonical server render/checksum/source-fingerprint verification, locked-and-revalidated target ancestry, independently scoped business numbering, FILE/revision/DRAFT-register/activity/receipt writes, staged-object ownership receipts, and semantic actor/project/target/template-bound replay. It remains unapplied and the mutation gate remains disabled.

The proposal also includes an executable isolated-environment acceptance fixture at `supabase/pending/tests/lifecycle_document_draft_acceptance.sql` and a two-session runner at `supabase/pending/tests/lifecycle_document_draft_concurrency.sh`. They cover registered upload attempts, create, semantic replay, request-key conflict, application-level outsider denial without aborting cleanup, rollback, and concurrent replay convergence.

The process template table has no document-body or immutable source revision binding. The gated action no longer accepts template body or fields from the browser. A reviewed mapping to governed template content/revision plus isolated DB/storage and approved-identity acceptance are still required.

Current renderer supports plain text only. This does not implement DOCX/XLSX/PDF materialization or client feedback/notifications.

No migration, data changes, RLS changes, backend enablement or production deployment are included. Generated route files and dependency-install lock changes are not part of this increment.

Integration gaps explicitly retained: the template-management screen remains read-only; the source-only proposal now defines service-only immutable content revision, activation, and retirement routines, but no live action is wired. The preflight now server-loads the pinned immutable revision, target folder, canonical project fields, rendered bytes, and matching source fingerprint. Database acceptance remains unavailable until an isolated database, isolated storage bucket, actual staged objects, and approved manager/out-of-scope non-admin identities are supplied.

Independent review update (2026-10-03):
- Corrected pending SQL rendering to validate the original template and substitute each original token once. Braces and backslashes in inserted project values remain literal.
- Corrected invalid references to ancestry CTEs after their statement ends. Ancestry validation now aggregates within the CTE statement, stops at the project root, and rejects newly encountered unlocked ancestors after locking.
- Full source unit suite: 167 tests across 22 files pass. These tests do not execute PostgreSQL; the SQL changes remain unverified against a database.
- Lovable follow-up paused with an out-of-credits message; no new follow-up commit was fetched.
- Still missing: live acceptance of the protected service route preserving authenticated actor context; a reviewed route/UI for immutable template-content management; and full isolated database, storage, rollback, concurrency, and non-admin RLS acceptance. The live action remains disabled.
- An isolated database/storage environment with approved manager and out-of-scope identities is required for SQL/RLS/storage acceptance. No production SQL was applied.

Follow-up local source implementation:
- Added service-only pending storage-attempt registration RPC with actor-derived authorization, exact metadata binding, object existence check and idempotent provenance validation.
- Wired adapter registration after successful upload and before commit; invalid registration receipts fail closed. Uncertain upload/registration retains the object unless exact cleanup is proven.
- Added registration denial/receipt-validation coverage. Full unit suite now passes 172 tests in 22 files.
- Registration, server-owned preflight/render loading, and source-only governed template-content SQL are implemented. They remain unapplied/unwired. The privileged actor-context route is not yet verified; do not enable generation.
