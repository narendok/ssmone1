# Template editor and verified-actor transport — 2026-10-04

## Implemented source

Lifecycle Settings now opens a plain-text template-body editor with the four
supported placeholders, validation and a clearly labeled local sample preview.
It does not infer stored content from a template description. Stored-revision
loading, append-only saving, activation of the exact unchanged saved revision,
and retirement call concrete protected handlers. Save success requires a real
validated receipt; no placeholder ID or simulated successful save is returned.

The authenticated handlers now invoke the existing content adapter and composed
document-generation workflow. A server-only transport takes its actor solely
from verified authentication middleware context. It exposes an allowlist of
pending RPC operations and storage, not unrestricted administrator table reads.
Caller-token reads retain their existing RLS context.

The separate **unapplied** SQL proposal
`supabase/pending/20261004_lifecycle_document_actor_transport.sql` executes only
for the trusted server role. It rejects missing/extra arguments and unlisted
operations, supplies the verified actor to existing business permission checks,
and restores request-local claims and transition context on success or failure.
It does not grant authenticated/anonymous execution or introduce browser secrets.

## Verification

- TypeScript: exit 0.
- Full source suite: 198 tests in 27 files pass.
- Disposable embedded PostgreSQL suite: 18 tests pass, including actual database
  role EXECUTE denials, stored actor provenance, scope rejection, context
  restoration and storage-attempt registration through the proposed transport.
- Production build: exit 0.
- Built browser JavaScript contains neither `SUPABASE_SERVICE_ROLE_KEY` nor
  `execute_lifecycle_document_action` identifiers.
- Git diff whitespace check: clean.

Handler unit tests verify the acceptance gate runs before privileged client
construction and before pending-schema reads. PostgreSQL permission predicates
are deliberately limited fixtures. Neither suite proves real HTTP/JWT, Supabase
RLS, Storage policy/compensation or two-session concurrent acceptance. Browser
interaction testing could not run because its runtime failed before connection
with a Windows asset-path error.

## Live status and remaining work

The mutation gate and client availability remain disabled. Local preview works
in source; backend saving, revision reads and activation remain unavailable to
live users. No SQL was deployed, production data changed or live generation
enabled. Source publication is distinct from Lovable deployment.

Full acceptance still requires an authoritative initial application schema,
isolated database/storage, and approved scoped manager/out-of-scope identities.
The repository's migration history starts by modifying pre-existing tables and
does not establish an empty-database baseline. Do not invent one or weaken RLS.

Automatic project-create/change generation triggers, template-version creation
and cloning, additional requirement-field mapping, DOCX/XLSX/PDF generation,
and persisted-result verification on web and Android remain unfinished. The
current document renderer generates plain text. This checkpoint updates source
wiring; it does not claim a complete live template feature or application.
