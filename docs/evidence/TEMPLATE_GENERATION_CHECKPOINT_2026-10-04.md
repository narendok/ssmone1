# Template generation checkpoint — 2026-10-04

## Delivered source changes

The pending document activation contract now stores the exact approved content
revision on its process-template version. A composite foreign key prevents a
revision belonging to another template from being bound. Server preflight,
authorization and commit require that exact active revision. Existing ACTIVE
process templates without a document binding remain ineligible; no historical
body is inferred or modified.

Activation and retirement reuse the existing protected process-template
transition routines, preserving their stage checks and transition trigger.
Malformed/unsupported placeholders cannot be activated. The actual append SQL
now qualifies its template ID lookup to avoid a PL/pgSQL output-variable
ambiguity. Source content keeps its whitespace, and the adapter verifies that a
revision receipt checksum matches the submitted UTF-8 bytes.

The isolated acceptance SQL now records a storage attempt before the generated
metadata transaction, matching separate upload-registration and commit RPCs.
Its rollback therefore retains the provenance needed to prove exact cleanup.
The full isolated acceptance script has **not** been executed.

## Verification completed

- TypeScript check: exit 0.
- Source unit suite: 191 passing tests in 25 files.
- Disposable embedded PostgreSQL suite: 11 passing tests, executing actual
  repository template routines and the existing transition trigger.
- Production web build: exit 0.
- Added a GitHub Actions workflow for repeatable focused SQL regression checks.
  Its remote result is reported separately after the source push.

The PostgreSQL suite uses fixture dependency tables and permission predicates;
it is not full Supabase RLS/Storage/actor-transport or concurrent acceptance.
No production data, roles, migrations, credentials or feature gates were changed.

## Remaining work before live enablement

1. Provide a reviewed privileged execution boundary that retains the verified
   signed-in actor while calling the service-only routines. The existing admin
   client alone has no actor context.
2. Obtain an authoritative initial schema export and isolated Supabase/database
   storage fixtures. The 90 Supabase migration files start by changing existing
   tables, not by creating the full original application schema. The earlier
   Drizzle foundation also depends on pre-existing auth/role helpers; do not
   invent a permissive baseline to claim acceptance.
3. Execute full authorization, rollback, upload compensation, replay/concurrency,
   audit/numbering and non-admin RLS acceptance against that environment.
4. Wire the actual template editor/save and automatic project/change generation
   actions, then deploy accepted contracts and verify persisted Drive documents
   in both web and Android. The present UI and façades remain gated/unwired.

The document renderer currently produces plain text only. DOCX/XLSX/PDF template
generation and additional requirement-field mappings are not implemented.

## Access checks

Git fetch verified local main equals GitHub main at b0714a2 before this increment.
The lovable-sync history was already merged; it being behind main required no
further merge. The browser connection still failed before page inspection with
a local path error. There is no callable Supabase deployment connector or local
deployment credential configuration. GitHub source publication does not prove
Lovable deployment or a working live template save.
