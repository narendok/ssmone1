# Isolated document-generation tests

Run the focused PostgreSQL regression suite without Docker or backend credentials:

```sh
pnpm --dir supabase/pending/tests install --frozen-lockfile --ignore-scripts
node --test supabase/pending/tests/template-governance.pg.mjs
```

This uses a disposable, in-memory PGlite database. It executes the repository's
actual SQL for immutable content append, activation, retirement, authorization
and the existing template transition trigger. It checks exact activation pins,
cross-template rejection, placeholder validation, failed-stage rollback, content
bytes/checksums and transition behavior.

Dependency tables and permission predicates are deliberately small test fixtures,
not an authoritative Supabase schema export. Passing this suite does **not** prove
production RLS, signed-in actor transport, Storage policies/compensation,
two-session concurrency, complete migration replay or live web/mobile behavior.
The embedded runtime has a single connection; run the two-session acceptance
script against a separately provisioned isolated PostgreSQL/Supabase environment.

`lifecycle_document_draft_acceptance.sql` and
`lifecycle_document_draft_concurrency.sh` remain isolated-environment acceptance
scripts. They need approved manager/out-of-scope identities, project/template
fixtures, the exact activated document revision and real staged storage objects.
The SQL fixture persists upload-attempt provenance before rolling back its
generated metadata, matching separate registration/commit RPC transactions.
Use disposable fixtures; do not execute these scripts against production.

Full-stack acceptance also needs an authoritative initial schema. The current
Supabase migration history starts with changes to pre-existing application
tables; replaying it on an empty database is not a substitute for that export.
Do not manufacture table definitions or permissive RLS to make acceptance pass.

References: [PGlite setup](https://pglite.dev/docs/),
[Supabase database CI](https://supabase.com/docs/guides/deployment/ci/testing).
