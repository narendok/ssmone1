# Document generation increment — 2026-10-03

Latest follow-on: [2026-10-04 editor and actor transport checkpoint](evidence/LIFECYCLE_ACTOR_EDITOR_CHECKPOINT_2026-10-04.md).
198 source tests, 18 focused embedded PostgreSQL tests, TypeScript and production
build pass. This does not establish full isolated Supabase acceptance or live save.

The concrete save/activate/retire and generation handlers, server-only actor
transport proposal, and local template-body editor are now wired in source.
The earlier entries below are historical checkpoints. Their statements that
these components are unwired are superseded by the latest source evidence;
deployment, automatic project/change triggers and full acceptance remain open.

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

Codex independent integration review:
- Transported the Lovable f49b8de patch via Code editor; SHA-256 18699ccd8de5fec31d865f65a2d3ceddf5a5abc96588141db5c728ec8ade0dc8 matched the export. Lovable internal remote was not the GitHub repository.
- Preserved existing fail-closed receipt/commit validation, definitive outcome checks, registration proof and scoped cleanup after the imported patch regressed those checks. Adapted receipt input and pinned revision signatures to the new preflight.
- Preserved fixed ancestry CTE scope/root termination/lock verification and object-existence registration. Corrected psql interpolation inside dollar-quoted acceptance blocks using session settings.
- Independent verification: 177 tests in 23 files, TypeScript and production build pass. SQL and two-session scripts remain unexecuted; no isolated DB/storage/approved identities are available.
- Server-owned preflight source/fingerprint now exists. Template management remains a gated facade and unapplied RPC proposal with disabled UI controls. Real template-management persistence, route integration, automatic project/change triggers, live generation and mobile acceptance remain incomplete. No production migration or gate enablement was performed.

### Local adapter/workflow increment — 2026-10-03

- Added lifecycle-template-content.server.ts: concrete pending RPC calls for append-only content revision, pinned activation and retirement; invalid, ambiguous, wrong-template and missing-checksum receipts fail closed. No live route invokes this adapter.
- Added lifecycle-document-workflow.server.ts: composes caller-authorized preflight, the database bridge, immutable storage staging and protected persistence. A route must first supply an accepted actor-preserving transaction client; denied acceptance stops before pending table reads/upload. No credentials or automatic deployment flag were introduced.
- Fixed invalid FOR UPDATE on the template-revision aggregate; the already locked parent template serializes append operations.
- Full source suite: 188 tests in 25 files passed. These unit tests do not execute pending SQL or establish backend authorization acceptance.
- Remaining blocking integration: a verified privileged execution route retaining the signed-in actor; isolated database/storage with approved scoped test identities; deployment acceptance for SQL, storage compensation, concurrent replay and template lifecycle. UI save and automatic project/change generation remain disabled/unwired. No production migration was applied.
- TypeScript and production build completed with exit code 0. User confirmed there is no separate test/staging project; isolated database acceptance is therefore unavailable at this checkpoint.

### Live enablement access audit — 2026-10-03

User explicitly authorized completing and enabling template save/automatic generation. This authorization does not replace the required isolated acceptance evidence.

Verified blockers:
- Current tools expose local shell/Git but no Lovable browser or Supabase deployment capability.
- No Docker, PostgreSQL psql, or Supabase CLI was located in PATH. No database/Supabase deployment environment variable names were present (no credential values were printed).
- User previously confirmed no separate test/staging Supabase project exists.
- Existing src/integrations/supabase/client.server.ts creates a service-role client without retaining the signed-in user's token/identity. public.lifecycle_actor() reads auth.uid() and rejects a null actor. A service-role key alone cannot satisfy the actor-preserving execution requirement; replacing its bearer token with the user's token also cannot confer service-only RPC execution.

Do not enable the gate or claim live save until a reviewed server-only authenticated actor transport and isolated SQL/storage/RLS acceptance are available. Source tests at 054c792 remain 188 passing; they were not rerun in this read-only audit. No backend migration, role/credential change, production data mutation, or publication was performed.
